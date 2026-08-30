import { eachDayOfInterval, endOfWeek, format, isSameDay, isToday, startOfWeek } from 'date-fns'

interface DateStripProps {
  selectedDate: Date
  onSelect: (date: Date) => void
}

// The 7 days (Sun-Sat) of the week containing selectedDate — re-scopes
// itself whenever selectedDate changes (via the nav arrows or Month view's
// drill-down), same idea as tandem-webapp's DateStrip.jsx.
export function DateStrip({ selectedDate, onSelect }: DateStripProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(selectedDate, { weekStartsOn: 0 }),
    end: endOfWeek(selectedDate, { weekStartsOn: 0 }),
  })

  return (
    <div className="flex gap-1">
      {days.map((day) => {
        const selected = isSameDay(day, selectedDate)
        return (
          <button
            key={day.toISOString()}
            onClick={() => onSelect(day)}
            className={[
              'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-center',
              selected ? 'bg-navy text-bg' : isToday(day) ? 'text-accent' : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            <span className="text-[10px] font-medium uppercase">{format(day, 'EEE')}</span>
            <span className="text-sm font-semibold">{format(day, 'd')}</span>
          </button>
        )
      })}
    </div>
  )
}
