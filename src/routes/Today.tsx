import { useCallback, useEffect, useState } from 'react'
import { endOfWeek, format, isPast, isToday } from 'date-fns'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { TaskItem } from '../components/tasks/TaskItem'
import { QuickAddButton } from '../components/tasks/QuickAddButton'

interface Task {
  id: string
  title: string
  due_date: string | null
  completed_at: string | null
}

interface ReadingItem {
  id: string
  title: string
  due_date: string | null
  course_id: string
  courses: { name: string; color: string | null } | null
}

interface Nudge {
  id: string
  message: string | null
  item_type: string
  from_user_id: string
}

function dueLabel(dueDate: string | null) {
  if (!dueDate) return undefined
  const date = new Date(dueDate)
  if (isToday(date)) return 'Today'
  if (isPast(date)) return 'Overdue'
  return format(date, 'EEE MMM d')
}

export function Today() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()

  const [tasks, setTasks] = useState<Task[]>([])
  const [readings, setReadings] = useState<ReadingItem[]>([])
  const [readingDone, setReadingDone] = useState<Set<string>>(new Set())
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !householdId) return
    setLoading(true)

    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()

    const [tasksRes, readingsRes, nudgesRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, due_date, completed_at')
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true }),
      supabase
        .from('reading_items')
        .select('id, title, due_date, course_id, courses(name, color)')
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true }),
      supabase
        .from('nudges')
        .select('id, message, item_type, from_user_id')
        .eq('to_user_id', user.id)
        .eq('status', 'sent'),
    ])

    const readingItems = (readingsRes.data ?? []) as unknown as ReadingItem[]

    setTasks((tasksRes.data ?? []) as Task[])
    setReadings(readingItems)
    setNudges((nudgesRes.data ?? []) as Nudge[])

    if (readingItems.length > 0) {
      const { data: statusRows } = await supabase
        .from('reading_status')
        .select('reading_item_id')
        .eq('user_id', user.id)
        .in(
          'reading_item_id',
          readingItems.map((r) => r.id),
        )
      setReadingDone(new Set((statusRows ?? []).map((r: { reading_item_id: string }) => r.reading_item_id)))
    } else {
      setReadingDone(new Set())
    }

    setLoading(false)
  }, [user, householdId])

  useEffect(() => {
    load()
  }, [load])

  async function toggleTask(task: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed_at: t.completed_at ? null : new Date().toISOString() } : t)),
    )
    await supabase
      .from('tasks')
      .update({ completed_at: task.completed_at ? null : new Date().toISOString() })
      .eq('id', task.id)
  }

  async function toggleReading(readingId: string) {
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

    if (isDone) {
      await supabase.from('reading_status').delete().eq('reading_item_id', readingId).eq('user_id', user.id)
    } else {
      await supabase
        .from('reading_status')
        .upsert({ reading_item_id: readingId, user_id: user.id, completed_at: new Date().toISOString() })
    }
  }

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

  const doneCount = readings.filter((r) => readingDone.has(r.id)).length

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Today</h1>
        {readings.length > 0 && (
          <p className="mt-1 text-sm text-ink-muted">
            {doneCount}/{readings.length} readings done this week
          </p>
        )}
      </div>

      {nudges.length > 0 && (
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

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing due this week.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                label={task.title}
                dueLabel={dueLabel(task.due_date)}
                checked={!!task.completed_at}
                onToggle={() => toggleTask(task)}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">Readings</h2>
        {readings.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing due this week.</p>
        ) : (
          <ul className="space-y-2">
            {readings.map((r) => (
              <TaskItem
                key={r.id}
                label={r.title}
                meta={r.courses?.name}
                dueLabel={dueLabel(r.due_date)}
                checked={readingDone.has(r.id)}
                onToggle={() => toggleReading(r.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {user && <QuickAddButton householdId={householdId} userId={user.id} onAdded={load} />}
    </div>
  )
}
