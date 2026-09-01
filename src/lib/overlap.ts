import type { AgendaItem } from '../components/calendar/types'

// Keys of items whose time span overlaps another item owned by the same
// person — e.g. a task 2-4pm and an event 3-5pm both on your own plate.
// Only items with a real duration (end > start) can conflict; a bare
// point-in-time task/event can't. Completed items are excluded — a
// finished task isn't a live conflict anymore. Readings have no
// time-of-day, so they're never considered. Scoped per-owner rather than
// across the whole household, since two different people having
// something at the same time isn't a real conflict.
export function getOverlappingItemIds(items: AgendaItem[]): Set<string> {
  const timed = items.filter((i) => i.kind !== 'reading' && !i.completed && i.end.getTime() > i.start.getTime())
  const overlapping = new Set<string>()

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]
      const b = timed[j]
      if (a.ownerId !== b.ownerId) continue
      if (a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()) {
        overlapping.add(a.key)
        overlapping.add(b.key)
      }
    }
  }

  return overlapping
}
