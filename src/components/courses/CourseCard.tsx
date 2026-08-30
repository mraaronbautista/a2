import { Link } from 'react-router-dom'

interface CourseCardProps {
  id: string
  name: string
  professor: string | null
  color: string | null
  readingCount: number
  isShared: boolean
}

export function CourseCard({ id, name, professor, color, readingCount, isShared }: CourseCardProps) {
  return (
    <Link
      to={`/courses/${id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
    >
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color ?? '#5b6478' }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{name}</p>
          {isShared && <span className="shrink-0 rounded-full bg-accent-bg px-1.5 py-0.5 text-[10px] text-accent">Classmates</span>}
        </div>
        {professor && <p className="truncate text-xs text-ink-muted">{professor}</p>}
      </div>
      <span className="shrink-0 text-xs text-ink-muted">
        {readingCount} reading{readingCount === 1 ? '' : 's'}
      </span>
    </Link>
  )
}
