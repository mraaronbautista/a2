import type { LibraryVisibility } from '../../lib/libraryTypes'

export function LibraryFilters({ visibility, onVisibilityChange }: { visibility: '' | LibraryVisibility; onVisibilityChange: (value: '' | LibraryVisibility) => void }) {
  return <select aria-label="Visibility" value={visibility} onChange={(e) => onVisibilityChange(e.target.value as '' | LibraryVisibility)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"><option value="">All access</option><option value="shared">Shared</option><option value="private">Private</option></select>
}
