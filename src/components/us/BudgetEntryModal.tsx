import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

export interface BudgetTransaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string | null
  paid_by: string
  split_mode: 'shared' | 'personal'
  occurred_on: string
}

interface BudgetEntryModalProps {
  householdId: string
  userId: string
  partnerId: string | null
  partnerLabel: string
  categories: string[]
  entry: BudgetTransaction | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

function todayDateString() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function BudgetEntryModal({
  householdId,
  userId,
  partnerId,
  partnerLabel,
  categories,
  entry,
  onClose,
  onSaved,
  onDeleted,
}: BudgetEntryModalProps) {
  const [type, setType] = useState<'income' | 'expense'>(entry?.type ?? 'expense')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [category, setCategory] = useState(entry?.category ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [paidBy, setPaidBy] = useState(entry?.paid_by ?? userId)
  const [splitMode, setSplitMode] = useState<'shared' | 'personal'>(entry?.split_mode ?? 'personal')
  const [occurredOn, setOccurredOn] = useState(entry?.occurred_on ?? todayDateString())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) return
    setSaving(true)

    const payload = {
      household_id: householdId,
      created_by: userId,
      type,
      amount: parsedAmount,
      category: category.trim() || 'Uncategorized',
      description: description.trim() || null,
      paid_by: paidBy,
      split_mode: splitMode,
      occurred_on: occurredOn,
    }

    if (entry) {
      await supabase
        .from('budget_transactions')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', entry.id)
    } else {
      await supabase.from('budget_transactions').insert(payload)
    }

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!entry) return
    if (!window.confirm('Delete this transaction?')) return
    setDeleting(true)
    await supabase.from('budget_transactions').delete().eq('id', entry.id)
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
        <h2 className="text-sm font-semibold text-navy">{entry ? 'Edit transaction' : 'Add transaction'}</h2>

        <div className="flex gap-2 text-xs">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={['rounded-full px-3 py-1 font-medium capitalize', type === t ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(
                ' ',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">₱</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg py-2 pr-3 pl-7 text-sm text-ink outline-none focus:border-accent"
          />
        </div>

        <input
          type="text"
          list="budget-categories"
          placeholder="Category (e.g. Rent, Groceries)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <datalist id="budget-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <input
          type="text"
          placeholder="Note (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />

        <div className="flex gap-2">
          <input
            type="date"
            required
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            <option value={userId}>You paid</option>
            {partnerId && <option value={partnerId}>{partnerLabel} paid</option>}
          </select>
        </div>

        {type === 'expense' && (
          <div className="flex gap-1 text-xs">
            {(
              [
                ['personal', 'Personal, not split'],
                ['shared', 'Split 50/50'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSplitMode(value)}
                className={['rounded-full px-3 py-1 font-medium', splitMode === value ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(
                  ' ',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {entry ? (
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
            <button type="submit" disabled={saving || !amount} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
