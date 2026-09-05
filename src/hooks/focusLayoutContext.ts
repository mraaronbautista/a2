import { createContext } from 'react'

export interface FocusLayoutValue {
  focused: boolean
  setFocused: (focused: boolean) => void
}

export const FocusLayoutContext = createContext<FocusLayoutValue | null>(null)
