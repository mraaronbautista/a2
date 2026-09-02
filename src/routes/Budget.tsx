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

const REALTIME_TABLES = ['budget_transactions', 'budget_settings']

export function Budget() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()
  const partnerId = usePartnerId()
  const { openSettings } = useSettings()

  const [transactions, setTransactions] = useState<BudgetTransaction[]>([])
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({})
  const [entry, setEntry] = useState<BudgetTransaction | 'new' | null>(null)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const [budgetRes, settingsRes] = await Promise.all([
      supabase
        .from('budget_transactions')
        .select('id, type, amount, category, description, paid_by, split_mode, occurred_on')
        .order('occurred_on', { ascending: false }),
      supabase.from('budget_settings').select('category_limits').eq('household_id', householdId).maybeSingle(),
    ])

    setTransactions((budgetRes.data ?? []) as BudgetTransaction[])
    setCategoryLimits((settingsRes.data as { category_limits: Record<string, number> } | null)?.category_limits ?? {})
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  useQuickAdd(() => setEntry('new'))

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  const partnerLabel = partnerId ? (profiles[partnerId] ?? 'partner') : 'partner'

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Budget</h1>
        <button onClick={openSettings} aria-label="Settings" className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden">
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {user && householdId && (
        <BudgetView
          userId={user.id}
          partnerId={partnerId}
          partnerLabel={partnerLabel}
          transactions={transactions}
          categoryLimits={categoryLimits}
          onEdit={(t) => setEntry(t)}
          onEditLimits={() => setLimitsOpen(true)}
        />
      )}

      {entry && householdId && user && (
        <BudgetEntryModal
          householdId={householdId}
          userId={user.id}
          partnerId={partnerId}
          partnerLabel={partnerLabel}
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
