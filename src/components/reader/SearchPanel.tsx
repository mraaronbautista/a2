import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { searchDocument } from '../../lib/pdfText'
import type { PdfSearchResult } from '../../lib/readingTypes'

export function SearchPanel({ pdf, onOpenPage }: { pdf: PDFDocumentProxy; onOpenPage: (page: number) => void }) {
  const [query, setQuery] = useState(''); const [results, setResults] = useState<PdfSearchResult[]>([]); const [progress, setProgress] = useState(''); const [noText, setNoText] = useState(false); const controller = useRef<AbortController | null>(null)
  useEffect(() => { if (query.trim().length < 2) { queueMicrotask(() => { setResults([]); setProgress('') }); return }; const timer = setTimeout(async () => { controller.current?.abort(); const next = new AbortController(); controller.current = next; setNoText(false); try { const found = await searchDocument(pdf, query.trim(), (page, total) => setProgress(`Searching page ${page} of ${total}…`), next.signal); setResults(found); setNoText(found.length === 0 && pdf.numPages > 0); setProgress('') } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setProgress('Search failed.') } }, 300); return () => { clearTimeout(timer); controller.current?.abort() } }, [pdf, query])
  return <div className="space-y-2 p-3"><label className="sr-only" htmlFor="pdf-search">Search PDF</label><input id="pdf-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PDF" className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-accent" />
    {progress && <p aria-live="polite" className="text-xs text-ink-muted">{progress}</p>}
    {!progress && noText && <p className="text-xs leading-relaxed text-ink-muted">No matches were found. If this is a scanned PDF, it may not contain searchable text.</p>}
    {results.map((result) => <button key={result.pageNumber} type="button" onClick={() => onOpenPage(result.pageNumber)} className="block w-full rounded-lg p-2 text-left hover:bg-bg"><strong className="text-xs text-accent">Page {result.pageNumber} · {result.matchCount}</strong><span className="mt-1 block text-xs leading-relaxed text-ink-muted">{result.snippet}</span></button>)}
  </div>
}
