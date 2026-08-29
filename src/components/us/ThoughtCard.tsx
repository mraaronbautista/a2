import { useState } from 'react'
import { format } from 'date-fns'

interface Comment {
  id: string
  authorId: string
  body: string
  createdAt: string
}

interface ThoughtCardProps {
  body: string
  visibility: 'private' | 'shared'
  ownerId: string
  createdAt: string
  comments: Comment[]
  isOwn: boolean
  nameFor: (userId: string) => string
  onEdit: (body: string) => void
  onDelete: () => void
  onToggleShare: () => void
  onAddComment: (body: string) => void
  onAddToToday: () => void
  addedToToday: boolean
}

export function ThoughtCard({
  body,
  visibility,
  ownerId,
  createdAt,
  comments,
  isOwn,
  nameFor,
  onEdit,
  onDelete,
  onToggleShare,
  onAddComment,
  onAddToToday,
  addedToToday,
}: ThoughtCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(body)
  const [commentDraft, setCommentDraft] = useState('')

  function saveEdit() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onEdit(trimmed)
    setEditing(false)
  }

  function submitComment() {
    const trimmed = commentDraft.trim()
    if (!trimmed) return
    onAddComment(trimmed)
    setCommentDraft('')
  }

  return (
    <li className="space-y-2 rounded-xl border border-border bg-surface px-4 py-3">
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          autoFocus
          className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-ink">{body}</p>
      )}

      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          {nameFor(ownerId)} · {format(new Date(createdAt), 'MMM d')}
        </span>
        <span className={['rounded-full px-2 py-0.5', visibility === 'shared' ? 'bg-accent-bg text-accent' : 'bg-bg'].join(' ')}>
          {visibility === 'shared' ? 'Shared' : 'Only you'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onAddToToday}
          disabled={addedToToday}
          className="rounded-full bg-accent-bg px-3 py-1 text-xs font-medium text-accent disabled:opacity-50"
        >
          {addedToToday ? '✓ Added to Today' : 'Add to Today'}
        </button>
        {isOwn &&
          (editing ? (
            <>
              <button onClick={saveEdit} className="text-xs font-medium text-ink-muted hover:text-ink">
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setDraft(body)
                }}
                className="text-xs text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-xs text-ink-muted hover:text-ink">
                Edit
              </button>
              <button onClick={onToggleShare} className="text-xs text-ink-muted hover:text-ink">
                {visibility === 'shared' ? 'Make private' : 'Share'}
              </button>
              <button onClick={onDelete} className="text-xs text-ink-muted hover:text-accent">
                Unpin
              </button>
            </>
          ))}
      </div>

      {comments.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2">
          {comments.map((c) => (
            <li key={c.id} className="text-xs text-ink-muted">
              <span className="font-medium text-ink">{nameFor(c.authorId)}</span> {c.body}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitComment()
            }
          }}
          placeholder="Add a thought…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
        <button
          onClick={submitComment}
          disabled={!commentDraft.trim()}
          className="rounded-lg bg-bg px-3 py-1 text-xs font-medium text-ink-muted disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </li>
  )
}
