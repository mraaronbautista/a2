import { format } from 'date-fns'
import type { AgendaItem } from './types'

interface EventChipProps {
  item: AgendaItem
  ownerLabel?: string
  dense?: boolean
  showCheckbox?: boolean
  onOpen?: () => void
}

export function EventChip({ item, ownerLabel, dense, showCheckbox, onOpen }: EventChipProps) {
  const checkable = showCheckbox && item.kind !== 'event' && item.onToggle
  const openable = showCheckbox && (item.kind === 'task' || item.kind === 'event') && onOpen

  return (
    <div
      onClick={openable ? onOpen : undefined}
      className={[
        'flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left',
        dense ? 'text-xs' : 'text-sm',
        openable ? 'cursor-pointer' : '',
      ].join(' ')}
      style={{ backgroundColor: `${item.color}26` }}
    >
      {checkable ? (
        <input
          type="checkbox"
          checked={!!item.completed}
          onChange={item.onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0 accent-accent"
        />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
      )}
      <span className={['truncate font-medium', item.completed ? 'text-ink-muted line-through' : 'text-ink'].join(' ')}>
        {item.title}
      </span>
      {/* Readings are date-only (no meaningful time-of-day); events and
          tasks can both carry a real time now. */}
      {item.kind !== 'reading' && <span className="shrink-0 text-ink-muted">{format(item.start, 'h:mma').toLowerCase()}</span>}
      {ownerLabel && <span className="shrink-0 truncate text-ink-muted">· {ownerLabel}</span>}
    </div>
  )
}
