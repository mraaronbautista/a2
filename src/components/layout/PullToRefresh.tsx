import { useRef, useState, type ReactNode, type TouchEvent } from 'react'

const THRESHOLD = 70

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: ReactNode
}

// Finds the actual scrolling element above a touch point rather than
// assuming the whole page scrolls — AppShell's <main> is an
// overflow-y-auto container, not the document/window, so window.scrollY
// would always read 0 here and this would fire on every touch regardless
// of scroll position.
function findScrollParent(el: HTMLElement | null): HTMLElement {
  let node = el
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return document.documentElement
}

// Standalone "Add to Home Screen" PWAs have no browser chrome — no native
// pull-to-refresh the way a browser tab sometimes provides — so this is
// implemented by hand. Only engages when the page is already scrolled to
// the very top, so it doesn't fight with normal scrolling through a list.
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef<number | null>(null)
  const scrollParent = useRef<HTMLElement | null>(null)

  function handleTouchStart(e: TouchEvent) {
    scrollParent.current = findScrollParent(e.target as HTMLElement)
    touchStartY.current = scrollParent.current.scrollTop === 0 ? e.touches[0].clientY : null
  }

  function handleTouchMove(e: TouchEvent) {
    if (touchStartY.current === null || refreshing) return
    // Scrolled away from the top mid-gesture — stop tracking, but don't
    // reset touchStartY: a little jitter right at the start of a touch
    // shouldn't permanently kill tracking for the rest of that touch.
    if ((scrollParent.current?.scrollTop ?? 0) > 0) {
      setPullY(0)
      return
    }
    const delta = e.touches[0].clientY - touchStartY.current
    setPullY(delta > 0 ? Math.min(delta * 0.5, 90) : 0)
  }

  async function handleTouchEnd() {
    if (pullY > THRESHOLD) {
      setRefreshing(true)
      setPullY(THRESHOLD)
      await onRefresh()
      setRefreshing(false)
    }
    setPullY(0)
    touchStartY.current = null
  }

  const indicatorHeight = refreshing ? THRESHOLD : pullY
  const ready = refreshing || pullY > THRESHOLD

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="flex items-center justify-center overflow-hidden transition-[height] duration-150" style={{ height: indicatorHeight }}>
        {indicatorHeight > 0 && (
          <div className={['flex items-center gap-2 text-xs font-medium', ready ? 'text-accent' : 'text-ink-muted'].join(' ')}>
            <span className={['text-base leading-none', refreshing ? 'animate-spin' : ''].join(' ')}>↻</span>
            <span>{refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
