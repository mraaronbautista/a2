import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

export type LocalExtraction = {
  status: 'ready' | 'needs_review'
  method: string
  text: string
}

const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv'])

async function extractPdfText(file: File): Promise<string> {
  // pdfjs-dist is a large library only ever needed on the rare page where
  // someone is uploading a PDF syllabus — a static import would ship it in
  // every page's main bundle instead.
  const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl

  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pages.push(pageText.trim())
  }
  return pages.join('\n\n').trim()
}

export async function extractSyllabusLocally(file: File): Promise<LocalExtraction> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (TEXT_TYPES.has(file.type) || ['txt', 'md', 'csv'].includes(extension ?? '')) {
    return { status: 'ready', method: 'browser-text', text: await file.text() }
  }

  if (file.type === 'text/html' || extension === 'html' || extension === 'htm') {
    const html = await file.text()
    const document = new DOMParser().parseFromString(html, 'text/html')
    return { status: 'ready', method: 'browser-html', text: document.body.textContent?.trim() ?? '' }
  }

  if (file.type === 'application/pdf' || extension === 'pdf') {
    try {
      const text = await extractPdfText(file)
      // A scanned/image-only PDF has no text layer — pdf.js won't error,
      // it just returns nothing per page. That still needs a human (or a
      // future OCR pass), same as any other unreadable upload.
      return text ? { status: 'ready', method: 'browser-pdf', text } : { status: 'needs_review', method: 'browser-pdf-empty', text: '' }
    } catch {
      return { status: 'needs_review', method: 'browser-pdf-failed', text: '' }
    }
  }

  return {
    status: 'needs_review',
    method: 'manual-pending-verified-extractor',
    text: '',
  }
}
