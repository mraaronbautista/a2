import { format, isToday } from 'date-fns'
import type { EventOccurrence } from './types'
import { EventChip } from './EventChip'

interface DayEventListProps {
  date: Date
  occurrences: EventOccurrence[]
  ownerLabel: (occurrence: EventOccurrence) => string | undefined
  headingFormat?: string
}

export function DayEventList({ date, occurrences, ownerLabel, headingFormat = 'EEEE, MMM d' }: DayEventListProps) {
  const sorted = [...occurrences].sort((a, b) => a.start.getTime() - b.start.getTime())

  return (
    <div>
      <h3 className={['text-sm font-semibold', isToday(date) ? 'text-accent' : 'text-ink'].join(' ')}>
        {format(date, headingFormat)}
      </h3>
      <div className="mt-2 space-y-1.5">
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing scheduled.</p>
        ) : (
          sorted.map((o) => <EventChip key={o.key} occurrence={o} ownerLabel={ownerLabel(o)} />)
        )}
      </div>
    </div>
  )
}
