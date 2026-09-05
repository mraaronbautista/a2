import { useMemo, useState, type ReactNode } from 'react'
import { FocusLayoutContext } from './focusLayoutContext'

export function FocusLayoutProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(false)
  const value = useMemo(() => ({ focused, setFocused }), [focused])

  return <FocusLayoutContext.Provider value={value}>{children}</FocusLayoutContext.Provider>
}
