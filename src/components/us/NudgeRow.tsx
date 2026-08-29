import { format } from 'date-fns'

type Status = 'sent' | 'on_it' | 'done' | 'later'

const STATUS_LABEL: Record<Status, string> = {
  sent: 'New',
  on_it: 'On it',
  done: 'Done',
  later: 'Later',
}

const STATUS_CLASS: Record<Status, string> = {
  sent: 'bg-accent-bg text-accent',
  on_it: 'bg-navy text-bg',
  done: 'bg-bg text-ink-muted border border-border',
  later: 'bg-bg text-ink-muted border border-border',
}

interface NudgeRowProps {
  title: string
  itemType: 'task' | 'reading' | 'note'
  message: string | null
  status: Status
  direction: 'sent' | 'received'
  otherPartyLabel: string
  createdAt: string
  canReact: boolean
  canCancel: boolean
  onSetStatus: (status: Status) => void
  onCancel: () => void
}

export function NudgeRow({
  title,
  itemType,
  message,
  status,
  direction,
  otherPartyLabel,
  createdAt,
  canReact,
  canCancel,
  onSetStatus,
  onCancel,
}: NudgeRowProps) {
  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-muted">
            {direction === 'received' ? `${otherPartyLabel} flagged` : `You flagged`} this {itemType} for{' '}
            {direction === 'received' ? 'you' : otherPartyLabel}
          </p>
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          {message && <p className="mt-0.5 text-sm text-ink-muted">"{message}"</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={['rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CLASS[status]].join(' ')}>{STATUS_LABEL[status]}</span>
          {canCancel && (
            <button onClick={onCancel} className="text-ink-muted hover:text-accent" aria-label="Cancel nudge">
              ×
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-ink-muted">{format(new Date(createdAt), 'MMM d, h:mma').toLowerCase()}</span>
        {canReact && (
          <div className="flex gap-1">
            {(['on_it', 'later', 'done'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onSetStatus(s)}
                className={[
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  status === s ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}
