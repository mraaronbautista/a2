import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

export interface Account {
  id: string
  name: string
  kind: 'asset' | 'debt' | 'savings'
  target_amount: number | null
  starting_balance: number
  archived: boolean
}

interface AccountModalProps {
  householdId: string
  userId: string
  account: Account | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

const KIND_LABEL: Record<Account['kind'], string> = {
  asset: 'Asset (cash, bank, investment)',
  debt: 'Debt (credit card, loan)',
  savings: 'Savings goal',
}

export function AccountModal({ householdId, userId, account, onClose, onSaved, onDeleted }: AccountModalProps) {
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<Account['kind']>(account?.kind ?? 'asset')
  const [startingBalance, setStartingBalance] = useState(account ? String(account.starting_balance) : '')
  const [targetAmount, setTargetAmount] = useState(account?.target_amount != null ? String(account.target_amount) : '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)

    const payload = {
      household_id: householdId,
      created_by: userId,
      name: trimmed,
      kind,
      starting_balance: startingBalance.trim() ? Number(startingBalance) : 0,
      target_amount: kind === 'savings' && targetAmount.trim() ? Number(targetAmount) : null,
    }

    if (account) {
      await supabase.from('accounts').update(payload).eq('id', account.id)
    } else {
      await supabase.from('accounts').insert(payload)
    }

    setSaving(false)
    onSaved()
  }

  async function handleArchive() {
    if (!account) return
    if (!window.confirm(`Archive "${account.name}"? It'll disappear from the list but its transaction history stays intact.`)) return
    setDeleting(true)
    await supabase.from('accounts').update({ archived: true }).eq('id', account.id)
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
        <h2 className="text-sm font-semibold text-navy">{account ? 'Edit account' : 'Add account'}</h2>

        <input
          type="text"
          required
          autoFocus
          placeholder="Name (e.g. BPI Savings, Visa)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />

        <div className="flex flex-col gap-1.5 text-xs">
          {(['asset', 'debt', 'savings'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={[
                'rounded-lg border px-3 py-2 text-left font-medium',
                kind === k ? 'border-accent bg-accent-bg text-accent' : 'border-border bg-bg text-ink-muted',
              ].join(' ')}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div>
          <span className="text-xs text-ink-muted">{kind === 'debt' ? 'Current amount owed' : 'Current balance'}</span>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">₱</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg py-2 pr-3 pl-7 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
        </div>

        {kind === 'savings' && (
          <div>
            <span className="text-xs text-ink-muted">Target amount (optional)</span>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">₱</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="No target"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg py-2 pr-3 pl-7 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {account ? (
            <button
              type="button"
              onClick={handleArchive}
              disabled={deleting}
              className="text-sm text-ink-muted hover:text-accent disabled:opacity-50"
            >
              {deleting ? 'Archiving…' : 'Archive'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-muted">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
