import { isSameDay } from 'date-fns'
import type { AgendaItem } from './types'
import { DayEventList } from './DayEventList'

interface DayViewProps {
  anchorDate: Date
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
}

export function DayView({ anchorDate, items, ownerLabel }: DayViewProps) {
  return (
    <DayEventList
      date={anchorDate}
      items={items.filter((i) => isSameDay(i.start, anchorDate))}
      ownerLabel={ownerLabel}
      headingFormat="EEEE, MMMM d"
    />
  )
}
