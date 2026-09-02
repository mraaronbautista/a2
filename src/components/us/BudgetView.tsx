import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabaseClient'
import type { BudgetTransaction } from './BudgetEntryModal'

interface BudgetViewProps {
  householdId: string
  userId: string
  partnerId: string | null
  partnerLabel: string
  transactions: BudgetTransaction[]
  monthlyLimit: number | null
  onReload: () => void
  onEdit: (t: BudgetTransaction) => void
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7)
}

export function BudgetView({ householdId, userId, partnerId, partnerLabel, transactions, monthlyLimit, onReload, onEdit }: BudgetViewProps) {
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitDraft, setLimitDraft] = useState(monthlyLimit != null ? String(monthlyLimit) : '')
  const [savingLimit, setSavingLimit] = useState(false)

  const thisMonth = currentMonthKey()
  const monthTransactions = useMemo(() => transactions.filter((t) => monthKey(t.occurred_on) === thisMonth), [transactions, thisMonth])

  const spentThisMonth = useMemo(
    () => monthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions],
  )

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'expense') continue
      totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [monthTransactions])

  // Running until settled, not reset monthly — a balance only means
  // something as an all-time total of who's fronted more shared money.
  const balance = useMemo(() => {
    let paidByMe = 0
    let paidByPartner = 0
    for (const t of transactions) {
      if (t.type !== 'expense' || t.split_mode !== 'shared') continue
      if (t.paid_by === userId) paidByMe += t.amount
      else if (t.paid_by === partnerId) paidByPartner += t.amount
    }
    return (paidByPartner - paidByMe) / 2
  }, [transactions, userId, partnerId])

  const recent = useMemo(() => [...transactions].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).slice(0, 20), [transactions])

  async function saveLimit() {
    setSavingLimit(true)
    const parsed = limitDraft.trim() ? Number(limitDraft) : null
    await supabase
      .from('budget_settings')
      .upsert({ household_id: householdId, monthly_limit: parsed, updated_at: new Date().toISOString() })
    setSavingLimit(false)
    setEditingLimit(false)
    onReload()
  }

  const overLimit = monthlyLimit != null && spentThisMonth > monthlyLimit
  const progressPct = monthlyLimit ? Math.min(100, (spentThisMonth / monthlyLimit) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-ink-muted">Spent this month</p>
          {editingLimit ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                autoFocus
                placeholder="No limit"
                value={limitDraft}
                onChange={(e) => setLimitDraft(e.target.value)}
                className="w-24 rounded-lg border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
              />
              <button onClick={saveLimit} disabled={savingLimit} className="text-xs font-medium text-accent disabled:opacity-50">
                Save
              </button>
              <button onClick={() => setEditingLimit(false)} className="text-xs text-ink-muted">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setLimitDraft(monthlyLimit != null ? String(monthlyLimit) : '')
                setEditingLimit(true)
              }}
              className="text-xs text-ink-muted hover:text-ink"
            >
              {monthlyLimit != null ? `of ₱${monthlyLimit.toFixed(2)} limit` : 'Set a limit'}
            </button>
          )}
        </div>

        <p className="mt-1 text-2xl font-semibold text-navy">₱{spentThisMonth.toFixed(2)}</p>

        {monthlyLimit != null && (
          <>
            <div className="mt-2 h-1.5 rounded-full bg-bg">
              <div className={['h-1.5 rounded-full', overLimit ? 'bg-navy' : 'bg-accent'].join(' ')} style={{ width: `${progressPct}%` }} />
            </div>
            {overLimit && <p className="mt-1 text-xs text-ink-muted">Over by ₱{(spentThisMonth - monthlyLimit).toFixed(2)}</p>}
          </>
        )}
      </div>

      {partnerId && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          {Math.abs(balance) < 0.01 ? (
            <p className="text-ink-muted">Settled up</p>
          ) : balance > 0 ? (
            <p className="text-ink">
              You owe {partnerLabel} <span className="font-semibold">₱{balance.toFixed(2)}</span>
            </p>
          ) : (
            <p className="text-ink">
              {partnerLabel} owes you <span className="font-semibold">₱{Math.abs(balance).toFixed(2)}</span>
            </p>
          )}
        </div>
      )}

      {categoryTotals.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">By category this month</p>
          {categoryTotals.map(([cat, amt]) => (
            <div key={cat} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-ink">
                <span>{cat}</span>
                <span className="text-ink-muted">₱{amt.toFixed(2)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg">
                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${spentThisMonth ? (amt / spentThisMonth) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {recent.length === 0 ? (
        <p className="text-sm text-ink-muted">No transactions yet.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onEdit(t)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{t.category}</p>
                    {t.description && <p className="truncate text-xs text-ink-muted">{t.description}</p>}
                  </div>
                  <span className={['shrink-0 text-sm font-semibold', t.type === 'income' ? 'text-accent' : 'text-ink'].join(' ')}>
                    {t.type === 'income' ? '+' : '-'}₱{t.amount.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {format(parseISO(t.occurred_on), 'MMM d')} · {t.paid_by === userId ? 'You' : partnerLabel}
                  {t.split_mode === 'personal' ? ' · Personal' : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
