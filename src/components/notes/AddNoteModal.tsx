import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { DEFAULT_PAGE_SETTINGS, type Orientation, type PaperSize } from '../../lib/pageSizes'

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

type NoteType = 'freeform' | 'case_brief' | 'paginated'

export function AddNoteModal({ householdId, userId, space, courses, onClose }: AddNoteModalProps) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<NoteType>('freeform')
  const [courseId, setCourseId] = useState('')
  const [paper, setPaper] = useState<PaperSize>(DEFAULT_PAGE_SETTINGS.paper)
  const [orientation, setOrientation] = useState<Orientation>(DEFAULT_PAGE_SETTINGS.orientation)
  const [saving, setSaving] = useState(false)

  const typeOptions: [NoteType, string][] =
    space === 'law'
      ? [
          ['freeform', 'Freeform'],
          ['case_brief', 'Case brief'],
          ['paginated', 'Paginated document'],
        ]
      : [
          ['freeform', 'Freeform'],
          ['paginated', 'Paginated document'],
        ]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    const resolvedType: NoteType = space === 'law' ? type : type === 'case_brief' ? 'freeform' : type

    const { data } = await supabase
      .from('notes')
      .insert({
        household_id: householdId,
        owner_id: userId,
        course_id: space === 'law' ? courseId || null : null,
        type: resolvedType,
        title,
        visibility: 'shared',
        space,
        page_settings: resolvedType === 'paginated' ? { paper, orientation, marginIn: DEFAULT_PAGE_SETTINGS.marginIn } : null,
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

        <div className="flex flex-wrap gap-2 text-xs">
          {typeOptions.map(([value, label]) => (
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

        {type === 'paginated' && (
          <div className="space-y-2 rounded-lg border border-border bg-bg p-2.5">
            <div className="flex gap-1.5 text-xs">
              {(['a4', 'letter'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPaper(p)}
                  className={['flex-1 rounded-full px-3 py-1 font-medium uppercase', paper === p ? 'bg-accent-bg text-accent' : 'bg-surface text-ink-muted'].join(
                    ' ',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 text-xs">
              {(['portrait', 'landscape'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrientation(o)}
                  className={[
                    'flex-1 rounded-full px-3 py-1 font-medium capitalize',
                    orientation === o ? 'bg-accent-bg text-accent' : 'bg-surface text-ink-muted',
                  ].join(' ')}
                >
                  {o}
                </button>
              ))}
            </div>
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
