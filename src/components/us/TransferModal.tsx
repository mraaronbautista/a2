import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Account } from './AccountModal'

interface TransferModalProps {
  householdId: string
  userId: string
  partnerId: string | null
  partnerLabel: string
  accounts: Account[]
  onClose: () => void
  onSaved: () => void
}

function todayDateString() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const KIND_VERB: Record<Account['kind'], string> = {
  asset: 'Move money',
  debt: 'Pay down',
  savings: 'Contribute to',
}

// A transfer between two accounts — moving cash around, paying down a
// debt, or contributing to a savings goal are all the same operation
// here, just with a different kind of destination account. Whether it
// counts toward the month's "spent" total is derived from that
// destination's kind (see BudgetView), not asked here.
export function TransferModal({ householdId, userId, partnerId, partnerLabel, accounts, onClose, onSaved }: TransferModalProps) {
  const [fromId, setFromId] = useState(accounts.find((a) => a.kind !== 'debt')?.id ?? accounts[0]?.id ?? '')
  const [toId, setToId] = useState(accounts.find((a) => a.kind !== 'asset' && a.id !== fromId)?.id ?? '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paidBy, setPaidBy] = useState(userId)
  const [splitMode, setSplitMode] = useState<'shared' | 'personal'>('personal')
  const [occurredOn, setOccurredOn] = useState(todayDateString())
  const [saving, setSaving] = useState(false)

  const toAccount = accounts.find((a) => a.id === toId)
  const verb = toAccount ? KIND_VERB[toAccount.kind] : 'Move money'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0 || !fromId || !toId || fromId === toId) return
    setSaving(true)

    await supabase.from('budget_transactions').insert({
      household_id: householdId,
      created_by: userId,
      type: 'transfer',
      amount: parsedAmount,
      description: description.trim() || null,
      account_id: fromId,
      to_account_id: toId,
      paid_by: paidBy,
      split_mode: splitMode,
      occurred_on: occurredOn,
    })

    setSaving(false)
    onSaved()
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
        <h2 className="text-sm font-semibold text-navy">{verb}</h2>

        <div>
          <span className="text-xs text-ink-muted">From</span>
          <select
            required
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="text-xs text-ink-muted">To</span>
          <select
            required
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
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
            <option value={userId}>You</option>
            {partnerId && <option value={partnerId}>{partnerLabel}</option>}
          </select>
        </div>

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

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-muted">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !amount || !fromId || !toId || fromId === toId}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  )
}
