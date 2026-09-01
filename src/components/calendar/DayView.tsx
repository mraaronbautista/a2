import { isSameDay } from 'date-fns'
import type { AgendaItem } from './types'
import { DayTimeline } from './DayTimeline'

interface DayViewProps {
  anchorDate: Date
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
  onOpenItem?: (item: AgendaItem) => void
  overlappingKeys?: Set<string>
  onNudge?: (item: AgendaItem) => void
  nudgedKeys?: Set<string>
}

export function DayView({ anchorDate, items, ownerLabel, onOpenItem, overlappingKeys, onNudge, nudgedKeys }: DayViewProps) {
  return (
    <DayTimeline
      items={items.filter((i) => isSameDay(i.start, anchorDate))}
      ownerLabel={ownerLabel}
      onOpenItem={onOpenItem}
      overlappingKeys={overlappingKeys}
      onNudge={onNudge}
      nudgedKeys={nudgedKeys}
    />
  )
}
