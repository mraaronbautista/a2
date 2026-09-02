import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { iconForCategory } from '../../lib/budgetCategories'
import type { BudgetTransaction } from './BudgetEntryModal'

interface BudgetViewProps {
  userId: string
  partnerId: string | null
  partnerLabel: string
  transactions: BudgetTransaction[]
  categoryLimits: Record<string, number>
  onEdit: (t: BudgetTransaction) => void
  onEditLimits: () => void
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7)
}

export function BudgetView({ userId, partnerId, partnerLabel, transactions, categoryLimits, onEdit, onEditLimits }: BudgetViewProps) {
  const thisMonth = currentMonthKey()
  const monthTransactions = useMemo(() => transactions.filter((t) => monthKey(t.occurred_on) === thisMonth), [transactions, thisMonth])

  const spentThisMonth = useMemo(
    () => monthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions],
  )

  // Rollup of whatever categories actually have a limit set — there's no
  // separate top-level number any more, see 0014_budget_category_limits.sql.
  const monthlyLimit = useMemo(() => {
    const values = Object.values(categoryLimits)
    return values.length ? values.reduce((a, b) => a + b, 0) : null
  }, [categoryLimits])

  // Union of categories actually spent in this month and categories with a
  // limit set — a capped category should still show "₱0 of ₱X" rather than
  // disappearing just because nothing's been logged against it yet.
  const categoryRows = useMemo(() => {
    const spent = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'expense') continue
      spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount)
    }
    const names = new Set([...spent.keys(), ...Object.keys(categoryLimits)])
    return [...names]
      .map((name) => ({ name, spent: spent.get(name) ?? 0, limit: categoryLimits[name] as number | undefined }))
      .sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name))
  }, [monthTransactions, categoryLimits])

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

  const overLimit = monthlyLimit != null && spentThisMonth > monthlyLimit

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-ink-muted">Spent this month</p>
          <button onClick={onEditLimits} className="text-xs text-ink-muted hover:text-ink">
            {monthlyLimit != null ? `of ₱${monthlyLimit.toFixed(2)} limit` : 'Set limits'}
          </button>
        </div>

        <p className="mt-1 text-2xl font-semibold text-navy">₱{spentThisMonth.toFixed(2)}</p>

        {monthlyLimit != null && (
          <>
            <div className="mt-2 h-1.5 rounded-full bg-bg">
              <div className={['h-1.5 rounded-full', overLimit ? 'bg-navy' : 'bg-accent'].join(' ')} style={{ width: `${Math.min(100, (spentThisMonth / monthlyLimit) * 100)}%` }} />
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

      {categoryRows.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted">By category this month</p>
            <button onClick={onEditLimits} className="text-xs font-medium text-accent">
              Edit limits
            </button>
          </div>
          {categoryRows.map(({ name, spent, limit }) => {
            const pct = limit ? Math.min(100, (spent / limit) * 100) : spentThisMonth ? (spent / spentThisMonth) * 100 : 0
            const over = limit != null && spent > limit
            return (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-ink">
                  <span>
                    {iconForCategory(name)} {name}
                  </span>
                  <span className="text-ink-muted">
                    ₱{spent.toFixed(2)}
                    {limit != null ? ` / ₱${limit.toFixed(2)}` : ''}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-bg">
                  <div className={['h-1.5 rounded-full', over ? 'bg-navy' : 'bg-accent'].join(' ')} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
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
                    <p className="truncate text-sm font-medium text-ink">
                      {iconForCategory(t.category)} {t.category}
                    </p>
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
