import type { AgendaItem } from '../components/calendar/types'

// Tasks (and events with no real duration) get a legible minimum block
// height when rendered — not a real duration, but DayTimeline still draws
// a MIN_BLOCK_MINUTES-tall block for them. blockEnd is that same rule,
// shared so overlap detection and the column layout that actually
// prevents visual hiding (DayTimeline's layoutColumns) never disagree
// about how long an item "lasts" — they used to (a bare task got a real
// 30-minute block on screen but was invisible to detection, since it has
// zero *raw* duration), which meant two items could render side-by-side
// in split columns with neither ever getting the "Overlap" badge.
export const MIN_BLOCK_MINUTES = 30

export function blockEnd(item: AgendaItem): Date {
  const durationMs = Math.max(item.end.getTime() - item.start.getTime(), 0)
  const minMs = MIN_BLOCK_MINUTES * 60000
  return new Date(item.start.getTime() + Math.max(durationMs, minMs))
}

// Keys of items whose (effective, blockEnd-padded) time span overlaps
// another item owned by the same person — e.g. a task 2-4pm and an event
// 3-5pm both on your own plate. Completed items are excluded — a
// finished task isn't a live conflict anymore. Readings have no
// time-of-day, so they're never considered. Scoped per-owner rather than
// across the whole household, since two different people having
// something at the same time isn't a real conflict.
export function getOverlappingItemIds(items: AgendaItem[]): Set<string> {
  const timed = items.filter((i) => i.kind !== 'reading' && !i.completed)
  const overlapping = new Set<string>()

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]
      const b = timed[j]
      if (a.ownerId !== b.ownerId) continue
      if (a.start.getTime() < blockEnd(b).getTime() && b.start.getTime() < blockEnd(a).getTime()) {
        overlapping.add(a.key)
        overlapping.add(b.key)
      }
    }
  }

  return overlapping
}
