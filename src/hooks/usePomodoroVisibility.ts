import { useState } from 'react'

const STORAGE_KEY = 'a2:pomodoro-hidden'

// A per-device display preference, same pattern as useHideBalances — not
// everyone studying together wants the floating timer on screen at all.
// Persisted so hiding it sticks across app opens instead of reappearing
// every reload.
export function usePomodoroVisibility() {
  const [hidden, setHidden] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  function setPomodoroHidden(next: boolean) {
    setHidden(next)
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  }

  return { hidden, setPomodoroHidden }
}
