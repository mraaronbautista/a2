import type { LibrarySpace, LibraryVisibility } from './libraryTypes'
export function canFileNote(notebook: { space: LibrarySpace; visibility: LibraryVisibility; ownerId: string }, note: { space: LibrarySpace; visibility: LibraryVisibility; ownerId: string }) {
  return notebook.space === note.space && (notebook.visibility === 'shared' ? note.visibility === 'shared' : note.visibility === 'private' && note.ownerId === notebook.ownerId)
}
export function canFileReading(notebook: { space: LibrarySpace; visibility: LibraryVisibility }, courseShared: boolean) { return notebook.space === 'law' && notebook.visibility === 'shared' && courseShared }
