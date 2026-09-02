const PREP_CYCLE = ['unprepped', 'prepped', 'cold_called'] as const
type PrepStatus = (typeof PREP_CYCLE)[number]

const PREP_LABEL: Record<PrepStatus, string> = {
  unprepped: 'Unprepped',
  prepped: 'Prepped',
  cold_called: 'Cold-called',
}

const PREP_CLASS: Record<PrepStatus, string> = {
  unprepped: 'bg-bg text-ink-muted border border-border',
  prepped: 'bg-accent-bg text-accent',
  cold_called: 'bg-navy text-bg',
}

function nextPrepStatus(status: PrepStatus): PrepStatus {
  return PREP_CYCLE[(PREP_CYCLE.indexOf(status) + 1) % PREP_CYCLE.length]
}

interface ReadingItemRowProps {
  title: string
  sourceLink: string | null
  dueDate: string | null
  completed: boolean
  prepStatus: PrepStatus
  canManage: boolean
  isFirst: boolean
  isLast: boolean
  onToggleRead: () => void
  onCyclePrep: (next: PrepStatus) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onAddNote: () => void
}

export function ReadingItemRow({
  title,
  sourceLink,
  dueDate,
  completed,
  prepStatus,
  canManage,
  isFirst,
  isLast,
  onToggleRead,
  onCyclePrep,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAddNote,
}: ReadingItemRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <input type="checkbox" checked={completed} onChange={onToggleRead} className="h-4 w-4 shrink-0 accent-accent" />

      <div className="min-w-0 flex-1">
        {sourceLink ? (
          <a
            href={sourceLink}
            target="_blank"
            rel="noreferrer"
            className={['truncate text-sm underline decoration-dotted underline-offset-2', completed ? 'text-ink-muted' : 'text-ink'].join(' ')}
          >
            {title}
          </a>
        ) : (
          <p className={['truncate text-sm', completed ? 'text-ink-muted line-through' : 'text-ink'].join(' ')}>{title}</p>
        )}
        {dueDate && <p className="text-xs text-ink-muted">{new Date(dueDate).toLocaleDateString()}</p>}
      </div>

      <button
        onClick={() => onCyclePrep(nextPrepStatus(prepStatus))}
        className={['shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', PREP_CLASS[prepStatus]].join(' ')}
      >
        {PREP_LABEL[prepStatus]}
      </button>

      <button onClick={onAddNote} className="shrink-0 text-xs text-ink-muted hover:text-accent" title="Start a note on this reading">
        + Note
      </button>

      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5 text-ink-muted">
          <button onClick={onMoveUp} disabled={isFirst} className="px-1 disabled:opacity-30" aria-label="Move up">
            ↑
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="px-1 disabled:opacity-30" aria-label="Move down">
            ↓
          </button>
          <button onClick={onDelete} className="px-1 hover:text-accent" aria-label="Delete">
            ×
          </button>
        </div>
      )}
    </li>
  )
}
