import type { Account } from '../components/us/AccountModal'
import type { BudgetTransaction } from '../components/us/BudgetEntryModal'

// A debt account's starting_balance and every transaction that touches it
// move the "amount owed" in the opposite direction from an asset/savings
// account — flipping the sign once here means every other call site (net
// worth, the accounts list, the ledger effect of a single transaction)
// can treat all three account kinds the same way.
function sign(kind: Account['kind']) {
  return kind === 'debt' ? -1 : 1
}

export function accountBalance(account: Account, transactions: BudgetTransaction[]): number {
  const s = sign(account.kind)
  let balance = account.starting_balance
  for (const t of transactions) {
    if (t.account_id === account.id) {
      if (t.type === 'income') balance += s * t.amount
      else balance -= s * t.amount // expense or the outgoing side of a transfer
    }
    if (t.type === 'transfer' && t.to_account_id === account.id) {
      balance += s * t.amount
    }
  }
  return balance
}

export function netWorth(accounts: Account[], transactions: BudgetTransaction[]): number {
  let total = 0
  for (const a of accounts) {
    const balance = accountBalance(a, transactions)
    total += a.kind === 'debt' ? -balance : balance
  }
  return total
}
