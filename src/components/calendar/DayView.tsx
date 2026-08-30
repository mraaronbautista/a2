import { isSameDay } from 'date-fns'
import type { AgendaItem } from './types'
import { DayEventList } from './DayEventList'

interface DayViewProps {
  anchorDate: Date
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
  onOpenItem?: (item: AgendaItem) => void
}

export function DayView({ anchorDate, items, ownerLabel, onOpenItem }: DayViewProps) {
  return (
    <DayEventList
      date={anchorDate}
      items={items.filter((i) => isSameDay(i.start, anchorDate))}
      ownerLabel={ownerLabel}
      onOpenItem={onOpenItem}
      headingFormat="EEEE, MMMM d"
    />
  )
}
