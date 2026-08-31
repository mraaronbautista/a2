import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface AddReadingButtonProps {
  courseId: string
  nextOrderIndex: number
  onAdded: () => void
}

export function AddReadingButton({ courseId, nextOrderIndex, onAdded }: AddReadingButtonProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [sourceLink, setSourceLink] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    await supabase.from('reading_items').insert({
      course_id: courseId,
      title,
      source_link: sourceLink || null,
      due_date: dueDate || null,
      order_index: nextOrderIndex,
    })

    setSaving(false)
    setOpen(false)
    setTitle('')
    setSourceLink('')
    setDueDate('')
    onAdded()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-accent hover:opacity-80">
        + Add reading
      </button>

      {open && (
        <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={() => setOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
          >
            <h2 className="text-sm font-semibold text-navy">Add reading</h2>
            <input
              type="text"
              required
              placeholder="Reading title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <input
              type="url"
              placeholder="Source link (optional)"
              value={sourceLink}
              onChange={(e) => setSourceLink(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-ink-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
              >
                {saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
