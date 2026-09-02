import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
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
import { usePartnerId } from '../hooks/usePartnerId'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { useSettings } from '../hooks/useSettings'
import { ChevronDownIcon, SettingsIcon, BellIcon } from '../components/layout/icons'
import { expandOccurrences } from '../lib/recurrence'
import { getOverlappingItemIds } from '../lib/overlap'
import type { AgendaItem } from '../components/calendar/types'
import { MonthView } from '../components/calendar/MonthView'
import { WeekView } from '../components/calendar/WeekView'
import { DayView } from '../components/calendar/DayView'
import { DateStrip } from '../components/calendar/DateStrip'
import { MonthYearPicker } from '../components/calendar/MonthYearPicker'
import { PullToRefresh } from '../components/layout/PullToRefresh'
import { TaskDetailModal } from '../components/agenda/TaskDetailModal'
import { EventDetailModal } from '../components/agenda/EventDetailModal'
import { TaskItem } from '../components/tasks/TaskItem'
import { NudgePickerButton } from '../components/us/NudgePickerButton'
import { NudgeRow } from '../components/us/NudgeRow'

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
  end_at: string | null
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

type NudgeStatus = 'sent' | 'on_it' | 'done' | 'later'

interface Nudge {
  id: string
  from_user_id: string
  to_user_id: string
  item_type: 'task' | 'reading' | 'note'
  item_id: string
  message: string | null
  status: NudgeStatus
  created_at: string
}

const DEFAULT_COLOR = '#5b6478'
const TASK_COLOR = '#d97a4d'
const REALTIME_TABLES = ['calendar_events', 'tasks', 'reading_items', 'reading_status', 'nudges']

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
  const partnerId = usePartnerId()
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
  const [nudgedKeys, setNudgedKeys] = useState<Set<string>>(new Set())
  const [nudgesOpen, setNudgesOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [openEventId, setOpenEventId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user || !householdId) return
    setLoading(true)

    const [eventsRes, tasksRes, readingsRes, coursesRes, nudgesRes] = await Promise.all([
      supabase.from('calendar_events').select('id, title, start_at, end_at, recurrence_rule, owner_id, color, courses(name, color)'),
      supabase.from('tasks').select('id, title, due_date, end_at, completed_at, owner_id'),
      supabase.from('reading_items').select('id, title, due_date, course_id, courses(name, color, owner_id)'),
      supabase.from('courses').select('id, name, color'),
      supabase
        .from('nudges')
        .select('id, from_user_id, to_user_id, item_type, item_id, message, status, created_at')
        .order('created_at', { ascending: false }),
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

  // Swipe left/right on Day view to step to the day before/after — same
  // result as tapping the next day in DateStrip, without needing that day
  // to already be scrolled into view. Deliberately a plain day step, not
  // shiftAnchor's week jump (the header ‹/› arrows use that; this mirrors
  // DateStrip's day-at-a-time semantics instead). Month view gets its own
  // copy below stepping months instead — small enough that sharing one
  // helper isn't worth the indirection.
  const daySwipeStart = useRef<{ x: number; y: number } | null>(null)
  const SWIPE_MIN_DISTANCE = 60

  function handleDaySwipeStart(e: TouchEvent) {
    const t = e.touches[0]
    daySwipeStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleDaySwipeEnd(e: TouchEvent) {
    const start = daySwipeStart.current
    daySwipeStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // Requires the gesture to be clearly more horizontal than vertical —
    // otherwise an ordinary vertical scroll through the timeline would
    // occasionally read as a stray day change.
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    // Swipe left (dx < 0) advances, swipe right goes back — the usual
    // carousel/calendar convention.
    setAnchorDate((d) => (dx > 0 ? subDays(d, 1) : addDays(d, 1)))
  }

  const monthSwipeStart = useRef<{ x: number; y: number } | null>(null)

  function handleMonthSwipeStart(e: TouchEvent) {
    const t = e.touches[0]
    monthSwipeStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleMonthSwipeEnd(e: TouchEvent) {
    const start = monthSwipeStart.current
    monthSwipeStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    setAnchorDate((d) => (dx > 0 ? subMonths(d, 1) : addMonths(d, 1)))
  }

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
        end: t.end_at ? new Date(t.end_at) : new Date(t.due_date as string),
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

  const overlappingKeys = useMemo(() => getOverlappingItemIds(agendaItems), [agendaItems])

  function openItem(item: AgendaItem) {
    if (item.kind === 'event') setOpenEventId(item.eventId)
    else if (item.kind === 'task') setOpenTaskId(item.eventId)
  }

  function ownerLabel(item: AgendaItem) {
    if (!user || item.ownerId === user.id) return undefined
    return profiles[item.ownerId]
  }

  async function nudgeTask(item: AgendaItem) {
    if (!user || !householdId || !partnerId) return
    setNudgedKeys((prev) => new Set(prev).add(item.key))
    await supabase.from('nudges').insert({
      household_id: householdId,
      from_user_id: user.id,
      to_user_id: partnerId,
      item_type: 'task',
      item_id: item.eventId,
      message: `Reminder: "${item.title}" is overdue`,
    })
  }

  // Nudges live here now (a bell in the header) rather than as their own
  // tab on Us — they're a notification center, and Timeline is where the
  // tasks/readings they point at actually live.
  const nudgeTitleFor = useMemo(() => {
    const taskMap = new Map(rawTasks.map((t) => [t.id, t.title]))
    const readingMap = new Map(rawReadings.map((r) => [r.id, r.title]))
    return (itemType: Nudge['item_type'], itemId: string) => {
      if (itemType === 'task') return taskMap.get(itemId) ?? '(deleted task)'
      if (itemType === 'reading') return readingMap.get(itemId) ?? '(deleted reading)'
      return '(note)'
    }
  }, [rawTasks, rawReadings])

  const nudgeableTasks = useMemo(() => rawTasks.map((t) => ({ id: t.id, title: t.title })), [rawTasks])
  const nudgeableReadings = useMemo(() => rawReadings.map((r) => ({ id: r.id, title: r.title })), [rawReadings])

  async function setNudgeStatus(nudgeId: string, status: NudgeStatus) {
    setNudges((prev) => prev.map((n) => (n.id === nudgeId ? { ...n, status } : n)))
    await supabase.from('nudges').update({ status, updated_at: new Date().toISOString() }).eq('id', nudgeId)
  }

  async function cancelNudge(nudgeId: string) {
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId))
    await supabase.from('nudges').delete().eq('id', nudgeId)
  }

  const partnerLabel = partnerId ? (profiles[partnerId] ?? 'partner') : 'partner'
  // "New" nudges sent to me that I haven't reacted to yet — the bell's
  // notification-center badge count.
  const unreadNudgeCount = nudges.filter((n) => n.to_user_id === user?.id && n.status === 'sent').length

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
    <PullToRefresh onRefresh={load}>
      <div className="mx-auto max-w-3xl space-y-4 p-6 pb-24">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setPickerOpen(true)}
            className="flex min-w-0 items-center gap-0.5 text-left text-xl font-semibold text-navy sm:text-2xl"
          >
            <span className="truncate">{periodLabel}</span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-ink-muted" />
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setNudgesOpen(true)}
              aria-label="Nudges"
              className="relative flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
            >
              <BellIcon className="h-4 w-4" />
              {unreadNudgeCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white">
                  {unreadNudgeCount}
                </span>
              )}
            </button>
            <button
              onClick={openSettings}
              aria-label="Settings"
              className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
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
  
        <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto">
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
          <div className="min-h-[60vh]" onTouchStart={handleMonthSwipeStart} onTouchEnd={handleMonthSwipeEnd}>
            <MonthView
              anchorDate={anchorDate}
              items={agendaItems}
              onSelectDay={(day) => {
                setAnchorDate(day)
                setView('day')
              }}
            />
          </div>
        )}
        {view === 'week' && <WeekView anchorDate={anchorDate} items={agendaItems} ownerLabel={ownerLabel} onOpenItem={openItem} />}
        {view === 'day' && (
          <div className="min-h-[60vh]" onTouchStart={handleDaySwipeStart} onTouchEnd={handleDaySwipeEnd}>
            <DayView
              anchorDate={anchorDate}
              items={agendaItems}
              ownerLabel={ownerLabel}
              onOpenItem={openItem}
              overlappingKeys={overlappingKeys}
              onNudge={nudgeTask}
              nudgedKeys={nudgedKeys}
            />
          </div>
        )}
  
        {openTaskId && user && householdId && (
          <TaskDetailModal
            taskId={openTaskId}
            userId={user.id}
            householdId={householdId}
            courses={courses}
            onClose={() => setOpenTaskId(null)}
            onSaved={() => {
              // Saving (or duplicating) no longer closes the modal — the
              // task keeps its read view open with the fresh data instead.
              // Only actions that end the interaction close it explicitly.
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

        {nudgesOpen && (
          <div
            className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center"
            onClick={() => setNudgesOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy">Nudges</h2>
                {user && householdId && (
                  <NudgePickerButton
                    householdId={householdId}
                    userId={user.id}
                    partnerId={partnerId}
                    partnerLabel={partnerLabel}
                    tasks={nudgeableTasks}
                    readings={nudgeableReadings}
                    onAdded={load}
                  />
                )}
              </div>

              {nudges.length === 0 ? (
                <p className="text-sm text-ink-muted">No nudges yet.</p>
              ) : (
                <ul className="space-y-2">
                  {nudges.map((n) => (
                    <NudgeRow
                      key={n.id}
                      title={nudgeTitleFor(n.item_type, n.item_id)}
                      itemType={n.item_type}
                      message={n.message}
                      status={n.status}
                      direction={n.to_user_id === user?.id ? 'received' : 'sent'}
                      otherPartyLabel={partnerLabel}
                      createdAt={n.created_at}
                      canReact={n.to_user_id === user?.id}
                      canCancel={n.from_user_id === user?.id}
                      onSetStatus={(status) => setNudgeStatus(n.id, status)}
                      onCancel={() => cancelNudge(n.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
