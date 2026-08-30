import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
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
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { useSettings } from '../hooks/useSettings'
import { ChevronDownIcon, SettingsIcon } from '../components/layout/icons'
import { expandOccurrences } from '../lib/recurrence'
import type { AgendaItem } from '../components/calendar/types'
import { MonthView } from '../components/calendar/MonthView'
import { WeekView } from '../components/calendar/WeekView'
import { DayView } from '../components/calendar/DayView'
import { DateStrip } from '../components/calendar/DateStrip'
import { MonthYearPicker } from '../components/calendar/MonthYearPicker'
import { TaskDetailModal } from '../components/agenda/TaskDetailModal'
import { EventDetailModal } from '../components/agenda/EventDetailModal'
import { TaskItem } from '../components/tasks/TaskItem'

type ViewMode = 'day' | 'week' | 'month'

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

interface RawTask {
  id: string
  title: string
  due_date: string | null
  completed_at: string | null
  owner_id: string
}

interface RawReading {
  id: string
  title: string
  due_date: string | null
  course_id: string
  courses: { name: string; color: string | null; owner_id: string } | null
}

interface Course {
  id: string
  name: string
  color: string | null
}

interface Nudge {
  id: string
  message: string | null
  item_type: string
  from_user_id: string
}

const DEFAULT_COLOR = '#5b6478'
const TASK_COLOR = '#d97a4d'
const REALTIME_TABLES = ['calendar_events', 'tasks', 'reading_items', 'reading_status']

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
  // Day mode jumps a full week at a time (same weekday) rather than one day
  // — the DateStrip below already shows the whole Sun-Sat week containing
  // anchorDate, so a single ‹/› press moving only one day just nudged the
  // selection inside a strip that hadn't otherwise changed. Pick a specific
  // day by tapping it in the strip instead.
  return direction === 1 ? addWeeks(anchorDate, 1) : subWeeks(anchorDate, 1)
}

export function Today() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()
  const { openSettings } = useSettings()

  const [view, setView] = useState<ViewMode>('day')
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()))
  const [mineOnly, setMineOnly] = useState(false)
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([])
  const [rawTasks, setRawTasks] = useState<RawTask[]>([])
  const [rawReadings, setRawReadings] = useState<RawReading[]>([])
  const [readingDone, setReadingDone] = useState<Set<string>>(new Set())
  const [courses, setCourses] = useState<Course[]>([])
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [loading, setLoading] = useState(true)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [openEventId, setOpenEventId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user || !householdId) return
    setLoading(true)

    const [eventsRes, tasksRes, readingsRes, coursesRes, nudgesRes] = await Promise.all([
      supabase.from('calendar_events').select('id, title, start_at, end_at, recurrence_rule, owner_id, color, courses(name, color)'),
      supabase.from('tasks').select('id, title, due_date, completed_at, owner_id'),
      supabase.from('reading_items').select('id, title, due_date, course_id, courses(name, color, owner_id)'),
      supabase.from('courses').select('id, name, color'),
      supabase.from('nudges').select('id, message, item_type, from_user_id').eq('to_user_id', user.id).eq('status', 'sent'),
    ])

    const readingItems = (readingsRes.data ?? []) as unknown as RawReading[]

    setRawEvents((eventsRes.data ?? []) as unknown as RawEvent[])
    setRawTasks((tasksRes.data ?? []) as RawTask[])
    setRawReadings(readingItems)
    setCourses((coursesRes.data ?? []) as Course[])
    setNudges((nudgesRes.data ?? []) as Nudge[])

    if (readingItems.length > 0) {
      const { data: statusRows } = await supabase
        .from('reading_status')
        .select('reading_item_id, completed_at')
        .eq('user_id', user.id)
        .in(
          'reading_item_id',
          readingItems.map((r) => r.id),
        )
      const done = (statusRows ?? []) as { reading_item_id: string; completed_at: string | null }[]
      setReadingDone(new Set(done.filter((r) => r.completed_at).map((r) => r.reading_item_id)))
    } else {
      setReadingDone(new Set())
    }

    setLoading(false)
  }, [user, householdId])

  useEffect(() => {
    load()
  }, [load])

  // The quick-add button now lives in the global nav (AppShell) instead of
  // this page, since it opens from every screen — it announces new items
  // this way rather than through a prop callback.
  useEffect(() => {
    window.addEventListener('a2:item-added', load)
    return () => window.removeEventListener('a2:item-added', load)
  }, [load])

  // Live sync — the partner's edits (a new event, a task checked off
  // elsewhere) show up here without a manual reload.
  useRealtimeRefresh(REALTIME_TABLES, load)

  const toggleTask = useCallback(async (task: RawTask) => {
    setRawTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed_at: t.completed_at ? null : new Date().toISOString() } : t)),
    )
    await supabase
      .from('tasks')
      .update({ completed_at: task.completed_at ? null : new Date().toISOString() })
      .eq('id', task.id)
  }, [])

  const toggleReading = useCallback(
    async (readingId: string) => {
      if (!user) return
      const isDone = readingDone.has(readingId)
      setReadingDone((prev) => {
        const next = new Set(prev)
        if (isDone) {
          next.delete(readingId)
        } else {
          next.add(readingId)
        }
        return next
      })
      await supabase
        .from('reading_status')
        .upsert({ reading_item_id: readingId, user_id: user.id, completed_at: isDone ? null : new Date().toISOString() })
    },
    [user, readingDone],
  )

  const agendaItems = useMemo<AgendaItem[]>(() => {
    const { start, end } = rangeForView(view, anchorDate)
    const rangeStart = subDays(start, 1)
    const rangeEnd = addDays(end, 1)

    const eventItems: AgendaItem[] = rawEvents.flatMap((event) => {
      const color = event.color ?? event.courses?.color ?? DEFAULT_COLOR
      return expandOccurrences(event.id, event.start_at, event.end_at, event.recurrence_rule, rangeStart, rangeEnd).map(
        (occurrence) => ({
          key: occurrence.key,
          kind: 'event' as const,
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

    const taskItems: AgendaItem[] = rawTasks
      .filter((t) => t.due_date)
      .map((t) => ({
        key: `task-${t.id}`,
        kind: 'task' as const,
        eventId: t.id,
        title: t.title,
        start: new Date(t.due_date as string),
        end: new Date(t.due_date as string),
        color: TASK_COLOR,
        ownerId: t.owner_id,
        courseName: null,
        completed: !!t.completed_at,
        onToggle: () => toggleTask(t),
      }))

    const readingItems: AgendaItem[] = rawReadings
      .filter((r) => r.due_date)
      .map((r) => ({
        key: `reading-${r.id}`,
        kind: 'reading' as const,
        eventId: r.id,
        title: r.title,
        start: new Date(r.due_date as string),
        end: new Date(r.due_date as string),
        color: r.courses?.color ?? DEFAULT_COLOR,
        ownerId: r.courses?.owner_id ?? '',
        courseName: r.courses?.name ?? null,
        completed: readingDone.has(r.id),
        onToggle: () => toggleReading(r.id),
      }))

    const all = [...eventItems, ...taskItems, ...readingItems]
    return user ? (mineOnly ? all.filter((i) => i.ownerId === user.id) : all) : all
  }, [rawEvents, rawTasks, rawReadings, readingDone, view, anchorDate, mineOnly, user, toggleTask, toggleReading])

  function openItem(item: AgendaItem) {
    if (item.kind === 'event') setOpenEventId(item.eventId)
    else if (item.kind === 'task') setOpenTaskId(item.eventId)
  }

  function ownerLabel(item: AgendaItem) {
    if (!user || item.ownerId === user.id) return undefined
    return profiles[item.ownerId]
  }

  const undatedTasks = rawTasks.filter((t) => !t.due_date && (!mineOnly || t.owner_id === user?.id))
  const undatedReadings = rawReadings.filter((r) => !r.due_date && (!mineOnly || r.courses?.owner_id === user?.id))

  const periodLabel =
    view === 'month'
      ? format(anchorDate, 'MMMM yyyy')
      : view === 'week'
        ? `${format(startOfWeek(anchorDate, { weekStartsOn: 0 }), 'MMM d')} – ${format(endOfWeek(anchorDate, { weekStartsOn: 0 }), 'MMM d, yyyy')}`
        : format(anchorDate, 'MMMM d, yyyy')

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  if (!householdId) {
    return (
      <div className="p-6 text-sm text-ink-muted">
        You're not part of a household yet. Ask Aaron to add you in Supabase.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6 pb-24">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setPickerOpen(true)}
          className="flex min-w-0 items-center gap-0.5 text-left text-xl font-semibold text-navy sm:text-2xl"
        >
          <span className="truncate">{periodLabel}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        </button>
        <button
          onClick={openSettings}
          aria-label="Settings"
          className="shrink-0 rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {pickerOpen && (
        <MonthYearPicker
          anchorDate={anchorDate}
          onSelect={(date) => {
            setAnchorDate(date)
            setView('month')
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            onClick={() => setAnchorDate(shiftAnchor(view, anchorDate, -1))}
            className="shrink-0 rounded-lg border border-border px-2 py-1 text-sm text-ink-muted hover:text-ink"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            onClick={() => setAnchorDate(startOfDay(new Date()))}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-sm text-ink-muted hover:text-ink sm:px-3"
          >
            Today
          </button>
          <button
            onClick={() => setAnchorDate(shiftAnchor(view, anchorDate, 1))}
            className="shrink-0 rounded-lg border border-border px-2 py-1 text-sm text-ink-muted hover:text-ink"
            aria-label="Next"
          >
            ›
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex gap-1 rounded-full bg-surface p-1 text-xs">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={['rounded-full px-2.5 py-1 font-medium capitalize sm:px-3', v === view ? 'bg-accent-bg text-accent' : 'text-ink-muted'].join(
                  ' ',
                )}
              >
                {v}
              </button>
            ))}
          </div>

          <select
            value={mineOnly ? 'mine' : 'both'}
            onChange={(e) => setMineOnly(e.target.value === 'mine')}
            aria-label="Filter by owner"
            className="rounded-full border border-transparent bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-muted outline-none focus:border-accent"
          >
            <option value="both">Both</option>
            <option value="mine">Mine</option>
          </select>
        </div>
      </div>

      {view === 'day' && <DateStrip selectedDate={anchorDate} onSelect={setAnchorDate} />}

      {view === 'day' && nudges.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-accent">Nudges</h2>
          <ul className="space-y-2">
            {nudges.map((n) => (
              <li key={n.id} className="rounded-xl bg-accent-bg px-4 py-3 text-sm text-ink">
                {n.message ?? `Flagged a ${n.item_type} for you`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === 'day' && (undatedTasks.length > 0 || undatedReadings.length > 0) && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-muted">No due date</h2>
          <ul className="space-y-2">
            {undatedTasks.map((task) => (
              <TaskItem
                key={task.id}
                label={task.title}
                checked={!!task.completed_at}
                onToggle={() => toggleTask(task)}
                onClick={() => setOpenTaskId(task.id)}
              />
            ))}
            {undatedReadings.map((r) => (
              <TaskItem
                key={r.id}
                label={r.title}
                meta={r.courses?.name ?? undefined}
                checked={readingDone.has(r.id)}
                onToggle={() => toggleReading(r.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {view === 'month' && (
        <MonthView
          anchorDate={anchorDate}
          items={agendaItems}
          onSelectDay={(day) => {
            setAnchorDate(day)
            setView('day')
          }}
        />
      )}
      {view === 'week' && <WeekView anchorDate={anchorDate} items={agendaItems} ownerLabel={ownerLabel} onOpenItem={openItem} />}
      {view === 'day' && <DayView anchorDate={anchorDate} items={agendaItems} ownerLabel={ownerLabel} onOpenItem={openItem} />}

      {openTaskId && user && (
        <TaskDetailModal
          taskId={openTaskId}
          userId={user.id}
          courses={courses}
          onClose={() => setOpenTaskId(null)}
          onSaved={() => {
            setOpenTaskId(null)
            load()
          }}
          onDeleted={() => {
            setOpenTaskId(null)
            load()
          }}
        />
      )}

      {openEventId && user && (
        <EventDetailModal
          eventId={openEventId}
          userId={user.id}
          courses={courses}
          onClose={() => setOpenEventId(null)}
          onSaved={() => {
            setOpenEventId(null)
            load()
          }}
          onDeleted={() => {
            setOpenEventId(null)
            load()
          }}
        />
      )}
    </div>
  )
}
