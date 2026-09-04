export type RecurringFrequency = 'monthly' | 'weekly' | 'biweekly'

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Scheduled {
  frequency: RecurringFrequency
  day_of_month: number | null
  day_of_week: number | null
}

// A short "when" label for a recurring income template — pure reference
// text, same as day_of_month always was (nothing computes real dates
// from this; "expected this month" matching is category+account based).
export function scheduleLabel(r: Scheduled) {
  if (r.frequency === 'monthly') return `day ${r.day_of_month}`
  if (r.frequency === 'weekly') return `every ${WEEKDAY_LABELS[r.day_of_week ?? 0]}`
  return `every 2nd ${WEEKDAY_LABELS[r.day_of_week ?? 0]}`
}
