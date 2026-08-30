import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../Logo'
import { useTheme } from '../../hooks/useTheme'
import { SettingsContext } from '../../hooks/useSettings'
import { SettingsMenu } from './SettingsMenu'
import { CoursesIcon, NotesIcon, TodayIcon, UsIcon } from './icons'

const NAV_ITEMS = [
  { to: '/', label: 'Today', Icon: TodayIcon },
  { to: '/courses', label: 'Courses', Icon: CoursesIcon },
  { to: '/notes', label: 'Notes', Icon: NotesIcon },
  { to: '/us', label: 'Us', Icon: UsIcon },
]

function navLinkClass(isActive: boolean) {
  return [
    'transition-colors',
    isActive ? 'text-accent' : 'text-ink-muted hover:text-ink',
  ].join(' ')
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <SettingsContext.Provider value={{ openSettings: () => setSettingsOpen(true) }}>
      <div className="flex min-h-svh flex-col bg-bg md:flex-row">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface p-6 md:flex">
          <Logo size={36} className="rounded-lg" />
          <nav className="mt-8 flex flex-col gap-4 text-sm font-medium">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => ['flex items-center gap-2.5', navLinkClass(isActive)].join(' ')}
              >
                <item.Icon />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => setSettingsOpen(true)}
            className="mt-auto text-left text-sm text-ink-muted hover:text-ink"
          >
            Settings
          </button>
        </aside>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                ['flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium', navLinkClass(isActive)].join(' ')
              }
            >
              <item.Icon />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {settingsOpen && <SettingsMenu theme={theme} toggleTheme={toggleTheme} onClose={() => setSettingsOpen(false)} />}
      </div>
    </SettingsContext.Provider>
  )
}
