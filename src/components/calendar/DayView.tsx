import { isSameDay } from 'date-fns'
import type { EventOccurrence } from './types'
import { DayEventList } from './DayEventList'

interface DayViewProps {
  anchorDate: Date
  occurrences: EventOccurrence[]
  ownerLabel: (occurrence: EventOccurrence) => string | undefined
}

export function DayView({ anchorDate, occurrences, ownerLabel }: DayViewProps) {
  return (
    <DayEventList
      date={anchorDate}
      occurrences={occurrences.filter((o) => isSameDay(o.start, anchorDate))}
      ownerLabel={ownerLabel}
      headingFormat="EEEE, MMMM d"
    />
  )
}
