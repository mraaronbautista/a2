// Human label for a duration in minutes — 90 -> "1.5 hr", 45 -> "45 min",
// 4320 -> "3 days". A day-plus span reads as days (+ a leftover hr/min
// remainder, if any) rather than e.g. "72 hr".
export function formatDuration(minutes: number): string {
  if (!minutes) return ''
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440)
    const remainder = minutes % 1440
    const dayLabel = `${days} day${days > 1 ? 's' : ''}`
    return remainder ? `${dayLabel} ${formatDuration(remainder)}` : dayLabel
  }
  if (minutes % 60 === 0) return `${minutes / 60} hr`
  if (minutes > 60) return `${(minutes / 60).toFixed(1)} hr`
  return `${minutes} min`
}
