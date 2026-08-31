import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useProfiles } from '../../hooks/useProfiles'
import { getPushSubscription, isIos, isStandalone, pushSupported, subscribeToPush, unsubscribeFromPush } from '../../lib/push'
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
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')

  const displayName = user ? (profiles[user.id] ?? user.email?.split('@')[0]) : null
  // iOS Safari can only receive push once installed to the Home Screen —
  // a platform limit, not fixable here, so this shows install guidance
  // instead of a toggle that would just silently fail.
  const needsHomeScreenInstall = isIos() && !isStandalone()
  const showPushToggle = pushSupported() && !needsHomeScreenInstall

  useEffect(() => {
    if (!showPushToggle) return
    getPushSubscription().then((sub) => setPushEnabled(!!sub))
  }, [showPushToggle])

  async function handleTogglePush() {
    if (!user) return
    setPushBusy(true)
    setPushError('')
    try {
      if (pushEnabled) {
        await unsubscribeFromPush()
        setPushEnabled(false)
      } else {
        await subscribeToPush(user.id)
        setPushEnabled(true)
      }
    } catch {
      setPushError(pushEnabled ? "Couldn't turn off notifications." : 'Notifications were blocked — check your browser/device settings.')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        <h2 className="text-sm font-semibold text-navy">Settings</h2>
        {/* Both accounts may share the same device sometimes — a quick
            "who's actually signed in" check before anyone assumes the
            wrong person's settings. */}
        {displayName && <p className="mt-1 text-xs text-ink-muted">Signed in as {displayName}</p>}

        <div className="mt-4 space-y-1">
          {showPushToggle ? (
            <button type="button" onClick={handleTogglePush} disabled={pushBusy} className={ITEM_CLASS}>
              Notifications
              <span className="text-xs text-ink-muted">{pushBusy ? '…' : pushEnabled ? 'On' : 'Off'}</span>
            </button>
          ) : (
            <div className={[ITEM_CLASS, 'cursor-default text-ink-muted hover:bg-transparent'].join(' ')}>
              Notifications
              <span className="text-xs">
                {needsHomeScreenInstall ? 'Add to Home Screen first' : pushSupported() ? 'Off' : 'Not supported'}
              </span>
            </div>
          )}
          {pushError && <p className="px-3 text-xs text-accent">{pushError}</p>}

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
