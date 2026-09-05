import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { useReadingProgress } from '../hooks/useReadingProgress'
import { useReadingAnnotations } from '../hooks/useReadingAnnotations'
import { extractPageText, readTextCache, writeTextCache } from '../lib/pdfText'
import { formatQuoteCitation } from '../lib/citations'
import type { AnnotationColor, ExtractedPage, ReadingAnnotation, TextAnchor } from '../lib/readingTypes'
import { ReaderToolbar } from '../components/reader/ReaderToolbar'
import { ReaderSidebar } from '../components/reader/ReaderSidebar'
import { SearchPanel } from '../components/reader/SearchPanel'
import { BookmarksPanel } from '../components/reader/BookmarksPanel'
import { AnnotationsPanel } from '../components/reader/AnnotationsPanel'
import { PdfDocument } from '../components/reader/PdfDocument'
import { ReflowView } from '../components/reader/ReflowView'
import { CreateLinkedNoteDialog } from '../components/reader/CreateLinkedNoteDialog'

interface Reading { id: string; course_id: string; title: string; storage_path: string | null; original_name: string | null; size_bytes: number | null }
interface Course { id: string; name: string; is_shared: boolean }
interface Selection { text: string; anchor: TextAnchor }

export function ReadingDetail() {
  const { readingId = '' } = useParams<{ readingId: string }>(); const { user } = useAuth()
  const [reading, setReading] = useState<Reading | null>(null); const [course, setCourse] = useState<Course | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(true); const [metadataError, setMetadataError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768); const [rotation, setRotation] = useState(0)
  const [selection, setSelection] = useState<Selection | null>(null); const [linkedNoteOpen, setLinkedNoteOpen] = useState(false)
  const [pageNoteOpen, setPageNoteOpen] = useState(false); const [pageNoteDraft, setPageNoteDraft] = useState(''); const [savingPageNote, setSavingPageNote] = useState(false)
  const [reflowPages, setReflowPages] = useState<ExtractedPage[]>([]); const [reflowLoading, setReflowLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => { let active = true; queueMicrotask(() => { if (active) setMetadataLoading(true) }); Promise.all([
    supabase.from('reading_items').select('id, course_id, title, storage_path, original_name, size_bytes').eq('id', readingId).single(),
  ]).then(async ([result]) => { if (!active) return; if (result.error || !result.data) { setMetadataError('Reading not found.'); setMetadataLoading(false); return } const item = result.data as Reading; const courseResult = await supabase.from('courses').select('id, name, is_shared').eq('id', item.course_id).single(); if (!active) return; setReading(item); setCourse((courseResult.data ?? null) as Course | null); setMetadataLoading(false) }); return () => { active = false } }, [readingId])

  const pdfState = usePdfDocument(reading?.storage_path ?? null)
  const progress = useReadingProgress(readingId, user?.id ?? '', pdfState.pageCount)
  const state = useReadingAnnotations(readingId, user?.id ?? '')

  useEffect(() => { if (!readingId) return; const channel = supabase.channel(`open-reading-${readingId}`).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reading_items', filter: `id=eq.${readingId}` }, () => setMetadataError('This reading was deleted.')).subscribe(); return () => { void supabase.removeChannel(channel) } }, [readingId])

  useEffect(() => {
    function handleKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (event.metaKey || event.ctrlKey || event.altKey || target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') progress.setPage(progress.page - 1)
      else if (event.key === 'ArrowRight' || event.key === 'PageDown') progress.setPage(progress.page + 1)
      else if (event.key === 'Home') progress.setPage(1)
      else if (event.key === 'End') progress.setPage(pdfState.pageCount)
      else if (event.key === '+' || event.key === '=') progress.setZoomValue(progress.zoomValue + .1)
      else if (event.key === '-') progress.setZoomValue(progress.zoomValue - .1)
      else if (event.key === '0') progress.setZoomMode('fit-width')
      else if (event.key.toLowerCase() === 'b') void state.toggleBookmark(progress.page)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', handleKeys)
    return () => window.removeEventListener('keydown', handleKeys)
  }, [progress, pdfState.pageCount, state])

  useEffect(() => {
    if (progress.viewMode !== 'reflow' || !pdfState.document || !reading) return
    let active = true; queueMicrotask(() => { if (active) setReflowLoading(true) })
    const key = `${reading.id}:${reading.size_bytes ?? 0}:${reading.storage_path ?? ''}`
    ;(async () => { const cached = await readTextCache(key); if (cached) { if (active) { setReflowPages(cached); setReflowLoading(false) }; return } const pages: ExtractedPage[] = []; for (let page = 1; page <= pdfState.document!.numPages; page += 1) { if (!active) return; pages.push(await extractPageText(pdfState.document!, page)); if (active) setReflowPages([...pages]) } await writeTextCache(key, pages); if (active) setReflowLoading(false) })()
    return () => { active = false }
  }, [progress.viewMode, pdfState.document, reading])

  const download = useCallback(() => { if (!pdfState.pdfBlob || !reading) return; const url = URL.createObjectURL(pdfState.pdfBlob); const link = document.createElement('a'); link.href = url; link.download = reading.original_name ?? `${reading.title}.pdf`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }, [pdfState.pdfBlob, reading])
  const print = useCallback(() => { if (!pdfState.pdfBlob) return; const url = URL.createObjectURL(pdfState.pdfBlob); const frame = document.createElement('iframe'); frame.style.position = 'fixed'; frame.style.width = '1px'; frame.style.height = '1px'; frame.style.opacity = '0'; frame.src = url; frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); window.setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 30_000) }; document.body.appendChild(frame) }, [pdfState.pdfBlob])
  async function copyCitation() { if (!reading || !selection) return; await navigator.clipboard.writeText(formatQuoteCitation(selection.text, reading.title, progress.page)); setSelection(null) }
  async function highlight(color: AnnotationColor) { if (!selection) return; await state.createHighlight(progress.page, selection.text, color, selection.anchor); window.getSelection()?.removeAllRanges(); setSelection(null) }
  function addPageNote() { setPageNoteDraft(''); setPageNoteOpen(true) }
  async function savePageNote() { const body = pageNoteDraft.trim(); if (!body) { setPageNoteOpen(false); return }; setSavingPageNote(true); const saved = await state.upsertNote(progress.page, body, selection?.text ?? null, selection?.anchor ?? null); setSavingPageNote(false); if (saved) { setPageNoteOpen(false); setSelection(null) } }
  function deleteAnnotation(item: ReadingAnnotation) { if (item.body && !window.confirm('Delete this annotation?')) return; void state.deleteAnnotation(item.id) }

  if (metadataLoading) return <div className="flex h-full items-center justify-center p-6 text-sm text-ink-muted">Opening reading…</div>
  if (metadataError || !reading || !course) return <div className="mx-auto max-w-xl space-y-4 p-6"><Link to="/notes?view=courses" className="text-sm text-ink-muted">← Back</Link><p className="rounded-xl border border-border bg-surface p-5 text-sm text-accent">{metadataError || 'Reading not found.'}</p></div>
  if (pdfState.status !== 'ready' || !pdfState.document) return <div className="mx-auto max-w-xl space-y-4 p-6"><Link to={`/courses/${course.id}`} className="text-sm text-ink-muted">← Back to course</Link><p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">{pdfState.status === 'loading' ? 'Downloading and preparing PDF…' : pdfState.errorMessage}</p></div>

  const bookmarked = state.bookmarks.some((item) => item.page_number === progress.page)
  return <div ref={rootRef} className="relative flex h-full min-h-0 flex-col overflow-hidden bg-bg">
    <ReaderToolbar courseId={course.id} title={reading.title} courseName={course.name} sidebarOpen={sidebarOpen} viewMode={progress.viewMode} bookmarked={bookmarked} rotation={rotation} onToggleSidebar={() => setSidebarOpen((value) => !value)} onViewMode={progress.setViewMode} onBookmark={() => state.toggleBookmark(progress.page)} onNote={() => setLinkedNoteOpen(true)} onPrint={print} onDownload={download} onFullscreen={() => rootRef.current?.requestFullscreen()} onRotate={() => setRotation((value) => (value + 90) % 360)} />
    {state.error && <p role="alert" className="shrink-0 bg-accent-bg px-3 py-2 text-xs text-accent">{state.error}</p>}
    <div className="relative flex min-h-0 flex-1">
      <ReaderSidebar open={sidebarOpen} pdf={pdfState.document} page={progress.page} bookmarks={state.bookmarks} onPage={progress.setPage} onClose={() => setSidebarOpen(false)} search={<SearchPanel pdf={pdfState.document} onOpenPage={progress.setPage} />} bookmarkPanel={<BookmarksPanel bookmarks={state.bookmarks} onOpenPage={progress.setPage} onLabel={state.setBookmarkLabel} onDelete={state.toggleBookmark} />} annotationsPanel={<AnnotationsPanel annotations={state.annotations} onOpenPage={progress.setPage} onDelete={deleteAnnotation} />} />
      {progress.viewMode === 'page' ? <PdfDocument pdf={pdfState.document} page={progress.page} zoomMode={progress.zoomMode} zoom={progress.zoomValue} rotation={rotation} annotations={state.annotations} onTextSelection={(text, anchor) => setSelection({ text, anchor })} /> : <ReflowView pages={reflowPages} loading={reflowLoading} onOpenPage={(page) => { progress.setPage(page); progress.setViewMode('page') }} />}
    </div>
    <footer className="flex min-h-12 shrink-0 items-center justify-center gap-2 border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] text-sm text-ink-muted print:hidden"><button type="button" disabled={progress.page <= 1} onClick={() => progress.setPage(progress.page - 1)} className="min-h-10 rounded-lg px-3 disabled:opacity-30">←</button><label className="flex items-center gap-1"><span className="sr-only">Page</span><input type="number" min={1} max={pdfState.pageCount} value={progress.page} onChange={(e) => progress.setPage(Number(e.target.value))} className="h-9 w-14 rounded border border-border bg-bg px-1 text-center text-ink" /> <span>of {pdfState.pageCount}</span></label><button type="button" disabled={progress.page >= pdfState.pageCount} onClick={() => progress.setPage(progress.page + 1)} className="min-h-10 rounded-lg px-3 disabled:opacity-30">→</button>{progress.viewMode === 'page' && <><span className="h-4 w-px bg-border" /><button type="button" onClick={() => progress.setZoomValue(progress.zoomValue - .1)} className="min-h-10 px-2">−</button><button type="button" onClick={() => progress.setZoomMode(progress.zoomMode === 'fit-width' ? 'fit-page' : 'fit-width')} className="min-h-10 rounded-lg px-2 text-xs">{progress.zoomMode === 'custom' ? `${Math.round(progress.zoomValue * 100)}%` : progress.zoomMode === 'fit-width' ? 'Fit width' : 'Fit page'}</button><button type="button" onClick={() => progress.setZoomValue(progress.zoomValue + .1)} className="min-h-10 px-2">+</button></>}</footer>
    {selection && <div className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-xl border border-border bg-surface p-2 shadow-xl" aria-label="Text selection actions">{(['yellow','green','blue','pink','purple'] as AnnotationColor[]).map((color) => <button key={color} type="button" onClick={() => highlight(color)} aria-label={`Highlight ${color}`} className="h-9 w-9 rounded-full border border-border" style={{ backgroundColor: { yellow:'#fde68a',green:'#bbf7d0',blue:'#bfdbfe',pink:'#fbcfe8',purple:'#e9d5ff' }[color] }} />)}<button type="button" onClick={addPageNote} className="min-h-9 px-2 text-xs">Add note</button><button type="button" onClick={copyCitation} className="min-h-9 px-2 text-xs">Copy citation</button></div>}
    {pageNoteOpen && <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => { if (!savingPageNote) setPageNoteOpen(false) }}><div role="dialog" aria-modal="true" aria-label={`Note for page ${progress.page}`} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-3 rounded-t-2xl border border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"><h2 className="font-semibold text-navy">Note for page {progress.page}</h2>{selection?.text && <blockquote className="max-h-24 overflow-auto rounded-lg bg-bg p-2 text-xs italic text-ink-muted">“{selection.text}”</blockquote>}<textarea autoFocus value={pageNoteDraft} onChange={(event) => setPageNoteDraft(event.target.value)} maxLength={20_000} rows={6} placeholder="Write a note…" className="w-full resize-y rounded-lg border border-border bg-bg p-3 text-sm text-ink outline-none focus:border-accent" /><div className="flex justify-end gap-2"><button type="button" disabled={savingPageNote} onClick={() => setPageNoteOpen(false)} className="min-h-11 px-3 text-sm text-ink-muted">Cancel</button><button type="button" disabled={savingPageNote || !pageNoteDraft.trim()} onClick={savePageNote} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">{savingPageNote ? 'Saving…' : 'Save note'}</button></div></div></div>}
    {linkedNoteOpen && <CreateLinkedNoteDialog readingId={reading.id} readingTitle={reading.title} page={progress.page} quotedText={selection?.text ?? null} annotationId={null} sharedCourse={course.is_shared} onClose={() => setLinkedNoteOpen(false)} />}
  </div>
}
