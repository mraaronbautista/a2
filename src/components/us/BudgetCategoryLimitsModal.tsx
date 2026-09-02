import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { BUDGET_CATEGORIES } from '../../lib/budgetCategories'

interface BudgetCategoryLimitsModalProps {
  householdId: string
  categoryLimits: Record<string, number>
  onClose: () => void
  onSaved: () => void
}

export function BudgetCategoryLimitsModal({ householdId, categoryLimits, onClose, onSaved }: BudgetCategoryLimitsModalProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const c of BUDGET_CATEGORIES) {
      initial[c.label] = categoryLimits[c.label] != null ? String(categoryLimits[c.label]) : ''
    }
    return initial
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const next: Record<string, number> = {}
    for (const [label, draft] of Object.entries(drafts)) {
      const parsed = draft.trim() ? Number(draft) : NaN
      if (!Number.isNaN(parsed) && parsed > 0) next[label] = parsed
    }
    await supabase
      .from('budget_settings')
      .upsert({ household_id: householdId, category_limits: next, updated_at: new Date().toISOString() })
    setSaving(false)
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        <h2 className="text-sm font-semibold text-navy">Monthly limits by category</h2>
        <p className="text-xs text-ink-muted">Leave blank for no cap. The overall monthly budget is the sum of these.</p>

        <div className="space-y-2">
          {BUDGET_CATEGORIES.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="w-6 flex-none text-center text-base leading-none">{c.icon}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.label}</span>
              <div className="relative w-28 flex-none">
                <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-ink-muted">₱</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="None"
                  value={drafts[c.label]}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [c.label]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg py-1.5 pr-2 pl-5 text-right text-sm text-ink outline-none focus:border-accent"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
