import { format, isSameDay, isToday } from 'date-fns'
import type { AgendaItem } from './types'
import { DayTimeline } from './DayTimeline'

interface DayViewProps {
  anchorDate: Date
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
  onOpenItem?: (item: AgendaItem) => void
}

export function DayView({ anchorDate, items, ownerLabel, onOpenItem }: DayViewProps) {
  return (
    <div>
      <h3 className={['mb-2 text-sm font-semibold', isToday(anchorDate) ? 'text-accent' : 'text-ink'].join(' ')}>
        {format(anchorDate, 'EEEE, MMMM d')}
      </h3>
      <DayTimeline items={items.filter((i) => isSameDay(i.start, anchorDate))} ownerLabel={ownerLabel} onOpenItem={onOpenItem} />
    </div>
  )
}
