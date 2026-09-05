import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useLibrary } from '../../hooks/useLibrary'
import { useLibraryUserState } from '../../hooks/useLibraryUserState'
import type { LibraryItemSummary, LibrarySpace, LibraryVisibility } from '../../lib/libraryTypes'
import { LibrarySidebar, type LibraryView } from './LibrarySidebar'
import { LibrarySearch } from './LibrarySearch'
import { LibraryFilters } from './LibraryFilters'
import { LibraryItemCard } from './LibraryItemCard'
import { NotebookGrid } from './NotebookGrid'
import { LibraryEmptyState } from './LibraryEmptyState'
import { NewNotebookDialog } from './NewNotebookDialog'
import { MoveItemDialog } from './MoveItemDialog'

const LIBRARY_VIEWS: LibraryView[] = ['all', 'notebooks', 'favorites', 'recent', 'unfiled', 'archived']

export function LibraryWorkspace({ householdId, userId, space, courses = [], onNewNote }: {
  householdId: string; userId: string; space: LibrarySpace; courses?: { id: string; name: string }[]; onNewNote?: () => void
}) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rawView = params.get('library')
  const view: LibraryView = LIBRARY_VIEWS.includes(rawView as LibraryView) ? rawView as LibraryView : 'all'
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState<'' | LibraryVisibility>('')
  const [courseName, setCourseName] = useState('')
  const [newNotebook, setNewNotebook] = useState(false)
  const [moving, setMoving] = useState<LibraryItemSummary | null>(null)
  const [visibleLimit, setVisibleLimit] = useState(50)
  const { notebooks, items, recentItemIds, recentNotebookIds, loading, error, reload } = useLibrary(householdId, userId, space)
  const { toggleNoteFavorite, toggleNotebookFavorite, toggleReadingFavorite } = useLibraryUserState(userId, reload)
  const query = search.trim().toLowerCase()

  const shownItems = useMemo(() => items.filter((item) => {
    if (visibility && item.visibility !== visibility) return false
    if (courseName && item.courseName !== courseName) return false
    if (query && !`${item.title} ${item.preview} ${item.courseName ?? ''} ${item.notebookName ?? ''} ${item.sectionName ?? ''}`.toLowerCase().includes(query)) return false
    if (view === 'favorites' && !item.isFavorite) return false
    if (view === 'recent' && !recentItemIds.has(item.id)) return false
    if (view === 'unfiled' && item.notebookId) return false
    if (view === 'archived' && !item.archivedAt) return false
    if (view !== 'archived' && item.archivedAt) return false
    return view !== 'notebooks'
  }), [courseName, items, query, recentItemIds, view, visibility])
  const visibleItems = shownItems.slice(0, visibleLimit)

  const shownNotebooks = useMemo(() => notebooks.filter((notebook) => {
    if (visibility && notebook.visibility !== visibility) return false
    if (query && !`${notebook.name} ${notebook.description}`.toLowerCase().includes(query)) return false
    if (view === 'favorites' && !notebook.isFavorite) return false
    if (view === 'recent' && !recentNotebookIds.has(notebook.id)) return false
    if (view === 'archived' && !notebook.archived_at) return false
    if (view !== 'archived' && notebook.archived_at) return false
    return ['all', 'notebooks', 'favorites', 'recent', 'archived'].includes(view)
  }), [notebooks, query, recentNotebookIds, view, visibility])

  async function archiveItem(item: LibraryItemSummary) {
    await supabase.from(item.kind === 'note' ? 'notes' : 'reading_items').update({ archived_at: item.archivedAt ? null : new Date().toISOString() }).eq('id', item.id)
    await reload()
  }
  async function deleteItem(item: LibraryItemSummary) { if (!window.confirm(`Permanently delete “${item.title}”?`)) return; await supabase.from(item.kind === 'note' ? 'notes' : 'reading_items').delete().eq('id', item.id); await reload() }

  if (loading) return <p className="text-sm text-ink-muted">Loading library…</p>
  if (error) return <LibraryEmptyState title="Library unavailable" body={error} />
  return <div className="space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1"><LibrarySearch value={search} onChange={setSearch} /></div>
      {courses.length > 0 && <select aria-label="Course" value={courseName} onChange={(event) => setCourseName(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"><option value="">All courses</option>{courses.map((course) => <option key={course.id} value={course.name}>{course.name}</option>)}</select>}
      <LibraryFilters visibility={visibility} onVisibilityChange={setVisibility} />
      {onNewNote && <button onClick={onNewNote} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink">+ Note</button>}
      <button onClick={() => setNewNotebook(true)} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg">+ Notebook</button>
    </div>
    <div className="flex flex-col gap-4 md:flex-row">
      <LibrarySidebar value={view} onChange={(next) => { const updated = new URLSearchParams(params); updated.set('library', next); setParams(updated) }} />
      <main className="min-w-0 flex-1 space-y-4">
        {shownNotebooks.length > 0 && <NotebookGrid notebooks={shownNotebooks} onFavorite={(notebook) => void toggleNotebookFavorite(notebook.id, !notebook.isFavorite)} />}
        {shownItems.length > 0 && <div className="space-y-2">{visibleItems.map((item) => <LibraryItemCard key={`${item.kind}-${item.id}`} item={item} onFavorite={() => void (item.kind === 'note' ? toggleNoteFavorite(item.id, !item.isFavorite) : toggleReadingFavorite(item.id, !item.isFavorite))} onArchive={() => void archiveItem(item)} onMove={() => setMoving(item)} onDelete={() => void deleteItem(item)} />)}</div>}
        {shownItems.length > visibleLimit && <button onClick={() => setVisibleLimit((count) => count + 50)} className="w-full rounded-lg border border-border py-2 text-sm text-ink">Load more</button>}
        {shownNotebooks.length === 0 && shownItems.length === 0 && <LibraryEmptyState title={view === 'unfiled' ? 'Everything is filed' : 'Nothing here yet'} body={query ? 'Try a broader search or clear a filter.' : 'Create a notebook or add a note to begin organizing your library.'} action={<button onClick={() => setNewNotebook(true)} className="rounded-lg bg-navy px-4 py-2 text-sm text-bg">Create notebook</button>} />}
      </main>
    </div>
    {newNotebook && <NewNotebookDialog householdId={householdId} space={space} onClose={() => setNewNotebook(false)} onCreated={(id) => { setNewNotebook(false); navigate(`/notebooks/${id}`) }} />}
    {moving && <MoveItemDialog itemId={moving.id} kind={moving.kind} householdId={householdId} space={space} onClose={() => setMoving(null)} onSaved={() => { setMoving(null); void reload() }} />}
  </div>
}
