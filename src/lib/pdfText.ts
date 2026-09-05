import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ExtractedPage, NormalizedRect, PdfSearchResult } from './readingTypes'

const pageCache = new WeakMap<PDFDocumentProxy, Map<number, Promise<ExtractedPage>>>()

export function extractPageText(pdf: PDFDocumentProxy, pageNumber: number): Promise<ExtractedPage> {
  let pages = pageCache.get(pdf)
  if (!pages) { pages = new Map(); pageCache.set(pdf, pages) }
  const cached = pages.get(pageNumber)
  if (cached) return cached
  const promise = (async () => {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const lines: string[] = []
    let current = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      current += `${current ? ' ' : ''}${item.str}`
      if (item.hasEOL) { if (current.trim()) lines.push(current.trim()); current = '' }
    }
    if (current.trim()) lines.push(current.trim())
    const text = lines.join('\n')
    return { pageNumber, text, blocks: lines.map((line) => ({ text: line, heading: line.length < 90 && !/[.!?]$/.test(line) })) }
  })()
  pages.set(pageNumber, promise)
  return promise
}

export async function searchDocument(pdf: PDFDocumentProxy, query: string, onProgress: (page: number, total: number) => void, signal?: AbortSignal) {
  const term = query.toLocaleLowerCase()
  const results: PdfSearchResult[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
    onProgress(pageNumber, pdf.numPages)
    const page = await extractPageText(pdf, pageNumber)
    const lower = page.text.toLocaleLowerCase()
    let from = 0; let count = 0; let first = -1
    while ((from = lower.indexOf(term, from)) !== -1) { if (first < 0) first = from; count += 1; from += Math.max(term.length, 1) }
    if (count) {
      const start = Math.max(0, first - 50); const end = Math.min(page.text.length, first + term.length + 50)
      results.push({ pageNumber, matchCount: count, snippet: `${start ? '…' : ''}${page.text.slice(start, end).replace(/\s+/g, ' ')}${end < page.text.length ? '…' : ''}` })
    }
  }
  return results
}

export function clampRect(rect: NormalizedRect): NormalizedRect {
  const x = Math.min(1, Math.max(0, rect.x)); const y = Math.min(1, Math.max(0, rect.y))
  return { x, y, width: Math.min(1 - x, Math.max(0, rect.width)), height: Math.min(1 - y, Math.max(0, rect.height)) }
}

const DB_NAME = 'a2-pdf-text'; const STORE = 'documents'
function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function readTextCache(key: string): Promise<ExtractedPage[] | null> {
  try { const db = await openCache(); return await new Promise((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).get(key); request.onsuccess = () => resolve((request.result as ExtractedPage[] | undefined) ?? null); request.onerror = () => reject(request.error) }) } catch { return null }
}
export async function writeTextCache(key: string, pages: ExtractedPage[]): Promise<void> {
  try { const db = await openCache(); await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(pages, key); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) }) } catch { /* cache is optional */ }
}
