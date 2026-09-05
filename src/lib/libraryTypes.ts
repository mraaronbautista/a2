export type LibrarySpace = 'law' | 'personal'
export type LibraryVisibility = 'private' | 'shared'
export type NotebookPattern = 'plain' | 'linen' | 'grid' | 'diagonal' | 'legal' | 'speckled'
export interface NotebookCover { color: string; pattern: NotebookPattern; icon: string | null }
export interface NotebookSummary { id: string; name: string; description: string; space: LibrarySpace; visibility: LibraryVisibility; course_id: string | null; cover: NotebookCover; order_index: number; archived_at: string | null; isFavorite: boolean; sectionCount: number; itemCount: number }
export interface LibraryItemSummary { id: string; kind: 'note' | 'reading'; title: string; subtitle: string; preview: string; courseName: string | null; sectionId: string | null; sectionName: string | null; notebookId: string | null; notebookName: string | null; visibility: LibraryVisibility; isFavorite: boolean; archivedAt: string | null; updatedAt: string }
export interface NotebookSectionSummary { id: string; notebook_id: string; name: string; color: string | null; order_index: number }
