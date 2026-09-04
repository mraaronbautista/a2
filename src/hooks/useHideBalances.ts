import { useState } from 'react'

const STORAGE_KEY = 'a2:hide-balances'

// A per-device display preference (not a data/RLS concern — your partner
// already sees everything here regardless) for glancing past someone
// looking over your shoulder. Persisted so it stays hidden across app
// opens if that's how you generally keep it, same pattern as useTheme.
export function useHideBalances() {
  const [hideBalances, setHideBalances] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  function toggle() {
    setHideBalances((v) => {
      const next = !v
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return { hideBalances, toggle }
}
