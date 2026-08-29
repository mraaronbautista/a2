import { eachDayOfInterval, endOfWeek, isSameDay, startOfWeek } from 'date-fns'
import type { AgendaItem } from './types'
import { DayEventList } from './DayEventList'

interface WeekViewProps {
  anchorDate: Date
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
}

export function WeekView({ anchorDate, items, ownerLabel }: WeekViewProps) {
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
          items={items.filter((i) => isSameDay(i.start, day))}
          ownerLabel={ownerLabel}
        />
      ))}
    </div>
  )
}
