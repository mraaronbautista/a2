import { formatDuration } from '../../lib/duration'
import type { AgendaItem } from './types'

interface DayTimelineProps {
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
  onOpenItem?: (item: AgendaItem) => void
  /** Item keys whose time span collides with another of the same owner's items. */
  overlappingKeys?: Set<string>
  /** Nudge the item's owner (a partner's overdue task) — omit to hide the affordance entirely. */
  onNudge?: (item: AgendaItem) => void
  nudgedKeys?: Set<string>
}

// 1.5px/minute rather than 1 — more breathing room between gridlines so a
// block's title/time/owner line doesn't feel cramped against its neighbors.
const PX_PER_MINUTE = 1.5
// Tasks (and events with no real duration) get a legible minimum block
// height rather than collapsing to a sliver — not a real duration.
const MIN_BLOCK_MINUTES = 30
const DEFAULT_RANGE_START_HOUR = 7
const DEFAULT_RANGE_END_HOUR = 20

interface ColumnInfo {
  col: number
  cols: number
}

// Side-by-side column layout for items whose spans collide — without
// this, two things at the same time both render full-width and the later
// one simply covers the earlier one, hiding it entirely (exactly what the
// "Overlap" badge above was otherwise just describing, not fixing). Items
// are grouped into transitively-connected clusters (A overlaps B, B
// overlaps C: all three share one cluster even if A and C don't touch),
// then greedily assigned the lowest free column within their cluster —
// the same approach a day-view calendar (e.g. Google Calendar) uses.
function layoutColumns(sortedItems: AgendaItem[], blockEnd: (item: AgendaItem) => Date): Map<string, ColumnInfo> {
  const result = new Map<string, ColumnInfo>()
  let cluster: { item: AgendaItem; end: number; col: number }[] = []
  let clusterEnd = -Infinity

  function flushCluster() {
    if (cluster.length === 0) return
    const cols = Math.max(...cluster.map((c) => c.col)) + 1
    for (const c of cluster) result.set(c.item.key, { col: c.col, cols })
    cluster = []
    clusterEnd = -Infinity
  }

  for (const item of sortedItems) {
    const start = item.start.getTime()
    const end = blockEnd(item).getTime()

    if (cluster.length > 0 && start >= clusterEnd) flushCluster()

    const usedCols = new Set(cluster.filter((c) => c.end > start).map((c) => c.col))
    let col = 0
    while (usedCols.has(col)) col++

    cluster.push({ item, end, col })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flushCluster()

  return result
}

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

function formatHour(hour: number) {
  const h = ((hour + 11) % 12) + 1
  const suffix = hour < 12 || hour === 24 ? 'am' : 'pm'
  return `${h}${suffix}`
}

// Unlike formatHour (gridline labels — always on the hour), a block's own
// label needs its actual minute too, e.g. "4:30am" — flooring to the hour
// alone silently dropped the minutes and showed "4am" for a 4:30 start.
function formatTime(d: Date) {
  const hour = d.getHours()
  const minute = d.getMinutes()
  const h = ((hour + 11) % 12) + 1
  const suffix = hour < 12 ? 'am' : 'pm'
  return minute === 0 ? `${h}${suffix}` : `${h}:${String(minute).padStart(2, '0')}${suffix}`
}

function isOverdue(item: AgendaItem) {
  return item.kind === 'task' && !item.completed && item.start.getTime() < Date.now()
}

function ItemCheckbox({ item }: { item: AgendaItem }) {
  if (item.kind === 'event' || !item.onToggle) return null
  return (
    <input
      type="checkbox"
      checked={!!item.completed}
      onChange={item.onToggle}
      onClick={(e) => e.stopPropagation()}
      className="h-3 w-3 shrink-0 accent-accent"
    />
  )
}

export function DayTimeline({ items, ownerLabel, onOpenItem, overlappingKeys, onNudge, nudgedKeys }: DayTimelineProps) {
  const timed = items.filter((i) => i.kind !== 'reading')
  const untimed = items.filter((i) => i.kind === 'reading')

  if (timed.length === 0 && untimed.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing scheduled.</p>
  }

  const blockEnd = (item: AgendaItem) => {
    // Tasks/events both carry a real end when one was set (item.end > item.start);
    // otherwise fall back to a legible minimum block rather than a sliver.
    const durationMs = Math.max(item.end.getTime() - item.start.getTime(), 0)
    const minMs = MIN_BLOCK_MINUTES * 60000
    return new Date(item.start.getTime() + Math.max(durationMs, minMs))
  }

  const sortedTimed = [...timed].sort((a, b) => a.start.getTime() - b.start.getTime())
  const columns = layoutColumns(sortedTimed, blockEnd)

  const earliestMinute = timed.length > 0 ? Math.min(...timed.map((i) => minutesSinceMidnight(i.start))) : DEFAULT_RANGE_START_HOUR * 60
  const latestMinute = timed.length > 0 ? Math.max(...timed.map((i) => minutesSinceMidnight(blockEnd(i)))) : DEFAULT_RANGE_END_HOUR * 60

  const rangeStartHour = Math.min(DEFAULT_RANGE_START_HOUR, Math.floor(earliestMinute / 60))
  const rangeEndHour = Math.max(DEFAULT_RANGE_END_HOUR, Math.ceil(latestMinute / 60))
  const rangeStartMinute = rangeStartHour * 60
  const hours = Array.from({ length: rangeEndHour - rangeStartHour + 1 }, (_, i) => rangeStartHour + i)
  const totalHeight = (rangeEndHour - rangeStartHour) * 60 * PX_PER_MINUTE

  return (
    <div className="space-y-3">
      {untimed.length > 0 && (
        <div className="space-y-1.5">
          {untimed.map((item) => (
            <div
              key={item.key}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm"
              style={{ backgroundColor: `${item.color}26` }}
            >
              <ItemCheckbox item={item} />
              <span className={['truncate font-medium', item.completed ? 'text-ink-muted line-through' : 'text-ink'].join(' ')}>
                {item.title}
              </span>
              <span className="shrink-0 text-xs text-ink-muted">Reading</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex" style={{ height: totalHeight }}>
        <div className="relative w-12 shrink-0 text-right">
          {hours.map((h) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-xs text-ink-muted"
              style={{ top: (h - rangeStartHour) * 60 * PX_PER_MINUTE }}
            >
              {formatHour(h)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 border-l border-border">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute inset-x-0 border-t border-border/60"
              style={{ top: (h - rangeStartHour) * 60 * PX_PER_MINUTE }}
            />
          ))}

          {sortedTimed.map((item) => {
            const top = (minutesSinceMidnight(item.start) - rangeStartMinute) * PX_PER_MINUTE
            const durationMinutes = Math.round((blockEnd(item).getTime() - item.start.getTime()) / 60000)
            const height = Math.max(
              (minutesSinceMidnight(blockEnd(item)) - minutesSinceMidnight(item.start)) * PX_PER_MINUTE,
              MIN_BLOCK_MINUTES * PX_PER_MINUTE,
            )
            const label = ownerLabel(item)
            const overlapping = overlappingKeys?.has(item.key) ?? false
            const overdue = isOverdue(item)
            const canNudge = onNudge && overdue && !!label
            const { col, cols } = columns.get(item.key) ?? { col: 0, cols: 1 }

            return (
              <div
                key={item.key}
                onClick={onOpenItem ? () => onOpenItem(item) : undefined}
                className={[
                  'absolute overflow-hidden rounded-md px-2 py-1 text-left text-xs',
                  onOpenItem ? 'cursor-pointer' : '',
                  overlapping ? 'ring-1 ring-inset ring-accent' : '',
                ].join(' ')}
                style={{
                  top,
                  height,
                  left: `calc(${(col / cols) * 100}% + 4px)`,
                  width: `calc(${100 / cols}% - 8px)`,
                  backgroundColor: `${item.color}33`,
                  borderLeft: `3px solid ${item.color}`,
                }}
              >
                <span className="flex items-center gap-1">
                  <ItemCheckbox item={item} />
                  <span className={['min-w-0 flex-1 truncate font-medium', item.completed ? 'text-ink-muted line-through' : 'text-ink'].join(' ')}>
                    {item.title}
                  </span>
                  {overlapping && <span className="shrink-0 font-semibold text-accent">Overlap</span>}
                </span>
                <span className="block truncate text-ink-muted">
                  {formatTime(item.start)}
                  {durationMinutes > MIN_BLOCK_MINUTES ? ` (${formatDuration(durationMinutes)})` : ''}
                  {label ? ` · ${label}` : ''}
                  {canNudge && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onNudge(item)
                      }}
                      disabled={nudgedKeys?.has(item.key)}
                      className="ml-1.5 font-semibold text-accent underline disabled:no-underline disabled:text-ink-muted"
                    >
                      {nudgedKeys?.has(item.key) ? 'Reminded' : 'Remind'}
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
