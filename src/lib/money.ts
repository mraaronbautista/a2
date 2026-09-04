// Formats a peso amount, or masks it when hideBalances is on — a single
// place so every amount on the Budget screen (transactions, totals,
// account balances, net worth) masks consistently rather than each call
// site rolling its own placeholder.
export function formatPesos(amount: number, hidden: boolean): string {
  return hidden ? '₱••••' : `₱${amount.toFixed(2)}`
}
