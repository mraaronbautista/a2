import { useCallback, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { iconForCategory } from '../../lib/budgetCategories'
import { formatPesos } from '../../lib/money'
import type { Account } from './AccountModal'
import type { BudgetTransaction } from './BudgetEntryModal'
import { scheduleLabel } from '../../lib/recurringSchedule'
import type { RecurringIncome } from './RecurringIncomeModal'

interface BudgetViewProps {
  userId: string
  partnerId: string | null
  myLabel: string
  partnerLabel: string
  hideBalances: boolean
  transactions: BudgetTransaction[]
  accounts: Account[]
  categoryLimits: Record<string, number>
  recurringIncome: RecurringIncome[]
  onEdit: (t: BudgetTransaction) => void
  onEditLimits: () => void
  onLogRecurring: (template: RecurringIncome) => void
  onEditRecurring: (template: RecurringIncome) => void
  onAddRecurring: () => void
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7)
}

const TRANSFER_ICON: Record<Account['kind'], string> = { debt: '💳', savings: '🎯', asset: '↔️' }

export function BudgetView({
  userId,
  partnerId,
  myLabel,
  partnerLabel,
  hideBalances,
  transactions,
  accounts,
  categoryLimits,
  recurringIncome,
  onEdit,
  onEditLimits,
  onLogRecurring,
  onEditRecurring,
  onAddRecurring,
}: BudgetViewProps) {
  const pesos = (n: number) => formatPesos(n, hideBalances)
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const thisMonth = currentMonthKey()
  const monthTransactions = useMemo(() => transactions.filter((t) => monthKey(t.occurred_on) === thisMonth), [transactions, thisMonth])

  // A transfer only counts as "spending" when it leaves the discretionary
  // pool for good — paying down a debt or putting money into a savings
  // goal. Moving cash between two of your own asset accounts is just
  // reallocation, not spending.
  const transferCountsAsSpend = useCallback(
    (t: BudgetTransaction) => {
      if (t.type !== 'transfer' || !t.to_account_id) return false
      const to = accountMap.get(t.to_account_id)
      return to?.kind === 'debt' || to?.kind === 'savings'
    },
    [accountMap],
  )

  // Narrower than transferCountsAsSpend, and only for the owes-balance
  // below: a debt payment settles a purchase that was already charged to
  // that account — and that charge already moved the balance once, as a
  // regular shared expense, when it happened. Counting the payoff too
  // would split the same money twice. A savings contribution has no such
  // earlier event to double up with, so it still counts.
  const transferCountsForBalance = useCallback(
    (t: BudgetTransaction) => {
      if (t.type !== 'transfer' || !t.to_account_id) return false
      return accountMap.get(t.to_account_id)?.kind === 'savings'
    },
    [accountMap],
  )

  const spentThisMonth = useMemo(
    () =>
      monthTransactions
        .filter((t) => t.type === 'expense' || transferCountsAsSpend(t))
        .reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions, transferCountsAsSpend],
  )

  const incomeThisMonth = useMemo(
    () => monthTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions],
  )

  const netThisMonth = incomeThisMonth - spentThisMonth

  // Who actually received the money this month, from paid_by on income
  // rows — a quiet breakdown, not a headline number.
  const incomeByPerson = useMemo(() => {
    let mine = 0
    let partners = 0
    for (const t of monthTransactions) {
      if (t.type !== 'income') continue
      if (t.paid_by === userId) mine += t.amount
      else if (t.paid_by === partnerId) partners += t.amount
    }
    return { mine, partners }
  }, [monthTransactions, userId, partnerId])

  // A recurring template counts as "logged this month" once any income
  // transaction shares its category + destination account — good enough
  // without demanding an exact amount match (overtime, a bonus, a partial
  // payment all still count).
  const expectedIncome = useMemo(() => {
    return recurringIncome.filter(
      (r) => !monthTransactions.some((t) => t.type === 'income' && t.category === r.category && t.account_id === r.account_id),
    )
  }, [recurringIncome, monthTransactions])

  // Last 6 months of income, oldest first — enough to notice "did the
  // freelance client pay late this month" without a full history browser.
  const incomeTrend = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({ key, label: format(d, 'MMM'), amount: 0 })
    }
    const byKey = new Map(months.map((m) => [m.key, m]))
    for (const t of transactions) {
      if (t.type !== 'income') continue
      const m = byKey.get(monthKey(t.occurred_on))
      if (m) m.amount += t.amount
    }
    return months
  }, [transactions])

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
      if (t.type !== 'expense' || !t.category) continue
      spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount)
    }
    const names = new Set([...spent.keys(), ...Object.keys(categoryLimits)])
    return [...names]
      .map((name) => ({ name, spent: spent.get(name) ?? 0, limit: categoryLimits[name] as number | undefined }))
      .sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name))
  }, [monthTransactions, categoryLimits])

  const incomeRows = useMemo(() => {
    const rows = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'income' || !t.category) continue
      rows.set(t.category, (rows.get(t.category) ?? 0) + t.amount)
    }
    return [...rows.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
  }, [monthTransactions])

  // Transfers this month that counted as spending, grouped by destination
  // account — "how much went toward debt/savings," separate from the
  // discretionary category breakdown above.
  const debtSavingsRows = useMemo(() => {
    const rows = new Map<string, number>()
    for (const t of monthTransactions) {
      if (!transferCountsAsSpend(t) || !t.to_account_id) continue
      const name = accountMap.get(t.to_account_id)?.name ?? 'Unknown'
      rows.set(name, (rows.get(name) ?? 0) + t.amount)
    }
    return [...rows.entries()].map(([name, amount]) => ({ name, amount }))
  }, [monthTransactions, transferCountsAsSpend, accountMap])

  const balance = useMemo(() => {
    let paidByMe = 0
    let paidByPartner = 0
    for (const t of transactions) {
      if (t.split_mode !== 'shared') continue
      if (t.type === 'income') continue
      if (t.type === 'transfer' && !transferCountsForBalance(t)) continue
      if (t.paid_by === userId) paidByMe += t.amount
      else if (t.paid_by === partnerId) paidByPartner += t.amount
    }
    return (paidByPartner - paidByMe) / 2
  }, [transactions, userId, partnerId, transferCountsForBalance])

  const recent = useMemo(() => [...transactions].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).slice(0, 20), [transactions])

  const overLimit = monthlyLimit != null && spentThisMonth > monthlyLimit

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-ink-muted">Spent</p>
            <button onClick={onEditLimits} className="text-xs text-ink-muted hover:text-ink">
              {monthlyLimit != null ? `/ ${pesos(monthlyLimit)}` : 'Set limits'}
            </button>
          </div>
          <p className="mt-1 text-xl font-semibold text-navy">{pesos(spentThisMonth)}</p>
          {monthlyLimit != null && (
            <>
              <div className="mt-2 h-1.5 rounded-full bg-bg">
                <div
                  className={['h-1.5 rounded-full', overLimit ? 'bg-navy' : 'bg-accent'].join(' ')}
                  style={{ width: `${Math.min(100, (spentThisMonth / monthlyLimit) * 100)}%` }}
                />
              </div>
              {overLimit && <p className="mt-1 text-xs text-ink-muted">Over by {pesos(spentThisMonth - monthlyLimit)}</p>}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">Income</p>
          <p className="mt-1 text-xl font-semibold text-accent">{pesos(incomeThisMonth)}</p>
          {partnerId && incomeThisMonth > 0 && (
            <p className="mt-1 text-[11px] text-ink-muted">
              {myLabel} {pesos(incomeByPerson.mine)} · {partnerLabel} {pesos(incomeByPerson.partners)}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">Net this month</p>
          <p className={['text-sm font-semibold', netThisMonth < 0 ? 'text-ink' : 'text-accent'].join(' ')}>
            {netThisMonth >= 0 ? '+' : '-'}
            {pesos(Math.abs(netThisMonth))}
          </p>
        </div>
      </div>

      {partnerId && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          {Math.abs(balance) < 0.01 ? (
            <p className="text-ink-muted">Settled up</p>
          ) : balance > 0 ? (
            <p className="text-ink">
              You owe {partnerLabel} <span className="font-semibold">{pesos(balance)}</span>
            </p>
          ) : (
            <p className="text-ink">
              {partnerLabel} owes you <span className="font-semibold">{pesos(Math.abs(balance))}</span>
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
                    {pesos(spent)}
                    {limit != null ? ` / ${pesos(limit)}` : ''}
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

      {debtSavingsRows.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">Toward debt & savings this month</p>
          {debtSavingsRows.map(({ name, amount }) => (
            <div key={name} className="flex items-center justify-between text-xs text-ink">
              <span>{name}</span>
              <span className="text-ink-muted">{pesos(amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">Expected this month</p>
          <button onClick={onAddRecurring} className="text-xs font-medium text-accent">
            + Recurring
          </button>
        </div>
        {expectedIncome.length === 0 ? (
          <p className="text-xs text-ink-muted">{recurringIncome.length === 0 ? 'No recurring income set up.' : 'All logged for this month.'}</p>
        ) : (
          expectedIncome.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
              <button onClick={() => onEditRecurring(r)} className="min-w-0 flex-1 truncate text-left text-ink hover:text-accent">
                {iconForCategory(r.category)} {r.label} · {scheduleLabel(r)}
              </button>
              <span className="shrink-0 text-ink-muted">{pesos(r.amount)}</span>
              <button
                onClick={() => onLogRecurring(r)}
                className="shrink-0 rounded-full bg-accent-bg px-2.5 py-1 font-medium text-accent"
              >
                Log it
              </button>
            </div>
          ))
        )}
      </div>

      {incomeRows.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">Income by source this month</p>
          {incomeRows.map(({ name, amount }) => (
            <div key={name} className="flex items-center justify-between text-xs text-ink">
              <span>
                {iconForCategory(name)} {name}
              </span>
              <span className="text-ink-muted">{pesos(amount)}</span>
            </div>
          ))}
        </div>
      )}

      {incomeTrend.some((m) => m.amount > 0) && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">Income, last 6 months</p>
          <div className="flex items-end justify-between gap-2" style={{ height: '64px' }}>
            {incomeTrend.map((m) => {
              const max = Math.max(...incomeTrend.map((x) => x.amount), 1)
              return (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t bg-accent" style={{ height: `${(m.amount / max) * 100}%`, minHeight: m.amount > 0 ? '2px' : 0 }} />
                  </div>
                  <span className="text-[10px] text-ink-muted">{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {recent.length === 0 ? (
        <p className="text-sm text-ink-muted">No transactions yet.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((t) => {
            const isTransfer = t.type === 'transfer'
            const toAccount = t.to_account_id ? accountMap.get(t.to_account_id) : undefined
            const fromAccount = t.account_id ? accountMap.get(t.account_id) : undefined
            const title = isTransfer
              ? `${TRANSFER_ICON[toAccount?.kind ?? 'asset']} ${fromAccount?.name ?? '?'} → ${toAccount?.name ?? '?'}`
              : `${iconForCategory(t.category ?? '')} ${t.category}`
            return (
              <li key={t.id}>
                <button
                  onClick={() => onEdit(t)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{title}</p>
                      {t.description && <p className="truncate text-xs text-ink-muted">{t.description}</p>}
                      {t.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-accent-bg px-1.5 py-0.5 text-[10px] font-medium text-accent">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={['shrink-0 text-sm font-semibold', t.type === 'income' ? 'text-accent' : 'text-ink'].join(' ')}>
                      {t.type === 'income' ? '+' : isTransfer ? '' : '-'}
                      {pesos(t.amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {format(parseISO(t.occurred_on), 'MMM d')} · {t.paid_by === userId ? 'You' : partnerLabel}
                    {t.split_mode === 'personal' ? ' · Personal' : ''}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
