import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

interface Course {
  id: string
  name: string
}

interface AddNoteButtonProps {
  householdId: string
  userId: string
  courses: Course[]
}

export function AddNoteButton({ householdId, userId, courses }: AddNoteButtonProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'freeform' | 'case_brief'>('freeform')
  const [courseId, setCourseId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data } = await supabase
      .from('notes')
      .insert({
        household_id: householdId,
        owner_id: userId,
        course_id: courseId || null,
        type,
        title,
        visibility: 'private',
      })
      .select('id')
      .single()

    setSaving(false)
    setOpen(false)
    if (data) navigate(`/notes/${data.id}`)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        New note
      </button>

      {open && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/30 md:items-center" onClick={() => setOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-t-2xl border border-border bg-surface p-6 md:rounded-2xl"
          >
            <h2 className="text-sm font-semibold text-navy">New note</h2>
            <input
              type="text"
              required
              autoFocus
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />

            <div className="flex gap-2 text-xs">
              {([
                ['freeform', 'Freeform'],
                ['case_brief', 'Case brief'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={[
                    'rounded-full px-3 py-1 font-medium',
                    type === value ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            {courses.length > 0 && (
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">No course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-ink-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
