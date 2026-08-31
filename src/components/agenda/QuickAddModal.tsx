import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Course {
  id: string
  name: string
  color: string | null
}

interface QuickAddModalProps {
  householdId: string
  userId: string
  courses: Course[]
  open: boolean
  onClose: () => void
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

export function QuickAddModal({ householdId, userId, courses, open, onClose, onAdded }: QuickAddModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [itemType, setItemType] = useState<'task' | 'event'>('task')
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [repeatDays, setRepeatDays] = useState<Set<string>>(new Set())
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared')
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [newSubtask, setNewSubtask] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  // Re-seed defaults to "now" each time the modal opens, rather than once
  // on mount — this modal is mounted once globally (in the nav) instead of
  // per-page, so a stale defaultDate would otherwise persist across opens.
  useEffect(() => {
    if (!open) return
    const now = new Date()
    setItemType('task')
    setTitle('')
    setCourseId('')
    setStartAt(toLocalInputValue(now))
    setEndAt('')
    setRepeatDays(new Set())
    setVisibility('shared')
    setSubtasks([])
    setNewSubtask('')
    setAttachments([])
  }, [open])

  function addSubtask() {
    const text = newSubtask.trim()
    if (!text) return
    setSubtasks((current) => [...current, text])
    setNewSubtask('')
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
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    if (itemType === 'task') {
      const checklist = subtasks.map((text) => ({ id: crypto.randomUUID(), text, done: false }))
      const { data: task } = await supabase
        .from('tasks')
        .insert({
          household_id: householdId,
          owner_id: userId,
          title,
          due_date: startAt ? new Date(startAt).toISOString() : null,
          end_at: endAt ? new Date(endAt).toISOString() : null,
          visibility,
          checklist,
        })
        .select('id')
        .single()

      if (task && attachments.length > 0) {
        const uploaded = await Promise.all(
          attachments.map(async (file) => {
            const path = `${userId}/${crypto.randomUUID()}-${file.name}`
            const { error } = await supabase.storage.from('task-attachments').upload(path, file)
            if (error) return null
            const { data } = supabase.storage.from('task-attachments').getPublicUrl(path)
            return { url: data.publicUrl, name: file.name }
          }),
        )
        const savedAttachments = uploaded.filter((attachment) => attachment !== null)
        if (savedAttachments.length > 0) {
          await supabase.from('tasks').update({ attachments: savedAttachments }).eq('id', task.id)
        }
      }
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
    onClose()
    onAdded()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        <input
          type="text"
          required
          placeholder={itemType === 'task' ? 'Task title' : 'Event title'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />

        {itemType === 'event' && courses.length > 0 && (
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

        {/* Stacked rather than side-by-side — a datetime-local input's
            native date+time+AM/PM rendering needs more width than a
            half-width column has, and was clipping. Tasks reuse the same
            Starts/Ends pair as events — a task is just a time block that
            defaults to no end, rather than a fundamentally different shape. */}
        <label className="block text-xs text-ink-muted">
          Start
          <input
            type="datetime-local"
            required
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          Due
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>

        <div className="flex gap-2 text-xs">
          {(['task', 'event'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setItemType(t)}
              className={[
                'rounded-full px-4 py-1.5 font-medium capitalize',
                itemType === t ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        {itemType === 'task' && (
          <>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">Attachments</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-accent"
                >
                  + Add
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  setAttachments((current) => [...current, ...files])
                  e.target.value = ''
                }}
              />
              {attachments.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {attachments.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm text-ink">
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                        className="text-ink-muted hover:text-accent"
                        aria-label={`Remove ${file.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <span className="text-xs text-ink-muted">Subtasks</span>
              {subtasks.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {subtasks.map((subtask, index) => (
                    <li key={`${subtask}-${index}`} className="flex items-center gap-2 text-sm text-ink">
                      <span className="h-3.5 w-3.5 shrink-0 rounded border border-border" />
                      <span className="min-w-0 flex-1">{subtask}</span>
                      <button
                        type="button"
                        onClick={() => setSubtasks((current) => current.filter((_, i) => i !== index))}
                        className="text-ink-muted hover:text-accent"
                        aria-label={`Remove ${subtask}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSubtask()
                    }
                  }}
                  placeholder="Add a subtask"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
                <button type="button" onClick={addSubtask} className="rounded-lg border border-border px-3 text-sm text-ink">
                  Add
                </button>
              </div>
            </div>
          </>
        )}

        {itemType === 'event' && (
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
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-muted">
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
  )
}
