import type { LibraryNotebook } from '../../hooks/useLibrary'
import { NotebookCard } from './NotebookCard'

export function NotebookGrid({ notebooks, onFavorite }: { notebooks: LibraryNotebook[]; onFavorite?: (notebook: LibraryNotebook) => void }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{notebooks.map((notebook) => <NotebookCard key={notebook.id} notebook={notebook} onFavorite={onFavorite ? () => onFavorite(notebook) : undefined} />)}</div>
}
