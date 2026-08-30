import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useProfiles } from '../../hooks/useProfiles'
import { HowToGuide } from './HowToGuide'

interface SettingsMenuProps {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  onClose: () => void
}

const ITEM_CLASS = 'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-bg'

export function SettingsMenu({ theme, toggleTheme, onClose }: SettingsMenuProps) {
  const { user } = useAuth()
  const profiles = useProfiles()
  const [guideOpen, setGuideOpen] = useState(false)

  const displayName = user ? (profiles[user.id] ?? user.email?.split('@')[0]) : null

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl border border-border bg-surface p-6 md:rounded-2xl"
      >
        <h2 className="text-sm font-semibold text-navy">Settings</h2>
        {/* Both accounts may share the same device sometimes — a quick
            "who's actually signed in" check before anyone assumes the
            wrong person's settings. */}
        {displayName && <p className="mt-1 text-xs text-ink-muted">Signed in as {displayName}</p>}

        <div className="mt-4 space-y-1">
          <div className={[ITEM_CLASS, 'cursor-default text-ink-muted hover:bg-transparent'].join(' ')}>
            Notifications
            <span className="text-xs">Coming soon</span>
          </div>

          <button type="button" onClick={toggleTheme} className={ITEM_CLASS}>
            Appearance
            <span className="text-xs text-ink-muted capitalize">{theme}</span>
          </button>

          <button type="button" onClick={() => setGuideOpen(true)} className={ITEM_CLASS}>
            How to use A²
          </button>

          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className={[ITEM_CLASS, 'text-accent'].join(' ')}
          >
            Sign out
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-3 py-2 text-sm text-ink-muted hover:text-ink">
            Close
          </button>
        </div>
      </div>

      {guideOpen && <HowToGuide onClose={() => setGuideOpen(false)} />}
    </div>
  )
}
