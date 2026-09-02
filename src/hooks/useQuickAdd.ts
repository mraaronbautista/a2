import { createContext, useContext, useEffect } from 'react'

export type QuickAddHandler = (() => void) | null

interface QuickAddContextValue {
  setHandler: (handler: QuickAddHandler) => void
}

export const QuickAddContext = createContext<QuickAddContextValue | null>(null)

// Lets whichever page is currently mounted override what AppShell's
// persistent "+" does — e.g. add a note on Notes, add a transaction on
// Us's Budget tab — instead of it always opening Timeline's task/event
// quick-add. Unmounting (or passing null) falls back to that default.
export function useQuickAdd(handler: QuickAddHandler) {
  const ctx = useContext(QuickAddContext)
  useEffect(() => {
    ctx?.setHandler(handler)
    return () => ctx?.setHandler(null)
  }, [ctx, handler])
}
