import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { expandOccurrences } from '../lib/recurrence'
import type { EventOccurrence } from '../components/calendar/types'
import { MonthView } from '../components/calendar/MonthView'
import { WeekView } from '../components/calendar/WeekView'
import { DayView } from '../components/calendar/DayView'
import { AddEventButton } from '../components/calendar/AddEventButton'

type ViewMode = 'month' | 'week' | 'day'

interface RawEvent {
  id: string
  title: string
  start_at: string
  end_at: string | null
  recurrence_rule: string | null
  owner_id: string
  color: string | null
  courses: { name: string; color: string | null } | null
}

interface Course {
  id: string
  name: string
  color: string | null
}

const DEFAULT_COLOR = '#5b6478'

function rangeForView(view: ViewMode, anchorDate: Date) {
  if (view === 'month') {
    return {
      start: startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 }),
    }
  }
  if (view === 'week') {
    return { start: startOfWeek(anchorDate, { weekStartsOn: 0 }), end: endOfWeek(anchorDate, { weekStartsOn: 0 }) }
  }
  return { start: anchorDate, end: anchorDate }
}

function shiftAnchor(view: ViewMode, anchorDate: Date, direction: 1 | -1) {
  if (view === 'month') return direction === 1 ? addMonths(anchorDate, 1) : subMonths(anchorDate, 1)
  if (view === 'week') return direction === 1 ? addWeeks(anchorDate, 1) : subWeeks(anchorDate, 1)
  return direction === 1 ? addDays(anchorDate, 1) : subDays(anchorDate, 1)
}

export function Calendar() {
  const { user } = useAuth()
  const { householdId } = useHousehold()
  const profiles = useProfiles()

  const [view, setView] = useState<ViewMode>('month')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [mineOnly, setMineOnly] = useState(false)
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([])
  const [courses, setCourses] = useState<Course[]>([])

  const load = useCallback(async () => {
    if (!householdId) return

    const [eventsRes, coursesRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at, recurrence_rule, owner_id, color, courses(name, color)'),
      supabase.from('courses').select('id, name, color'),
    ])

    setRawEvents((eventsRes.data ?? []) as unknown as RawEvent[])
    setCourses((coursesRes.data ?? []) as Course[])
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  const occurrences = useMemo<EventOccurrence[]>(() => {
    const { start, end } = rangeForView(view, anchorDate)
    const rangeStart = subDays(start, 1)
    const rangeEnd = addDays(end, 1)

    const all = rawEvents.flatMap((event) => {
      const color = event.color ?? event.courses?.color ?? DEFAULT_COLOR
      return expandOccurrences(event.id, event.start_at, event.end_at, event.recurrence_rule, rangeStart, rangeEnd).map(
        (occurrence) => ({
          key: occurrence.key,
          eventId: event.id,
          title: event.title,
          start: occurrence.start,
          end: occurrence.end,
          color,
          ownerId: event.owner_id,
          courseName: event.courses?.name ?? null,
        }),
      )
    })

    return user ? (mineOnly ? all.filter((o) => o.ownerId === user.id) : all) : all
  }, [rawEvents, view, anchorDate, mineOnly, user])

  function ownerLabel(occurrence: EventOccurrence) {
    if (!user || occurrence.ownerId === user.id) return undefined
    return profiles[occurrence.ownerId]
  }

  const periodLabel =
    view === 'month'
      ? format(anchorDate, 'MMMM yyyy')
      : view === 'week'
        ? `${format(startOfWeek(anchorDate, { weekStartsOn: 0 }), 'MMM d')} – ${format(endOfWeek(anchorDate, { weekStartsOn: 0 }), 'MMM d')}`
        : format(anchorDate, 'EEEE, MMMM d')

  if (!householdId) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-navy">Calendar</h1>
        <div className="flex gap-1 rounded-full bg-surface p-1 text-xs">
          {(['Mine', 'Both'] as const).map((label) => (
            <button
              key={label}
              onClick={() => setMineOnly(label === 'Mine')}
              className={[
                'rounded-full px-3 py-1 font-medium',
                (label === 'Mine') === mineOnly ? 'bg-accent-bg text-accent' : 'text-ink-muted',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnchorDate(shiftAnchor(view, anchorDate, -1))}
            className="rounded-lg border border-border px-2 py-1 text-sm text-ink-muted hover:text-ink"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            onClick={() => setAnchorDate(new Date())}
            className="rounded-lg border border-border px-3 py-1 text-sm text-ink-muted hover:text-ink"
          >
            Today
          </button>
          <button
            onClick={() => setAnchorDate(shiftAnchor(view, anchorDate, 1))}
            className="rounded-lg border border-border px-2 py-1 text-sm text-ink-muted hover:text-ink"
            aria-label="Next"
          >
            ›
          </button>
          <span className="ml-1 text-sm font-medium text-ink">{periodLabel}</span>
        </div>

        <div className="flex gap-1 rounded-full bg-surface p-1 text-xs">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={['rounded-full px-3 py-1 font-medium capitalize', v === view ? 'bg-accent-bg text-accent' : 'text-ink-muted'].join(
                ' ',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <MonthView
          anchorDate={anchorDate}
          occurrences={occurrences}
          onSelectDay={(day) => {
            setAnchorDate(day)
            setView('day')
          }}
        />
      )}
      {view === 'week' && <WeekView anchorDate={anchorDate} occurrences={occurrences} ownerLabel={ownerLabel} />}
      {view === 'day' && <DayView anchorDate={anchorDate} occurrences={occurrences} ownerLabel={ownerLabel} />}

      {user && <AddEventButton householdId={householdId} userId={user.id} courses={courses} onAdded={load} />}
    </div>
  )
}
