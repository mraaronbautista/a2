import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Item {
  id: string
  title: string
}

interface NudgePickerButtonProps {
  householdId: string
  userId: string
  partnerId: string | null
  partnerLabel: string
  tasks: Item[]
  readings: Item[]
  onAdded: () => void
}

export function NudgePickerButton({ householdId, userId, partnerId, partnerLabel, tasks, readings, onAdded }: NudgePickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [itemType, setItemType] = useState<'task' | 'reading'>('task')
  const [itemId, setItemId] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const items = itemType === 'task' ? tasks : readings

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!partnerId || !itemId) return
    setSaving(true)

    await supabase.from('nudges').insert({
      household_id: householdId,
      from_user_id: userId,
      to_user_id: partnerId,
      item_type: itemType,
      item_id: itemId,
      message: message || null,
    })

    setSaving(false)
    setOpen(false)
    setItemId('')
    setMessage('')
    onAdded()
  }

  if (!partnerId) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        Nudge {partnerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={() => setOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
          >
            <h2 className="text-sm font-semibold text-navy">Nudge {partnerLabel}</h2>

            <div className="flex gap-2 text-xs">
              {(['task', 'reading'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setItemType(t)
                    setItemId('')
                  }}
                  className={['rounded-full px-3 py-1 font-medium capitalize', itemType === t ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(
                    ' ',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <select
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="" disabled>
                {items.length === 0 ? `No ${itemType}s yet` : `Choose a ${itemType}…`}
              </option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Message (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-ink-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !itemId}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
              >
                {saving ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
