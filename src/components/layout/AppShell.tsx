import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useHousehold } from '../../hooks/useHousehold'
import { Logo } from '../Logo'
import { useTheme } from '../../hooks/useTheme'
import { SettingsContext } from '../../hooks/useSettings'
import { SettingsMenu } from './SettingsMenu'
import { QuickAddModal } from '../agenda/QuickAddModal'
import { CoursesIcon, TodayIcon, UsIcon } from './icons'

const NAV_ITEMS = [
  { to: '/', label: 'Today', Icon: TodayIcon },
  { to: '/courses', label: 'Courses', Icon: CoursesIcon },
  { to: '/us', label: 'Us', Icon: UsIcon },
]

interface Course {
  id: string
  name: string
  color: string | null
}

function navLinkClass(isActive: boolean) {
  return [
    'transition-colors',
    isActive ? 'text-accent' : 'text-ink-muted hover:text-ink',
  ].join(' ')
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const { householdId } = useHousehold()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    if (!householdId) return
    supabase
      .from('courses')
      .select('id, name, color')
      .then(({ data }) => setCourses((data ?? []) as Course[]))
  }, [householdId])

  return (
    <SettingsContext.Provider value={{ openSettings: () => setSettingsOpen(true) }}>
      <div className="flex min-h-svh flex-col bg-bg md:flex-row">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface p-6 md:flex">
          <Logo size={36} className="rounded-lg" />

          {user && householdId && (
            <button
              onClick={() => setQuickAddOpen(true)}
              className="mt-6 flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <span className="text-base leading-none">+</span> Quick add
            </button>
          )}

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

        <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:hidden">
          <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1.5 shadow-lg">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  ['flex flex-col items-center gap-0.5 rounded-full px-4 py-2 text-[11px] font-medium', navLinkClass(isActive)].join(' ')
                }
              >
                <item.Icon />
                {item.label}
              </NavLink>
            ))}
          </div>
          {user && householdId && (
            <button
              onClick={() => setQuickAddOpen(true)}
              aria-label="Quick add"
              className="flex h-14 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-3xl leading-none text-white shadow-lg transition-transform hover:scale-105"
            >
              +
            </button>
          )}
        </nav>

        {user && householdId && (
          <QuickAddModal
            householdId={householdId}
            userId={user.id}
            courses={courses}
            open={quickAddOpen}
            onClose={() => setQuickAddOpen(false)}
            onAdded={() => window.dispatchEvent(new Event('a2:item-added'))}
          />
        )}

        {settingsOpen && <SettingsMenu theme={theme} toggleTheme={toggleTheme} onClose={() => setSettingsOpen(false)} />}
      </div>
    </SettingsContext.Provider>
  )
}
