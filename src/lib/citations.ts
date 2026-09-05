export function formatCitation(readingTitle: string, pageNumber: number): string {
  return `${readingTitle}, p. ${pageNumber}`
}

export function formatQuoteCitation(quotedText: string, readingTitle: string, pageNumber: number): string {
  const normalized = quotedText.replace(/\s+/g, ' ').trim().slice(0, 1000)
  return `“${normalized}” — ${formatCitation(readingTitle, pageNumber)}`
}
