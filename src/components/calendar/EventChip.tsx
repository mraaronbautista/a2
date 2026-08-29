import { format } from 'date-fns'
import type { EventOccurrence } from './types'

interface EventChipProps {
  occurrence: EventOccurrence
  ownerLabel?: string
  dense?: boolean
}

export function EventChip({ occurrence, ownerLabel, dense }: EventChipProps) {
  return (
    <div
      className={[
        'flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left',
        dense ? 'text-xs' : 'text-sm',
      ].join(' ')}
      style={{ backgroundColor: `${occurrence.color}26` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: occurrence.color }} />
      <span className="truncate font-medium text-ink">{occurrence.title}</span>
      <span className="shrink-0 text-ink-muted">{format(occurrence.start, 'h:mma').toLowerCase()}</span>
      {ownerLabel && <span className="shrink-0 truncate text-ink-muted">· {ownerLabel}</span>}
    </div>
  )
}
