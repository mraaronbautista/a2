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
import type { EventOccurrence } from './types'
import { EventChip } from './EventChip'

interface MonthViewProps {
  anchorDate: Date
  occurrences: EventOccurrence[]
  onSelectDay: (date: Date) => void
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE = 3

export function MonthView({ anchorDate, occurrences, onSelectDay }: MonthViewProps) {
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
          const dayOccurrences = occurrences
            .filter((o) => isSameDay(o.start, day))
            .sort((a, b) => a.start.getTime() - b.start.getTime())
          const overflow = dayOccurrences.length - MAX_VISIBLE

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={[
                'flex min-h-24 flex-col gap-1 border-b border-r border-border p-1.5 text-left last:border-r-0',
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
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {dayOccurrences.slice(0, MAX_VISIBLE).map((o) => (
                  <EventChip key={o.key} occurrence={o} dense />
                ))}
                {overflow > 0 && <span className="px-1 text-xs text-ink-muted">+{overflow} more</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
