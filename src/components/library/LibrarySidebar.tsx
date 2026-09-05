export type LibraryView = 'all' | 'notebooks' | 'favorites' | 'recent' | 'unfiled' | 'archived'
const VIEWS: [LibraryView, string][] = [['all','All'],['notebooks','Notebooks'],['favorites','Favorites'],['recent','Recent'],['unfiled','Unfiled'],['archived','Archived']]
export function LibrarySidebar({ value, onChange }: { value: LibraryView; onChange: (value: LibraryView) => void }) {
  return <nav aria-label="Library views" className="flex gap-1 overflow-x-auto pb-1 md:w-40 md:shrink-0 md:flex-col">{VIEWS.map(([id,label]) => <button key={id} onClick={() => onChange(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${value === id ? 'bg-accent-bg font-medium text-accent' : 'text-ink-muted hover:bg-surface hover:text-ink'}`}>{label}</button>)}</nav>
}
