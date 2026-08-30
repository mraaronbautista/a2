import { isSameDay } from 'date-fns'
import type { AgendaItem } from './types'
import { DayTimeline } from './DayTimeline'

interface DayViewProps {
  anchorDate: Date
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
  onOpenItem?: (item: AgendaItem) => void
}

export function DayView({ anchorDate, items, ownerLabel, onOpenItem }: DayViewProps) {
  return <DayTimeline items={items.filter((i) => isSameDay(i.start, anchorDate))} ownerLabel={ownerLabel} onOpenItem={onOpenItem} />
}
