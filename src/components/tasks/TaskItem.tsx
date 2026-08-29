interface TaskItemProps {
  label: string
  meta?: string
  dueLabel?: string
  checked: boolean
  onToggle: () => void
}

export function TaskItem({ label, meta, dueLabel, checked, onToggle }: TaskItemProps) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 accent-accent"
      />
      <div className="min-w-0 flex-1">
        <p className={['truncate text-sm', checked ? 'text-ink-muted line-through' : 'text-ink'].join(' ')}>
          {label}
        </p>
        {meta && <p className="truncate text-xs text-ink-muted">{meta}</p>}
      </div>
      {dueLabel && <span className="shrink-0 text-xs text-ink-muted">{dueLabel}</span>}
    </li>
  )
}
