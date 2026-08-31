import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Course {
  id: string
  name: string
  color: string | null
}

interface EventRow {
  id: string
  title: string
  start_at: string
  end_at: string | null
  course_id: string | null
  recurrence_rule: string | null
  visibility: 'private' | 'shared'
  owner_id: string
}

interface EventDetailModalProps {
  eventId: string
  userId: string
  courses: Course[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
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

function toLocalInputValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseRepeatDays(rule: string | null): Set<string> {
  if (!rule) return new Set()
  const match = /BYDAY=([A-Z,]+)/.exec(rule)
  return new Set(match ? match[1].split(',') : [])
}

export function EventDetailModal({ eventId, userId, courses, onClose, onSaved, onDeleted }: EventDetailModalProps) {
  const [event, setEvent] = useState<EventRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [courseId, setCourseId] = useState('')
  const [repeatDays, setRepeatDays] = useState<Set<string>>(new Set())
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('calendar_events')
      .select('id, title, start_at, end_at, course_id, recurrence_rule, visibility, owner_id')
      .eq('id', eventId)
      .single()

    const e = data as EventRow | null
    setEvent(e)
    if (e) {
      setTitle(e.title)
      setStartAt(toLocalInputValue(e.start_at))
      setEndAt(e.end_at ? toLocalInputValue(e.end_at) : '')
      setCourseId(e.course_id ?? '')
      setRepeatDays(parseRepeatDays(e.recurrence_rule))
      setVisibility(e.visibility)
    }
    setDirty(false)
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  const canManage = !!event && event.owner_id === userId

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setDirty(true)
    }
  }

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
    setDirty(true)
  }

  async function handleSave() {
    if (!event) return
    setSaving(true)

    const course = courses.find((c) => c.id === courseId)
    const recurrenceRule = repeatDays.size > 0 ? `FREQ=WEEKLY;BYDAY=${[...repeatDays].join(',')}` : null

    await supabase
      .from('calendar_events')
      .update({
        title,
        start_at: new Date(startAt).toISOString(),
        end_at: endAt ? new Date(endAt).toISOString() : null,
        course_id: courseId || null,
        recurrence_rule: recurrenceRule,
        visibility,
        color: course?.color ?? null,
      })
      .eq('id', event.id)

    setSaving(false)
    setDirty(false)
    onSaved()
  }

  async function handleDelete() {
    if (!event || !window.confirm(`Delete "${event.title}"?`)) return
    await supabase.from('calendar_events').delete().eq('id', event.id)
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        {loading || !event ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              {canManage ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => markDirty(setTitle)(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent text-lg font-semibold text-navy outline-none focus:border-border focus:bg-bg focus:px-2 focus:py-1"
                />
              ) : (
                <h2 className="text-lg font-semibold text-navy">{title}</h2>
              )}
              {canManage && (
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-40"
                >
                  {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                </button>
              )}
            </div>

            {canManage ? (
              <>
                {courses.length > 0 && (
                  <select
                    value={courseId}
                    onChange={(e) => markDirty(setCourseId)(e.target.value)}
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

                {/* Stacked rather than side-by-side — a datetime-local
                    input's native date+time+AM/PM rendering needs more
                    width than a half-width column has, and was clipping. */}
                <label className="block text-xs text-ink-muted">
                  Starts
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => markDirty(setStartAt)(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-xs text-ink-muted">
                  Ends
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => markDirty(setEndAt)(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

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

                <div className="flex gap-2 text-xs">
                  {(['shared', 'private'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => markDirty(setVisibility)(v)}
                      className={[
                        'rounded-full px-3 py-1 capitalize',
                        visibility === v ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                      ].join(' ')}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                {toLocalInputValue(event.start_at).replace('T', ' ')}
                {event.end_at ? ` – ${toLocalInputValue(event.end_at).replace('T', ' ')}` : ''}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              {canManage ? (
                <button onClick={handleDelete} className="text-sm text-accent">
                  Delete event
                </button>
              ) : (
                <span />
              )}
              <button onClick={onClose} className="text-sm text-ink-muted hover:text-ink">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
