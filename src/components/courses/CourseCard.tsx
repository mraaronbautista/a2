import { Link } from 'react-router-dom'

interface CourseCardProps {
  id: string
  name: string
  professor: string | null
  color: string | null
  readingCount: number
}

export function CourseCard({ id, name, professor, color, readingCount }: CourseCardProps) {
  return (
    <Link
      to={`/courses/${id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
    >
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color ?? '#5b6478' }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        {professor && <p className="truncate text-xs text-ink-muted">{professor}</p>}
      </div>
      <span className="shrink-0 text-xs text-ink-muted">
        {readingCount} reading{readingCount === 1 ? '' : 's'}
      </span>
    </Link>
  )
}
