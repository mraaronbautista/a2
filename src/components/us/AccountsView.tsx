import { accountBalance, netWorth } from '../../lib/accountBalances'
import { formatPesos } from '../../lib/money'
import type { Account } from './AccountModal'
import type { BudgetTransaction } from './BudgetEntryModal'

interface AccountsViewProps {
  accounts: Account[]
  transactions: BudgetTransaction[]
  userId: string
  partnerId: string | null
  myLabel: string
  partnerLabel: string
  hideBalances: boolean
  onEdit: (account: Account) => void
  onTransfer: () => void
}

const SECTION_LABEL: Record<Account['kind'], string> = {
  asset: 'Assets',
  savings: 'Savings goals',
  debt: 'Debts',
}

export function AccountsView({
  accounts,
  transactions,
  userId,
  partnerId,
  myLabel,
  partnerLabel,
  hideBalances,
  onEdit,
  onTransfer,
}: AccountsViewProps) {
  const pesos = (n: number) => formatPesos(Math.abs(n), hideBalances)
  const active = accounts.filter((a) => !a.archived)
  const worth = netWorth(active, transactions)

  function ownerLabel(ownerId: string | null) {
    if (!ownerId) return null
    if (ownerId === userId) return myLabel === 'you' ? 'You' : myLabel
    if (ownerId === partnerId) return partnerLabel === 'partner' ? 'Partner' : partnerLabel
    return null
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs text-ink-muted">Net worth</p>
        <p className={['mt-1 text-2xl font-semibold', worth < 0 ? 'text-ink' : 'text-navy'].join(' ')}>
          {worth < 0 ? '-' : ''}
          {pesos(worth)}
        </p>
      </div>

      {active.length > 1 && (
        <button
          onClick={onTransfer}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-accent"
        >
          Move money / pay a debt / add to savings
        </button>
      )}

      {(['asset', 'savings', 'debt'] as const).map((kind) => {
        const inSection = active.filter((a) => a.kind === kind)
        if (inSection.length === 0) return null
        return (
          <div key={kind} className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-ink-muted">{SECTION_LABEL[kind]}</p>
            <ul className="space-y-2">
              {inSection.map((a) => {
                const balance = accountBalance(a, transactions)
                const pct = a.kind === 'savings' && a.target_amount ? Math.min(100, (balance / a.target_amount) * 100) : null
                return (
                  <li key={a.id}>
                    <button onClick={() => onEdit(a)} className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-left hover:border-accent">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-ink">
                          {a.name}
                          {ownerLabel(a.owner_id) && <span className="ml-1.5 text-xs text-ink-muted">· {ownerLabel(a.owner_id)}</span>}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-ink">
                          {kind === 'debt' && balance !== 0 ? '-' : ''}
                          {pesos(balance)}
                          {a.kind === 'savings' && a.target_amount ? ` / ${pesos(a.target_amount)}` : ''}
                        </span>
                      </div>
                      {pct != null && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-surface">
                          <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      {active.length === 0 && <p className="text-sm text-ink-muted">No accounts yet — add your first one.</p>}
    </div>
  )
}
