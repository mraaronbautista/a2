import { useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabaseClient'

interface Course {
  id: string
  name: string
  color: string | null
}

interface QuickAddButtonProps {
  householdId: string
  userId: string
  courses: Course[]
  defaultDate: Date
  onAdded: () => void
}

const REPEAT_DAYS: { label: string; value: string }[] = [
  { label: 'Su', value: 'SU' },
  { label: 'Mo', value: 'MO' },
  { label: 'Tu', value: 'TU' },
  { label: 'We', value: 'WE' },
  { label: 'Th', value: 'TH' },
  { label: 'Fr', value: 'FR' },
  { label: 'Sa', value: 'SA' },
]

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function QuickAddButton({ householdId, userId, courses, defaultDate, onAdded }: QuickAddButtonProps) {
  const [open, setOpen] = useState(false)
  const [itemType, setItemType] = useState<'task' | 'event'>('task')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(format(defaultDate, 'yyyy-MM-dd'))
  const [courseId, setCourseId] = useState('')
  const [startAt, setStartAt] = useState(toLocalInputValue(defaultDate))
  const [endAt, setEndAt] = useState('')
  const [repeatDays, setRepeatDays] = useState<Set<string>>(new Set())
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared')
  const [saving, setSaving] = useState(false)

  function toggleRepeatDay(day: string) {
    setRepeatDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) {
        next.delete(day)
      } else {
        next.add(day)
      }
      return next
    })
  }

  function reset() {
    setTitle('')
    setDueDate(format(defaultDate, 'yyyy-MM-dd'))
    setCourseId('')
    setStartAt(toLocalInputValue(defaultDate))
    setEndAt('')
    setRepeatDays(new Set())
    setVisibility('shared')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    if (itemType === 'task') {
      await supabase.from('tasks').insert({
        household_id: householdId,
        owner_id: userId,
        title,
        due_date: dueDate || null,
        visibility,
      })
    } else {
      const course = courses.find((c) => c.id === courseId)
      const recurrenceRule = repeatDays.size > 0 ? `FREQ=WEEKLY;BYDAY=${[...repeatDays].join(',')}` : null

      await supabase.from('calendar_events').insert({
        household_id: householdId,
        owner_id: userId,
        course_id: courseId || null,
        title,
        start_at: new Date(startAt).toISOString(),
        end_at: endAt ? new Date(endAt).toISOString() : null,
        recurrence_rule: recurrenceRule,
        visibility,
        color: course?.color ?? null,
      })
    }

    setSaving(false)
    setOpen(false)
    reset()
    onAdded()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg transition-transform hover:scale-105 md:bottom-8"
        aria-label="Quick add"
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/30 md:items-center" onClick={() => setOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-t-2xl border border-border bg-surface p-6 md:rounded-2xl"
          >
            <div className="flex gap-2 text-xs">
              {(['task', 'event'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setItemType(t)}
                  className={[
                    'rounded-full px-3 py-1 font-medium capitalize',
                    itemType === t ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              type="text"
              required
              autoFocus
              placeholder={itemType === 'task' ? 'Task title' : 'Event title'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />

            {itemType === 'task' ? (
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            ) : (
              <>
                {courses.length > 0 && (
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  >
                    <option value="">No course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex gap-2">
                  <label className="flex-1 text-xs text-ink-muted">
                    Starts
                    <input
                      type="datetime-local"
                      required
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                  </label>
                  <label className="flex-1 text-xs text-ink-muted">
                    Ends
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                  </label>
                </div>

                <div>
                  <span className="text-xs text-ink-muted">Repeats weekly on</span>
                  <div className="mt-1 flex gap-1">
                    {REPEAT_DAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleRepeatDay(d.value)}
                        className={[
                          'h-7 w-7 rounded-full text-xs',
                          repeatDays.has(d.value) ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                        ].join(' ')}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 text-xs">
              {(['shared', 'private'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={[
                    'rounded-full px-3 py-1 capitalize',
                    visibility === v ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                  ].join(' ')}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-ink-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
              >
                {saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
