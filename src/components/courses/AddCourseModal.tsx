import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { COURSE_COLORS } from './colors'

interface AddCourseModalProps {
  householdId: string
  userId: string
  onAdded: () => void
  onClose: () => void
}

export function AddCourseModal({ householdId, userId, onAdded, onClose }: AddCourseModalProps) {
  const [name, setName] = useState('')
  const [professor, setProfessor] = useState('')
  const [color, setColor] = useState(COURSE_COLORS[0])
  const [isShared, setIsShared] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    await supabase.from('courses').insert({
      household_id: householdId,
      owner_id: userId,
      name,
      professor: professor || null,
      color,
      is_shared: isShared,
    })

    setSaving(false)
    onClose()
    onAdded()
  }

  return (
    <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        <h2 className="text-sm font-semibold text-navy">Add course</h2>
        <input
          type="text"
          required
          placeholder="Course name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <input
          type="text"
          placeholder="Professor (optional)"
          value={professor}
          onChange={(e) => setProfessor(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <div>
          <span className="text-xs text-ink-muted">Color</span>
          <div className="mt-1 flex gap-2">
            {COURSE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={['h-6 w-6 rounded-full', color === c ? 'ring-2 ring-offset-2 ring-offset-surface' : ''].join(' ')}
                style={{ backgroundColor: c, ...(color === c ? { ['--tw-ring-color' as string]: c } : {}) }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="accent-accent" />
          We're both in this course — share and co-manage the reading list
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-muted">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  )
}
