import { RRule } from 'rrule'

export interface Occurrence {
  key: string
  start: Date
  end: Date
}

// rrule computes BYDAY/BYHOUR etc. against a date's UTC components. To make
// recurrence follow local wall-clock time (e.g. "every Tue/Fri at 6:48am"
// regardless of UTC offset), we reinterpret local components as if they were
// UTC before handing dates to rrule, then reverse that when reading results.
function toFloatingUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()))
}

function fromFloatingUtc(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds())
}

/**
 * Expands a single calendar event into concrete occurrences within [rangeStart, rangeEnd].
 * `recurrenceRule` is the RRULE portion only (e.g. "FREQ=WEEKLY;BYDAY=TU,TH"), no DTSTART line.
 */
export function expandOccurrences(
  eventId: string,
  startAt: string,
  endAt: string | null,
  recurrenceRule: string | null,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const start = new Date(startAt)
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 60 * 60 * 1000)
  const durationMs = end.getTime() - start.getTime()

  if (!recurrenceRule) {
    if (end < rangeStart || start > rangeEnd) return []
    return [{ key: eventId, start, end }]
  }

  try {
    const rule = new RRule({ ...RRule.parseString(recurrenceRule), dtstart: toFloatingUtc(start) })
    const floatingDates = rule.between(toFloatingUtc(rangeStart), toFloatingUtc(rangeEnd), true)
    return floatingDates.map((floating) => {
      const occurrenceStart = fromFloatingUtc(floating)
      return {
        key: `${eventId}-${occurrenceStart.toISOString()}`,
        start: occurrenceStart,
        end: new Date(occurrenceStart.getTime() + durationMs),
      }
    })
  } catch {
    return []
  }
}
