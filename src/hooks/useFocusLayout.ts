import { useContext } from 'react'
import { FocusLayoutContext } from './focusLayoutContext'

export function useFocusLayout() {
  const value = useContext(FocusLayoutContext)
  if (!value) throw new Error('useFocusLayout must be used within FocusLayoutProvider')
  return value
}
