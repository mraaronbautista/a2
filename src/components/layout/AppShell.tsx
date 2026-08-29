import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const NAV_ITEMS = [
  { to: '/', label: 'Today' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/courses', label: 'Courses' },
  { to: '/notes', label: 'Notes' },
  { to: '/us', label: 'Us' },
]

function navLinkClass(isActive: boolean) {
  return [
    'transition-colors',
    isActive ? 'text-accent' : 'text-ink-muted hover:text-ink',
  ].join(' ')
}

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-bg md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface p-6 md:flex">
        <span className="text-xl font-semibold text-navy">A²</span>
        <nav className="mt-8 flex flex-col gap-4 text-sm font-medium">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-auto text-left text-sm text-ink-muted hover:text-ink"
        >
          Sign out
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-border bg-surface py-2 md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => ['px-3 py-1 text-xs font-medium', navLinkClass(isActive)].join(' ')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
