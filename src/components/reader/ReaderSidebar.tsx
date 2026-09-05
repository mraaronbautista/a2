import { useEffect, useState, type ReactNode } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ReadingBookmark } from '../../lib/readingTypes'
import { PageThumbnail } from './PageThumbnail'

type Tab = 'pages' | 'outline' | 'search' | 'bookmarks' | 'annotations'
export function ReaderSidebar({ open, pdf, page, bookmarks, onPage, search, bookmarkPanel, annotationsPanel, onClose }: { open: boolean; pdf: PDFDocumentProxy; page: number; bookmarks: ReadingBookmark[]; onPage: (page: number) => void; search: ReactNode; bookmarkPanel: ReactNode; annotationsPanel: ReactNode; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('pages')
  if (!open) return null
  return <><button type="button" aria-label="Close reader panels" onClick={onClose} className="absolute inset-0 z-20 bg-black/30 md:hidden" /><aside className="absolute inset-x-0 bottom-0 z-30 flex max-h-[80dvh] min-h-72 flex-col rounded-t-2xl border border-border bg-surface shadow-xl md:static md:w-[272px] md:shrink-0 md:rounded-none md:border-y-0 md:border-l-0 md:shadow-none" aria-label="Reader panels"><div role="tablist" aria-label="Reader panels" className="flex overflow-x-auto border-b border-border p-1">{(['pages','outline','search','bookmarks','annotations'] as Tab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={['min-h-10 shrink-0 rounded-lg px-2 text-[11px] capitalize', tab === item ? 'bg-accent-bg text-accent' : 'text-ink-muted'].join(' ')}>{item}</button>)}</div><div className="min-h-0 flex-1 overflow-y-auto">{tab === 'pages' && <div className="space-y-1 p-2">{Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((number) => <PageThumbnail key={number} pdf={pdf} pageNumber={number} active={page === number} bookmarked={bookmarks.some((item) => item.page_number === number)} onOpen={() => { onPage(number); if (window.innerWidth < 768) onClose() }} />)}</div>}{tab === 'outline' && <OutlinePanel pdf={pdf} onPage={onPage} />}{tab === 'search' && search}{tab === 'bookmarks' && bookmarkPanel}{tab === 'annotations' && annotationsPanel}</div></aside></>
}

function OutlinePanel({ pdf, onPage }: { pdf: PDFDocumentProxy; onPage: (page: number) => void }) {
  const [content, setContent] = useState<ReactNode>(<p className="p-4 text-sm text-ink-muted">Loading outline…</p>)
  useEffect(() => { let active = true; void pdf.getOutline().then(async (outline) => { if (!active) return; if (!outline?.length) { setContent(<p className="p-4 text-sm text-ink-muted">This PDF has no table of contents.</p>); return } const rows: ReactNode[] = []; for (const item of outline) { try { const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest; if (!dest) continue; const index = await pdf.getPageIndex(dest[0]); rows.push(<button key={`${item.title}-${index}`} type="button" onClick={() => onPage(index + 1)} className="block min-h-10 w-full rounded-lg px-3 text-left text-sm hover:bg-bg">{item.title}</button>) } catch { /* ignore invalid outline destination */ } } if (active) setContent(<div className="p-2">{rows}</div>) }); return () => { active = false } }, [pdf, onPage])
  return <>{content}</>
}
