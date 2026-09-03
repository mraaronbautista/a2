import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { usePartnerId } from '../hooks/usePartnerId'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { useSettings } from '../hooks/useSettings'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { SettingsIcon } from '../components/layout/icons'
import { BudgetView } from '../components/us/BudgetView'
import { BudgetEntryModal, type BudgetTransaction } from '../components/us/BudgetEntryModal'
import { BudgetCategoryLimitsModal } from '../components/us/BudgetCategoryLimitsModal'
import { AccountsView } from '../components/us/AccountsView'
import { AccountModal, type Account } from '../components/us/AccountModal'
import { TransferModal } from '../components/us/TransferModal'

const REALTIME_TABLES = ['budget_transactions', 'budget_settings', 'accounts']
const SUBVIEWS = ['overview', 'accounts'] as const
type SubView = (typeof SUBVIEWS)[number]

export function Budget() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()
  const partnerId = usePartnerId()
  const { openSettings } = useSettings()

  const [subView, setSubView] = useState<SubView>('overview')
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({})
  const [entry, setEntry] = useState<BudgetTransaction | 'new' | null>(null)
  const [accountModal, setAccountModal] = useState<Account | 'new' | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const [budgetRes, settingsRes, accountsRes] = await Promise.all([
      supabase
        .from('budget_transactions')
        .select('id, type, amount, category, description, paid_by, split_mode, occurred_on, account_id, to_account_id')
        .order('occurred_on', { ascending: false }),
      supabase.from('budget_settings').select('category_limits').eq('household_id', householdId).maybeSingle(),
      supabase.from('accounts').select('id, name, kind, target_amount, starting_balance, archived').order('created_at', { ascending: true }),
    ])

    setTransactions((budgetRes.data ?? []) as BudgetTransaction[])
    setCategoryLimits((settingsRes.data as { category_limits: Record<string, number> } | null)?.category_limits ?? {})
    setAccounts((accountsRes.data ?? []) as Account[])
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  // + adds a transaction on Overview, or a new account on Accounts —
  // transferring/paying down a debt has its own visible button there
  // instead, since it needs at least two existing accounts to make sense.
  useQuickAdd(subView === 'overview' ? () => setEntry('new') : () => setAccountModal('new'))

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  const partnerLabel = partnerId ? (profiles[partnerId] ?? 'partner') : 'partner'
  const activeAccounts = accounts.filter((a) => !a.archived)

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Budget</h1>
        <button onClick={openSettings} aria-label="Settings" className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden">
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-1 rounded-full bg-surface p-1 text-xs">
        {(
          [
            ['overview', 'Overview'],
            ['accounts', 'Accounts'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSubView(value)}
            className={['rounded-full px-3 py-1 font-medium', subView === value ? 'bg-accent-bg text-accent' : 'text-ink-muted'].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {subView === 'overview' && user && householdId && (
        <BudgetView
          userId={user.id}
          partnerId={partnerId}
          partnerLabel={partnerLabel}
          transactions={transactions}
          accounts={activeAccounts}
          categoryLimits={categoryLimits}
          onEdit={(t) => setEntry(t)}
          onEditLimits={() => setLimitsOpen(true)}
        />
      )}

      {subView === 'accounts' && (
        <AccountsView
          accounts={accounts}
          transactions={transactions}
          onEdit={(a) => setAccountModal(a)}
          onTransfer={() => setTransferOpen(true)}
        />
      )}

      {entry && householdId && user && (
        <BudgetEntryModal
          householdId={householdId}
          userId={user.id}
          partnerId={partnerId}
          partnerLabel={partnerLabel}
          accounts={activeAccounts}
          entry={entry === 'new' ? null : entry}
          onClose={() => setEntry(null)}
          onSaved={() => {
            setEntry(null)
            load()
          }}
          onDeleted={() => {
            setEntry(null)
            load()
          }}
        />
      )}

      {accountModal && householdId && user && (
        <AccountModal
          householdId={householdId}
          userId={user.id}
          account={accountModal === 'new' ? null : accountModal}
          onClose={() => setAccountModal(null)}
          onSaved={() => {
            setAccountModal(null)
            load()
          }}
          onDeleted={() => {
            setAccountModal(null)
            load()
          }}
        />
      )}

      {transferOpen && householdId && user && (
        <TransferModal
          householdId={householdId}
          userId={user.id}
          partnerId={partnerId}
          partnerLabel={partnerLabel}
          accounts={activeAccounts}
          onClose={() => setTransferOpen(false)}
          onSaved={() => {
            setTransferOpen(false)
            load()
          }}
        />
      )}

      {limitsOpen && householdId && (
        <BudgetCategoryLimitsModal
          householdId={householdId}
          categoryLimits={categoryLimits}
          onClose={() => setLimitsOpen(false)}
          onSaved={() => {
            setLimitsOpen(false)
            load()
          }}
        />
      )}
    </div>
  )
}
