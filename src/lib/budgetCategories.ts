export interface BudgetCategoryDef {
  label: string
  icon: string
}

// A short, tap-to-pick set instead of purely freeform typing — faster to
// log against, and a known set is what makes per-category limits possible
// (BudgetCategoryLimitsModal). "Custom" (handled separately, not in this
// list) still covers anything that doesn't fit.
export const BUDGET_CATEGORIES: BudgetCategoryDef[] = [
  { label: 'Food & Drink', icon: '🍽️' },
  { label: 'Transportation', icon: '🚌' },
  { label: 'Housing & Utilities', icon: '💡' },
  { label: 'School & Books', icon: '🎓' },
  { label: 'Personal Care', icon: '🧴' },
  { label: 'Shopping', icon: '🛍️' },
  { label: 'Health Care', icon: '🩺' },
  { label: 'Entertainment', icon: '🎬' },
  { label: 'Subscriptions', icon: '📱' },
  { label: 'Gifts', icon: '🎁' },
]

// A separate, much shorter list for income — "Food & Drink" makes no
// sense as a source of money coming in.
export const BUDGET_INCOME_CATEGORIES: BudgetCategoryDef[] = [
  { label: 'Salary', icon: '💼' },
  { label: 'Freelance', icon: '💻' },
  { label: 'Allowance', icon: '💵' },
  { label: 'Scholarship/Stipend', icon: '🎓' },
  { label: 'Reimbursement', icon: '🧾' },
  { label: 'Gift', icon: '🎁' },
  { label: 'Interest', icon: '📈' },
]

export function iconForCategory(category: string): string {
  return (
    BUDGET_CATEGORIES.find((c) => c.label === category)?.icon ??
    BUDGET_INCOME_CATEGORIES.find((c) => c.label === category)?.icon ??
    '🏷️'
  )
}
