export type LocalExtraction = {
  status: 'ready' | 'needs_review'
  method: string
  text: string
}

const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv'])

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

  return {
    status: 'needs_review',
    method: 'manual-pending-verified-extractor',
    text: '',
  }
}

