export function notePreview(searchText: string) { return searchText.replace(/\s+/g, ' ').trim().slice(0, 180) }
export function caseBriefPreview(issue: string | null, holding: string | null) { return [issue, holding].filter(Boolean).join(' — ').replace(/\s+/g, ' ').slice(0, 180) }
export function readingPreview(filename: string | null, page: number | null, pageCount: number | null) { return [filename, page && pageCount ? `Page ${page} of ${pageCount}` : null].filter(Boolean).join(' · ') }
