import { LibraryFilters } from './LibraryFilters'
import type { LibraryVisibility } from '../../lib/libraryTypes'

export function LibraryMobileFilters(props: { visibility: '' | LibraryVisibility; onVisibilityChange: (value: '' | LibraryVisibility) => void }) {
  return <div className="md:hidden"><LibraryFilters {...props} /></div>
}
