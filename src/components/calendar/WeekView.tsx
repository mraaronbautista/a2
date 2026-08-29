import { eachDayOfInterval, endOfWeek, isSameDay, startOfWeek } from 'date-fns'
import type { EventOccurrence } from './types'
import { DayEventList } from './DayEventList'

interface WeekViewProps {
  anchorDate: Date
  occurrences: EventOccurrence[]
  ownerLabel: (occurrence: EventOccurrence) => string | undefined
}

export function WeekView({ anchorDate, occurrences, ownerLabel }: WeekViewProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(anchorDate, { weekStartsOn: 0 }),
    end: endOfWeek(anchorDate, { weekStartsOn: 0 }),
  })

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <DayEventList
          key={day.toISOString()}
          date={day}
          occurrences={occurrences.filter((o) => isSameDay(o.start, day))}
          ownerLabel={ownerLabel}
        />
      ))}
    </div>
  )
}
