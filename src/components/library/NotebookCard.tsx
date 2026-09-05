import { Link } from 'react-router-dom'
import type { LibraryNotebook } from '../../hooks/useLibrary'
import { NotebookCover } from './NotebookCover'

export function NotebookCard({ notebook, onFavorite }: { notebook: LibraryNotebook; onFavorite?: () => void }) {
  return <article className="group relative rounded-xl border border-border bg-surface p-3 hover:border-accent">
    <Link to={`/notebooks/${notebook.id}`} className="block">
      <NotebookCover cover={notebook.cover} className="aspect-[4/3] w-full" />
      <h3 className="mt-3 truncate text-sm font-semibold text-ink">{notebook.name}</h3>
      <p className="mt-0.5 text-xs text-ink-muted">{notebook.sectionCount} sections · {notebook.itemCount} items</p>
      {notebook.archived_at && <span className="mt-2 inline-block rounded-full bg-bg px-2 py-0.5 text-[11px] text-ink-muted">Archived</span>}
    </Link>
    {onFavorite && <button type="button" aria-label={notebook.isFavorite ? 'Remove notebook from favorites' : 'Favorite notebook'} onClick={onFavorite} className="absolute right-4 top-4 rounded-full bg-surface/90 px-2 py-1 text-sm text-accent">{notebook.isFavorite ? '★' : '☆'}</button>}
  </article>
}
