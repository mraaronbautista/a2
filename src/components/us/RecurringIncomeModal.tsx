import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { BUDGET_INCOME_CATEGORIES } from '../../lib/budgetCategories'
import type { Account } from './AccountModal'

export interface RecurringIncome {
  id: string
  label: string
  category: string
  amount: number
  account_id: string
  day_of_month: number
  paid_by: string
  archived: boolean
}

interface RecurringIncomeModalProps {
  householdId: string
  userId: string
  partnerId: string | null
  partnerLabel: string
  accounts: Account[]
  template: RecurringIncome | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export function RecurringIncomeModal({
  householdId,
  userId,
  partnerId,
  partnerLabel,
  accounts,
  template,
  onClose,
  onSaved,
  onDeleted,
}: RecurringIncomeModalProps) {
  const [label, setLabel] = useState(template?.label ?? '')
  const [category, setCategory] = useState(template?.category ?? BUDGET_INCOME_CATEGORIES[0].label)
  const [amount, setAmount] = useState(template ? String(template.amount) : '')
  const [accountId, setAccountId] = useState(template?.account_id ?? accounts[0]?.id ?? '')
  const [dayOfMonth, setDayOfMonth] = useState(template ? String(template.day_of_month) : '1')
  const [paidBy, setPaidBy] = useState(template?.paid_by ?? userId)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = label.trim()
    const parsedAmount = Number(amount)
    const day = Number(dayOfMonth)
    if (!trimmed || !parsedAmount || parsedAmount <= 0 || !accountId || day < 1 || day > 31) return
    setSaving(true)

    const payload = {
      household_id: householdId,
      created_by: userId,
      label: trimmed,
      category,
      amount: parsedAmount,
      account_id: accountId,
      day_of_month: day,
      paid_by: paidBy,
    }

    if (template) {
      await supabase.from('recurring_income').update(payload).eq('id', template.id)
    } else {
      await supabase.from('recurring_income').insert(payload)
    }

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!template) return
    if (!window.confirm(`Stop tracking "${template.label}" as recurring?`)) return
    setDeleting(true)
    await supabase.from('recurring_income').delete().eq('id', template.id)
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
        <h2 className="text-sm font-semibold text-navy">{template ? 'Edit recurring income' : 'New recurring income'}</h2>

        <input
          type="text"
          required
          autoFocus
          placeholder="Label (e.g. Salary, Allowance)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />

        <div className="grid grid-cols-3 gap-1.5">
          {BUDGET_INCOME_CATEGORIES.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setCategory(c.label)}
              className={[
                'flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center text-[11px] font-medium',
                category === c.label ? 'border-accent bg-accent-bg text-accent' : 'border-border bg-bg text-ink-muted',
              ].join(' ')}
            >
              <span className="text-lg leading-none">{c.icon}</span>
              {c.label}
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
            placeholder="Expected amount"
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
              Into {a.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <div className="flex-1">
            <span className="text-xs text-ink-muted">Day of month</span>
            <input
              type="number"
              required
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <span className="text-xs text-ink-muted">Received by</span>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              <option value={userId}>You</option>
              {partnerId && <option value={partnerId}>{partnerLabel}</option>}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          {template ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-ink-muted hover:text-accent disabled:opacity-50"
            >
              {deleting ? 'Removing…' : 'Stop tracking'}
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
              disabled={saving || !label.trim() || !amount || !accountId}
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
