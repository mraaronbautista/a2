import { createContext, useContext } from 'react'

interface SettingsContextValue {
  openSettings: () => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within AppShell')
  return ctx
}
