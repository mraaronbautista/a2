import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { LibraryItemSummary, LibrarySpace, LibraryVisibility, NotebookCover } from '../lib/libraryTypes'

export interface LibraryNotebook {
  id: string
  name: string
  description: string
  visibility: LibraryVisibility
  cover: NotebookCover
  course_id: string | null
  archived_at: string | null
  updated_at: string
  sectionCount: number
  itemCount: number
  isFavorite: boolean
}

type NoteRow = {
  id: string; title: string; type: string; visibility: LibraryVisibility; course_id: string | null; updated_at: string
  archived_at: string | null; search_text: string; courses: { name: string } | null
}

export function useLibrary(householdId: string | null, userId: string | null, space: LibrarySpace) {
  const [notebooks, setNotebooks] = useState<LibraryNotebook[]>([])
  const [items, setItems] = useState<LibraryItemSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentItemIds, setRecentItemIds] = useState<Set<string>>(new Set())
  const [recentNotebookIds, setRecentNotebookIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!householdId || !userId) return
    setLoading(true)
    setError(null)
    const [notebookRes, sectionRes, entryRes, noteRes, readingRes, noteStateRes, notebookStateRes, readingStateRes] = await Promise.all([
      supabase.from('notebooks').select('*').eq('household_id', householdId).eq('space', space).order('order_index'),
      supabase.from('notebook_sections').select('id, notebook_id, name'),
      supabase.from('library_entries').select('id, section_id, note_id, reading_item_id, order_index'),
      supabase.from('notes').select('id, title, type, visibility, course_id, updated_at, archived_at, search_text, courses(name)').eq('space', space).order('updated_at', { ascending: false }),
      space === 'law' ? supabase.from('reading_items').select('id, title, created_at, archived_at, courses(name, is_shared)').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      supabase.from('note_user_state').select('note_id, is_favorite, last_opened_at').eq('user_id', userId),
      supabase.from('notebook_user_state').select('notebook_id, is_favorite, last_opened_at').eq('user_id', userId),
      supabase.from('reading_progress').select('reading_item_id, is_favorite, last_opened_at').eq('user_id', userId),
    ])
    const firstError = [notebookRes.error, sectionRes.error, entryRes.error, noteRes.error, readingRes.error, noteStateRes.error, notebookStateRes.error, readingStateRes.error].find(Boolean)
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }
    const sections = (sectionRes.data ?? []) as { id: string; notebook_id: string; name: string }[]
    const entries = (entryRes.data ?? []) as { id: string; section_id: string; note_id: string | null; reading_item_id: string | null }[]
    const sectionById = new Map(sections.map((section) => [section.id, section]))
    const notebooksById = new Map(((notebookRes.data ?? []) as { id: string; name: string }[]).map((notebook) => [notebook.id, notebook]))
    const entryByNote = new Map(entries.filter((entry) => entry.note_id).map((entry) => [entry.note_id as string, entry]))
    const favoriteNotes = new Set(((noteStateRes.data ?? []) as { note_id: string; is_favorite: boolean }[]).filter((state) => state.is_favorite).map((state) => state.note_id))
    const favoriteNotebooks = new Set(((notebookStateRes.data ?? []) as { notebook_id: string; is_favorite: boolean }[]).filter((state) => state.is_favorite).map((state) => state.notebook_id))
    const favoriteReadings = new Set(((readingStateRes.data ?? []) as { reading_item_id: string; is_favorite: boolean }[]).filter((state) => state.is_favorite).map((state) => state.reading_item_id))
    setRecentItemIds(new Set([
      ...((noteStateRes.data ?? []) as { note_id: string; last_opened_at: string | null }[]).filter((state) => state.last_opened_at).map((state) => state.note_id),
      ...((readingStateRes.data ?? []) as { reading_item_id: string; last_opened_at: string | null }[]).filter((state) => state.last_opened_at).map((state) => state.reading_item_id),
    ]))
    setRecentNotebookIds(new Set(((notebookStateRes.data ?? []) as { notebook_id: string; last_opened_at: string | null }[]).filter((state) => state.last_opened_at).map((state) => state.notebook_id)))
    const rows = (noteRes.data ?? []) as unknown as NoteRow[]
    const noteItems: LibraryItemSummary[] = rows.map((note) => {
      const entry = entryByNote.get(note.id)
      const section = entry ? sectionById.get(entry.section_id) : undefined
      const notebook = section ? notebooksById.get(section.notebook_id) : undefined
      return {
        id: note.id, kind: 'note', title: note.title || 'Untitled', subtitle: note.type === 'case_brief' ? 'Case brief' : note.type === 'paginated' ? 'Document' : 'Note',
        preview: note.search_text || '', courseName: note.courses?.name ?? null, sectionId: section?.id ?? null, sectionName: section?.name ?? null,
        notebookId: notebook?.id ?? null, notebookName: notebook?.name ?? null, visibility: note.visibility, isFavorite: favoriteNotes.has(note.id),
        archivedAt: note.archived_at, updatedAt: note.updated_at,
      }
    })
    type ReadingRow={id:string;title:string;created_at:string;archived_at:string|null;courses:{name:string;is_shared:boolean}|null}
    const readingItems: LibraryItemSummary[] = ((readingRes.data ?? []) as unknown as ReadingRow[]).map((reading) => {
      const entry=entries.find((candidate)=>candidate.reading_item_id===reading.id);const section=entry?sectionById.get(entry.section_id):undefined;const notebook=section?notebooksById.get(section.notebook_id):undefined
      return { id:reading.id,kind:'reading',title:reading.title,subtitle:'Reading',preview:'',courseName:reading.courses?.name??null,sectionId:section?.id??null,sectionName:section?.name??null,notebookId:notebook?.id??null,notebookName:notebook?.name??null,visibility:'shared',isFavorite:favoriteReadings.has(reading.id),archivedAt:reading.archived_at,updatedAt:reading.created_at }
    })
    setItems([...noteItems,...readingItems].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)))
    const rawNotebooks = (notebookRes.data ?? []) as unknown as (Omit<LibraryNotebook, 'sectionCount' | 'itemCount' | 'isFavorite'> & { id: string })[]
    setNotebooks(rawNotebooks.map((notebook) => {
      const notebookSections = sections.filter((section) => section.notebook_id === notebook.id)
      const ids = new Set(notebookSections.map((section) => section.id))
      return { ...notebook, sectionCount: notebookSections.length, itemCount: entries.filter((entry) => ids.has(entry.section_id)).length, isFavorite: favoriteNotebooks.has(notebook.id) }
    }))
    setLoading(false)
  }, [householdId, userId, space])

  useEffect(() => { void load() }, [load])

  const sectionsByNotebook = useMemo(() => new Map<string, number>(notebooks.map((n) => [n.id, n.sectionCount])), [notebooks])
  return { notebooks, items, recentItemIds, recentNotebookIds, sectionsByNotebook, loading, error, reload: load }
}
