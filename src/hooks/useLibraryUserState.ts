import { supabase } from '../lib/supabaseClient'

export function useLibraryUserState(userId: string | null, reload: () => Promise<void>) {
  async function toggleNoteFavorite(noteId: string, next: boolean) {
    if (!userId) return
    await supabase.from('note_user_state').upsert({ note_id: noteId, user_id: userId, is_favorite: next, updated_at: new Date().toISOString() })
    await reload()
  }
  async function toggleNotebookFavorite(notebookId: string, next: boolean) {
    if (!userId) return
    await supabase.from('notebook_user_state').upsert({ notebook_id: notebookId, user_id: userId, is_favorite: next, updated_at: new Date().toISOString() })
    await reload()
  }
  async function markNoteOpened(noteId: string) {
    if (!userId) return
    await supabase.from('note_user_state').upsert({ note_id: noteId, user_id: userId, last_opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }
  async function toggleReadingFavorite(readingItemId: string, next: boolean) {
    if (!userId) return
    await supabase.from('reading_progress').upsert({ reading_item_id: readingItemId, user_id: userId, is_favorite: next, updated_at: new Date().toISOString() })
    await reload()
  }
  return { toggleNoteFavorite, toggleNotebookFavorite, toggleReadingFavorite, markNoteOpened }
}
