import { format, isToday } from 'date-fns'
import type { AgendaItem } from './types'
import { EventChip } from './EventChip'

interface DayEventListProps {
  date: Date
  items: AgendaItem[]
  ownerLabel: (item: AgendaItem) => string | undefined
  onOpenItem?: (item: AgendaItem) => void
  headingFormat?: string
}

export function DayEventList({ date, items, ownerLabel, onOpenItem, headingFormat = 'EEEE, MMM d' }: DayEventListProps) {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime())

  return (
    <div>
      <h3 className={['text-sm font-semibold', isToday(date) ? 'text-accent' : 'text-ink'].join(' ')}>
        {format(date, headingFormat)}
      </h3>
      <div className="mt-2 space-y-1.5">
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing scheduled.</p>
        ) : (
          sorted.map((item) => (
            <EventChip
              key={item.key}
              item={item}
              ownerLabel={ownerLabel(item)}
              showCheckbox
              onOpen={onOpenItem ? () => onOpenItem(item) : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}
