import { Link } from 'react-router-dom'
import { format } from 'date-fns'

interface NoteCardProps {
  id: string
  title: string
  type: 'case_brief' | 'freeform'
  courseName: string | null
  courseColor: string | null
  visibility: 'private' | 'shared'
  updatedAt: string
  ownerLabel?: string
}

export function NoteCard({ id, title, type, courseName, courseColor, visibility, updatedAt, ownerLabel }: NoteCardProps) {
  return (
    <Link
      to={`/notes/${id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
    >
      {courseName && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: courseColor ?? '#5b6478' }} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title || 'Untitled'}</p>
        <p className="truncate text-xs text-ink-muted">
          {type === 'case_brief' ? 'Case brief' : 'Note'}
          {courseName ? ` · ${courseName}` : ''}
          {ownerLabel ? ` · ${ownerLabel}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
        {visibility === 'private' && <span className="rounded-full bg-bg px-2 py-0.5">Private</span>}
        <span>{format(new Date(updatedAt), 'MMM d')}</span>
      </div>
    </Link>
  )
}
