import { useState } from 'react'

const STORAGE_KEY = 'a2:pomodoro-activated'

// Whether this device has ever actually started a Pomodoro session — the
// floating widget shouldn't be permanent chrome for a feature nobody's
// used yet. Owned by AppShell (not PomodoroTimer itself) so the Settings
// menu can read the same value without a second, out-of-sync copy.
export function usePomodoroActivated() {
  const [activated, setActivatedState] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  function markActivated() {
    if (activated) return
    setActivatedState(true)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  return { activated, markActivated }
}
