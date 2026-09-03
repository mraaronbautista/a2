import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { BUDGET_CATEGORIES, BUDGET_INCOME_CATEGORIES } from '../../lib/budgetCategories'
import type { Account } from './AccountModal'

export interface BudgetTransaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  category: string | null
  description: string | null
  paid_by: string
  split_mode: 'shared' | 'personal'
  occurred_on: string
  account_id: string | null
  to_account_id: string | null
}

interface BudgetEntryModalProps {
  householdId: string
  userId: string
  partnerId: string | null
  partnerLabel: string
  accounts: Account[]
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
  accounts,
  entry,
  onClose,
  onSaved,
  onDeleted,
}: BudgetEntryModalProps) {
  const [type, setType] = useState<'income' | 'expense'>(entry?.type === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [category, setCategory] = useState(entry?.category ?? '')
  const [customMode, setCustomMode] = useState(() => {
    if (!entry) return false
    const list = entry.type === 'income' ? BUDGET_INCOME_CATEGORIES : BUDGET_CATEGORIES
    return !list.some((c) => c.label === entry.category)
  })
  const [description, setDescription] = useState(entry?.description ?? '')
  const [accountId, setAccountId] = useState(entry?.account_id ?? accounts[0]?.id ?? '')
  const [paidBy, setPaidBy] = useState(entry?.paid_by ?? userId)
  const [splitMode, setSplitMode] = useState<'shared' | 'personal'>(entry?.split_mode ?? 'personal')
  const [occurredOn, setOccurredOn] = useState(entry?.occurred_on ?? todayDateString())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const categoryOptions = type === 'income' ? BUDGET_INCOME_CATEGORIES : BUDGET_CATEGORIES

  function switchType(next: 'income' | 'expense') {
    setType(next)
    const list = next === 'income' ? BUDGET_INCOME_CATEGORIES : BUDGET_CATEGORIES
    if (!list.some((c) => c.label === category)) {
      setCustomMode(false)
      setCategory('')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0 || !accountId) return
    setSaving(true)

    const payload = {
      household_id: householdId,
      created_by: userId,
      type,
      amount: parsedAmount,
      category: category.trim() || 'Uncategorized',
      description: description.trim() || null,
      account_id: accountId,
      to_account_id: null,
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

        {accounts.length === 0 ? (
          <p className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink-muted">
            Add an account first (Budget → Accounts) — every transaction needs one.
          </p>
        ) : (
          <>
            <div className="flex gap-2 text-xs">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchType(t)}
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

            <select
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {type === 'income' ? `Into ${a.name}` : `From ${a.name}`}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-1.5">
              {categoryOptions.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    setCustomMode(false)
                    setCategory(c.label)
                  }}
                  className={[
                    'flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center text-[11px] font-medium',
                    !customMode && category === c.label ? 'border-accent bg-accent-bg text-accent' : 'border-border bg-bg text-ink-muted',
                  ].join(' ')}
                >
                  <span className="text-lg leading-none">{c.icon}</span>
                  {c.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (!customMode) setCategory('')
                  setCustomMode(true)
                }}
                className={[
                  'flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center text-[11px] font-medium',
                  customMode ? 'border-accent bg-accent-bg text-accent' : 'border-border bg-bg text-ink-muted',
                ].join(' ')}
              >
                <span className="text-lg leading-none">✏️</span>
                Custom
              </button>
            </div>

            {customMode && (
              <input
                type="text"
                required
                autoFocus
                placeholder="Category name"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            )}

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
          </>
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
            <button
              type="submit"
              disabled={saving || !amount || !category.trim() || accounts.length === 0}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
