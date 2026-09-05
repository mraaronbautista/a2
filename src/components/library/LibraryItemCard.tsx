import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { LibraryItemSummary } from '../../lib/libraryTypes'
import { LibraryItemMenu } from './LibraryItemMenu'

export function LibraryItemCard({ item, onFavorite, onArchive, onMove, onDelete }: { item: LibraryItemSummary; onFavorite: () => void; onArchive: () => void; onMove?: () => void; onDelete?: () => void }) {
  return <article className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-accent"><Link to={item.kind === 'note' ? `/notes/${item.id}` : `/readings/${item.id}`} className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium text-ink">{item.title}</h3><p className="truncate text-xs text-ink-muted">{item.subtitle}{item.courseName ? ` · ${item.courseName}` : ''}{item.notebookName ? ` · ${item.notebookName}${item.sectionName ? ` / ${item.sectionName}` : ''}` : ' · Unfiled'}</p>{item.preview && <p className="mt-1 line-clamp-1 text-xs text-ink-muted">{item.preview}</p>}<p className="mt-1 text-[11px] text-ink-muted">Updated {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}</p></Link><LibraryItemMenu isFavorite={item.isFavorite} archived={!!item.archivedAt} onFavorite={onFavorite} onArchive={onArchive} onMove={onMove} onDelete={onDelete} /></article>
}
