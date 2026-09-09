import { NavLink } from 'react-router-dom'

export function SchoolNav() {
  return (
    <nav aria-label="School sections" className="flex gap-1 rounded-full bg-surface p-1 text-sm">
      <NavLink to="/notes" className={({ isActive }) => `flex-1 rounded-full px-4 py-2 text-center font-medium ${isActive ? 'bg-accent-bg text-accent' : 'text-ink-muted'}`}>Notes</NavLink>
      <NavLink to="/notes?view=courses" className="flex-1 rounded-full px-4 py-2 text-center font-medium text-ink-muted">Courses</NavLink>
      <NavLink to="/practice" className={({ isActive }) => `flex-1 rounded-full px-4 py-2 text-center font-medium ${isActive ? 'bg-accent-bg text-accent' : 'text-ink-muted'}`}>Practice</NavLink>
    </nav>
  )
}
