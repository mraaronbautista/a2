import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { LibraryVisibility, NotebookCover } from '../lib/libraryTypes'

export interface NotebookSectionRow { id: string; notebook_id: string; name: string; color: string | null; order_index: number }
export interface NotebookEntryRow { id: string; section_id: string; note_id: string | null; reading_item_id: string | null; order_index: number; title: string; subtitle: string }
export interface NotebookRow { id: string; name: string; description: string; visibility: LibraryVisibility; cover: NotebookCover; course_id: string | null; space: 'law' | 'personal'; archived_at: string | null }

export function useNotebook(notebookId: string | undefined) {
  const [notebook, setNotebook] = useState<NotebookRow | null>(null)
  const [sections, setSections] = useState<NotebookSectionRow[]>([])
  const [entries, setEntries] = useState<NotebookEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!notebookId) return
    setLoading(true); setError(null)
    const notebookRes = await supabase.from('notebooks').select('id, name, description, visibility, cover, course_id, space, archived_at').eq('id', notebookId).single()
    if (notebookRes.error) { setError(notebookRes.error.message); setLoading(false); return }
    const sectionsRes = await supabase.from('notebook_sections').select('id, notebook_id, name, color, order_index').eq('notebook_id', notebookId).order('order_index')
    const sectionRows = (sectionsRes.data ?? []) as NotebookSectionRow[]
    const sectionIds = sectionRows.map((section) => section.id)
    const entriesRes = sectionIds.length ? await supabase.from('library_entries').select('id, section_id, note_id, reading_item_id, order_index').in('section_id', sectionIds).order('order_index') : { data: [], error: null }
    const rawEntries = (entriesRes.data ?? []) as { id: string; section_id: string; note_id: string | null; reading_item_id: string | null; order_index: number }[]
    const noteIds = rawEntries.flatMap((entry) => entry.note_id ? [entry.note_id] : [])
    const readingIds = rawEntries.flatMap((entry) => entry.reading_item_id ? [entry.reading_item_id] : [])
    const [notesRes, readingsRes] = await Promise.all([
      noteIds.length ? supabase.from('notes').select('id, title, type').in('id', noteIds) : Promise.resolve({ data: [], error: null }),
      readingIds.length ? supabase.from('reading_items').select('id, title').in('id', readingIds) : Promise.resolve({ data: [], error: null }),
    ])
    const noteMap = new Map(((notesRes.data ?? []) as { id: string; title: string; type: string }[]).map((n) => [n.id, n]))
    const readingMap = new Map(((readingsRes.data ?? []) as { id: string; title: string }[]).map((r) => [r.id, r]))
    setNotebook(notebookRes.data as unknown as NotebookRow); setSections(sectionRows)
    setEntries(rawEntries.map((entry) => {
      const note = entry.note_id ? noteMap.get(entry.note_id) : null
      const reading = entry.reading_item_id ? readingMap.get(entry.reading_item_id) : null
      return { ...entry, title: note?.title ?? reading?.title ?? 'Untitled', subtitle: note ? (note.type === 'paginated' ? 'Document' : 'Note') : 'Reading' }
    }))
    setLoading(false)
  }, [notebookId])
  useEffect(() => { void load() }, [load])
  return { notebook, sections, entries, loading, error, reload: load }
}
