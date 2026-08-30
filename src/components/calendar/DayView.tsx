import { isSameDay } from 'date-fns'
import type { AgendaItem } from './types'
import { DayEventList } from './DayEventList'

interface DayViewProps {
  anchorDate: Date
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
  onOpenTask?: (item: AgendaItem) => void
}

export function DayView({ anchorDate, items, ownerLabel, onOpenTask }: DayViewProps) {
  return (
    <DayEventList
      date={anchorDate}
      items={items.filter((i) => isSameDay(i.start, anchorDate))}
      ownerLabel={ownerLabel}
      onOpenTask={onOpenTask}
      headingFormat="EEEE, MMMM d"
    />
  )
}
