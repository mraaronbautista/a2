import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

interface Course {
  id: string
  name: string
}

interface AddNoteModalProps {
  householdId: string
  userId: string
  space: 'law' | 'personal'
  courses: Course[]
  onClose: () => void
}

export function AddNoteModal({ householdId, userId, space, courses, onClose }: AddNoteModalProps) {
  const navigate = useNavigate()
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
        course_id: space === 'law' ? courseId || null : null,
        type: space === 'law' ? type : 'freeform',
        title,
        visibility: 'shared',
        space,
      })
      .select('id')
      .single()

    setSaving(false)
    onClose()
    if (data) navigate(`/notes/${data.id}`)
  }

  return (
    <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        <h2 className="text-sm font-semibold text-navy">New note</h2>
        <input
          type="text"
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />

        {space === 'law' && (
          <div className="flex gap-2 text-xs">
            {(
              [
                ['freeform', 'Freeform'],
                ['case_brief', 'Case brief'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={['rounded-full px-3 py-1 font-medium', type === value ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {space === 'law' && courses.length > 0 && (
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
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-muted">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
