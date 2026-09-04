import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { usePartnerId } from '../hooks/usePartnerId'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { useSettings } from '../hooks/useSettings'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { useHideBalances } from '../hooks/useHideBalances'
import { EyeIcon, EyeOffIcon, SettingsIcon } from '../components/layout/icons'
import { BudgetView } from '../components/us/BudgetView'
import { BudgetEntryModal, type BudgetTransaction } from '../components/us/BudgetEntryModal'
import { BudgetCategoryLimitsModal } from '../components/us/BudgetCategoryLimitsModal'
import { AccountsView } from '../components/us/AccountsView'
import { AccountModal, type Account } from '../components/us/AccountModal'
import { TransferModal } from '../components/us/TransferModal'
import { RecurringIncomeModal, type RecurringIncome } from '../components/us/RecurringIncomeModal'

const REALTIME_TABLES = ['budget_transactions', 'budget_settings', 'accounts', 'recurring_income']
const SUBVIEWS = ['overview', 'accounts'] as const
type SubView = (typeof SUBVIEWS)[number]
const SWIPE_MIN_DISTANCE = 60

export function Budget() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()
  const partnerId = usePartnerId()
  const { openSettings } = useSettings()
  const { hideBalances, toggle: toggleHideBalances } = useHideBalances()

  const [subView, setSubView] = useState<SubView>('overview')
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([])
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({})
  const [entry, setEntry] = useState<BudgetTransaction | 'new' | null>(null)
  const [entryPrefill, setEntryPrefill] = useState<{ category: string; amount: number; account_id: string; paid_by: string } | undefined>(undefined)
  const [accountModal, setAccountModal] = useState<Account | 'new' | null>(null)
  const [recurringModal, setRecurringModal] = useState<RecurringIncome | 'new' | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const [budgetRes, settingsRes, accountsRes, recurringRes] = await Promise.all([
      supabase
        .from('budget_transactions')
        .select('id, type, amount, category, tags, description, paid_by, split_mode, occurred_on, account_id, to_account_id')
        .order('occurred_on', { ascending: false }),
      supabase.from('budget_settings').select('category_limits').eq('household_id', householdId).maybeSingle(),
      supabase.from('accounts').select('id, name, kind, target_amount, starting_balance, archived, owner_id').order('created_at', { ascending: true }),
      supabase
        .from('recurring_income')
        .select('id, label, category, amount, account_id, frequency, day_of_month, day_of_week, anchor_date, paid_by, archived')
        .order('created_at', { ascending: true }),
    ])

    setTransactions((budgetRes.data ?? []) as BudgetTransaction[])
    setCategoryLimits((settingsRes.data as { category_limits: Record<string, number> } | null)?.category_limits ?? {})
    setAccounts((accountsRes.data ?? []) as Account[])
    setRecurringIncome((recurringRes.data ?? []) as RecurringIncome[])
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  // Same gesture as Us's Goals/Thoughts swipe (touchstart/touchend only,
  // horizontal-dominance + minimum-distance check, no preventDefault) —
  // with only two sub-views, either direction just toggles between them.
  const subViewSwipeStart = useRef<{ x: number; y: number } | null>(null)

  function handleSubViewSwipeStart(e: ReactTouchEvent) {
    const t = e.touches[0]
    subViewSwipeStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleSubViewSwipeEnd(e: ReactTouchEvent) {
    const start = subViewSwipeStart.current
    subViewSwipeStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const idx = SUBVIEWS.indexOf(subView)
    const nextIdx = dx < 0 ? (idx + 1) % SUBVIEWS.length : (idx - 1 + SUBVIEWS.length) % SUBVIEWS.length
    setSubView(SUBVIEWS[nextIdx])
  }

  // + adds a transaction on Overview, or a new account on Accounts —
  // transferring/paying down a debt has its own visible button there
  // instead, since it needs at least two existing accounts to make sense.
  useQuickAdd(
    subView === 'overview'
      ? () => {
          setEntryPrefill(undefined)
          setEntry('new')
        }
      : () => setAccountModal('new'),
  )

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  const partnerLabel = partnerId ? (profiles[partnerId] ?? 'partner') : 'partner'
  const myLabel = user ? (profiles[user.id] ?? 'you') : 'you'
  const activeAccounts = accounts.filter((a) => !a.archived)

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Budget</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleHideBalances}
            aria-label={hideBalances ? 'Show balances' : 'Hide balances'}
            title={hideBalances ? 'Show balances' : 'Hide balances'}
            className="rounded-full p-1.5 text-ink-muted hover:text-ink"
          >
            {hideBalances ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
          <button onClick={openSettings} aria-label="Settings" className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
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

      <div onTouchStart={handleSubViewSwipeStart} onTouchEnd={handleSubViewSwipeEnd} className="space-y-4">
        {subView === 'overview' && user && householdId && (
          <BudgetView
            userId={user.id}
            partnerId={partnerId}
            myLabel={myLabel}
            partnerLabel={partnerLabel}
            hideBalances={hideBalances}
            transactions={transactions}
            accounts={activeAccounts}
            categoryLimits={categoryLimits}
            recurringIncome={recurringIncome.filter((r) => !r.archived)}
            onEdit={(t) => {
              setEntryPrefill(undefined)
              setEntry(t)
            }}
            onEditLimits={() => setLimitsOpen(true)}
            onLogRecurring={(template) => {
              setEntryPrefill({ category: template.category, amount: template.amount, account_id: template.account_id, paid_by: template.paid_by })
              setEntry('new')
            }}
            onEditRecurring={(template) => setRecurringModal(template)}
            onAddRecurring={() => setRecurringModal('new')}
          />
        )}

        {subView === 'accounts' && user && (
          <AccountsView
            accounts={accounts}
            transactions={transactions}
            userId={user.id}
            partnerId={partnerId}
            myLabel={myLabel}
            partnerLabel={partnerLabel}
            hideBalances={hideBalances}
            onEdit={(a) => setAccountModal(a)}
            onTransfer={() => setTransferOpen(true)}
          />
        )}
      </div>

      {entry && householdId && user && (
        <BudgetEntryModal
          householdId={householdId}
          userId={user.id}
          partnerId={partnerId}
          myLabel={myLabel}
          partnerLabel={partnerLabel}
          accounts={activeAccounts}
          entry={entry === 'new' ? null : entry}
          prefill={entry === 'new' ? entryPrefill : undefined}
          onClose={() => {
            setEntry(null)
            setEntryPrefill(undefined)
          }}
          onSaved={() => {
            setEntry(null)
            setEntryPrefill(undefined)
            load()
          }}
          onDeleted={() => {
            setEntry(null)
            setEntryPrefill(undefined)
            load()
          }}
        />
      )}

      {accountModal && householdId && user && (
        <AccountModal
          householdId={householdId}
          userId={user.id}
          partnerId={partnerId}
          myLabel={myLabel}
          partnerLabel={partnerLabel}
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

      {recurringModal && householdId && user && (
        <RecurringIncomeModal
          householdId={householdId}
          userId={user.id}
          partnerId={partnerId}
          myLabel={myLabel}
          partnerLabel={partnerLabel}
          accounts={activeAccounts}
          template={recurringModal === 'new' ? null : recurringModal}
          onClose={() => setRecurringModal(null)}
          onSaved={() => {
            setRecurringModal(null)
            load()
          }}
          onDeleted={() => {
            setRecurringModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}
