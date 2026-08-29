import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface QuickAddButtonProps {
  householdId: string
  userId: string
  onAdded: () => void
}

export function QuickAddButton({ householdId, userId, onAdded }: QuickAddButtonProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    await supabase.from('tasks').insert({
      household_id: householdId,
      owner_id: userId,
      title,
      due_date: dueDate || null,
      visibility,
    })

    setSaving(false)
    setOpen(false)
    setTitle('')
    setDueDate('')
    setVisibility('shared')
    onAdded()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg transition-transform hover:scale-105 md:bottom-8"
        aria-label="Quick add"
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/30 md:items-center" onClick={() => setOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-t-2xl border border-border bg-surface p-6 md:rounded-2xl"
          >
            <h2 className="text-sm font-semibold text-navy">Quick add task</h2>
            <input
              type="text"
              required
              autoFocus
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <div className="flex gap-2 text-xs">
              {(['shared', 'private'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={[
                    'rounded-full px-3 py-1 capitalize',
                    visibility === v ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                  ].join(' ')}
                >
                  {v}
                </button>
              ))}
            </div>
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
