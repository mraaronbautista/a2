import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { AgendaItem } from './types'
import { EventChip } from './EventChip'

interface MonthViewProps {
  anchorDate: Date
  items: AgendaItem[]
  onSelectDay: (date: Date) => void
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE = 3

export function MonthView({ anchorDate, items, onSelectDay }: MonthViewProps) {
  const gridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 })
  const gridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-surface">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-medium text-ink-muted">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const dayItems = items.filter((i) => isSameDay(i.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime())
          const visible = dayItems.slice(0, MAX_VISIBLE)
          const overflow = dayItems.length - visible.length

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={[
                'flex min-h-16 flex-col gap-1 border-b border-r border-border p-1.5 text-left last:border-r-0 md:min-h-24',
                isSameMonth(day, anchorDate) ? 'bg-bg' : 'bg-bg/40',
              ].join(' ')}
            >
              <span
                className={[
                  'self-start rounded-full px-1.5 text-xs',
                  isToday(day) ? 'bg-accent text-white' : isSameMonth(day, anchorDate) ? 'text-ink' : 'text-ink-muted',
                ].join(' ')}
              >
                {format(day, 'd')}
              </span>

              {/* Desktop has room for real chips (title + time); a phone-width
                  column just shrinks them to an unreadable sliver, so below
                  the md breakpoint this falls back to a plain item count —
                  still answers "is this day busy" without pretending there's
                  room to preview which items. */}
              <div className="hidden flex-1 flex-col gap-0.5 overflow-hidden md:flex">
                {visible.map((item) => (
                  <EventChip key={item.key} item={item} dense />
                ))}
                {overflow > 0 && <span className="px-1 text-xs text-ink-muted">+{overflow} more</span>}
              </div>
              {dayItems.length > 0 && (
                <span className="text-xs text-ink-muted md:hidden">
                  {dayItems.length} item{dayItems.length === 1 ? '' : 's'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
