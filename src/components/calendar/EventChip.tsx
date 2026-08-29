import { format } from 'date-fns'
import type { AgendaItem } from './types'

interface EventChipProps {
  item: AgendaItem
  ownerLabel?: string
  dense?: boolean
  showCheckbox?: boolean
}

export function EventChip({ item, ownerLabel, dense, showCheckbox }: EventChipProps) {
  const checkable = showCheckbox && item.kind !== 'event' && item.onToggle

  return (
    <div
      className={[
        'flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left',
        dense ? 'text-xs' : 'text-sm',
      ].join(' ')}
      style={{ backgroundColor: `${item.color}26` }}
    >
      {checkable ? (
        <input
          type="checkbox"
          checked={!!item.completed}
          onChange={item.onToggle}
          className="h-3.5 w-3.5 shrink-0 accent-accent"
        />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
      )}
      <span className={['truncate font-medium', item.completed ? 'text-ink-muted line-through' : 'text-ink'].join(' ')}>
        {item.title}
      </span>
      {/* Tasks/readings are date-only (no meaningful time-of-day), so only
          real calendar events get a time label. */}
      {item.kind === 'event' && <span className="shrink-0 text-ink-muted">{format(item.start, 'h:mma').toLowerCase()}</span>}
      {ownerLabel && <span className="shrink-0 truncate text-ink-muted">· {ownerLabel}</span>}
    </div>
  )
}
