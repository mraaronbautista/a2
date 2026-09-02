import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

export interface Goal {
  id: string
  owner_id: string
  title: string
  target_date: string | null
  visibility: 'private' | 'shared'
  completed_at: string | null
}

interface GoalModalProps {
  householdId: string
  userId: string
  goal: Goal | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export function GoalModal({ householdId, userId, goal, onClose, onSaved, onDeleted }: GoalModalProps) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [visibility, setVisibility] = useState<'private' | 'shared'>(goal?.visibility ?? 'shared')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)

    const payload = {
      household_id: householdId,
      owner_id: userId,
      title: trimmed,
      target_date: targetDate || null,
      visibility,
    }

    if (goal) {
      await supabase.from('goals').update(payload).eq('id', goal.id)
    } else {
      await supabase.from('goals').insert(payload)
    }

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!goal) return
    if (!window.confirm('Delete this goal?')) return
    setDeleting(true)
    await supabase.from('goals').delete().eq('id', goal.id)
    setDeleting(false)
    onDeleted()
  }

  return (
    <div
      className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        <h2 className="text-sm font-semibold text-navy">{goal ? 'Edit goal' : 'New goal'}</h2>

        <input
          type="text"
          required
          autoFocus
          placeholder="What are we working toward?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />

        <div>
          <span className="text-xs text-ink-muted">Target date (optional)</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="flex gap-1 text-xs">
          {(['shared', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={['rounded-full px-3 py-1 font-medium capitalize', visibility === v ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(
                ' ',
              )}
            >
              {v === 'shared' ? 'Shared goal' : 'Just mine'}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          {goal ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-ink-muted hover:text-accent disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-muted">
              Cancel
            </button>
            <button type="submit" disabled={saving || !title.trim()} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
