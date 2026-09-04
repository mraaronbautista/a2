import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabaseClient'
import type { Json } from '../../types/database'
import { useProfiles } from '../../hooks/useProfiles'
import { AttachmentIcon, DeleteIcon, DuplicateIcon, EditIcon } from '../layout/icons'
import { TaskComments, type TaskComment } from './TaskComments'

interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

interface Attachment {
  url: string
  name: string
}

interface Course {
  id: string
  name: string
}

interface TaskRow {
  id: string
  title: string
  description: string | null
  due_date: string | null
  end_at: string | null
  course_id: string | null
  visibility: 'private' | 'shared'
  owner_id: string
  checklist: ChecklistItem[]
  attachments: Attachment[]
  comments: TaskComment[]
}

interface TaskDetailModalProps {
  taskId: string
  userId: string
  householdId: string
  courses: Course[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TaskDetailModal({ taskId, userId, householdId, courses, onClose, onSaved, onDeleted }: TaskDetailModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const profiles = useProfiles()

  const [task, setTask] = useState<TaskRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  // Clicking a task opens a read view, not straight into editing — the
  // pencil icon below is the explicit way in.
  const [editing, setEditing] = useState(false)

  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [courseId, setCourseId] = useState('')
  const [notes, setNotes] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [newSubtask, setNewSubtask] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('id, title, description, due_date, end_at, course_id, visibility, owner_id, checklist, attachments, comments')
      .eq('id', taskId)
      .single()

    const t = data as TaskRow | null
    setTask(t)
    if (t) {
      setTitle(t.title)
      setDueAt(t.due_date ? toLocalInputValue(t.due_date) : '')
      setEndAt(t.end_at ? toLocalInputValue(t.end_at) : '')
      setCourseId(t.course_id ?? '')
      setNotes(t.description ?? '')
      setVisibility(t.visibility)
      setChecklist(t.checklist ?? [])
    }
    setDirty(false)
    setEditing(false)
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    load()
  }, [load])

  // A shared task is co-managed (RLS lets either partner update/delete
  // it) — private tasks are only ever fetchable by their owner anyway.
  const canManage = !!task && (task.owner_id === userId || task.visibility === 'shared')
  const courseName = courses.find((c) => c.id === task?.course_id)?.name

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setDirty(true)
    }
  }

  function nameFor(id: string) {
    return id === userId ? 'You' : (profiles[id] ?? 'Partner')
  }

  async function updateComments(next: TaskComment[]) {
    if (!task) return
    setTask({ ...task, comments: next })
    await supabase.from('tasks').update({ comments: next as unknown as Json }).eq('id', task.id)
  }

  function addSubtask() {
    const text = newSubtask.trim()
    if (!text) return
    markDirty(setChecklist)([...checklist, { id: crypto.randomUUID(), text, done: false }])
    setNewSubtask('')
  }

  function toggleSubtask(id: string) {
    markDirty(setChecklist)(checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)))
  }

  function removeSubtask(id: string) {
    markDirty(setChecklist)(checklist.filter((c) => c.id !== id))
  }

  async function handleSave() {
    if (!task) return
    setSaving(true)
    await supabase
      .from('tasks')
      .update({
        title,
        due_date: dueAt ? new Date(dueAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null,
        course_id: courseId || null,
        description: notes || null,
        visibility,
        checklist: checklist as unknown as Json,
      })
      .eq('id', task.id)
    setSaving(false)
    setDirty(false)
    setEditing(false)
    onSaved()
  }

  async function handleDelete() {
    if (!task || !window.confirm(`Delete "${task.title}"?`)) return
    await supabase.from('tasks').delete().eq('id', task.id)
    onDeleted()
  }

  // A fresh copy of the core content — not completion state, attachments,
  // or the comment thread, which belong to this specific occurrence, not
  // a new one.
  async function handleDuplicate() {
    if (!task) return
    setDuplicating(true)
    await supabase.from('tasks').insert({
      household_id: householdId,
      owner_id: userId,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      end_at: task.end_at,
      course_id: task.course_id,
      visibility: task.visibility,
      checklist: task.checklist.map((c) => ({ ...c, done: false })) as unknown as Json,
    })
    setDuplicating(false)
    onSaved()
    onClose()
  }

  async function handleAttachmentSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !task) return
    setUploading(true)

    const path = `${userId}/${crypto.randomUUID()}-${file.name}`
    const { error } = await supabase.storage.from('task-attachments').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('task-attachments').getPublicUrl(path)
      const nextAttachments = [...task.attachments, { url: data.publicUrl, name: file.name }]
      await supabase.from('tasks').update({ attachments: nextAttachments as unknown as Json }).eq('id', task.id)
      setTask({ ...task, attachments: nextAttachments })
    }
    setUploading(false)
  }

  async function removeAttachment(url: string) {
    if (!task) return
    const nextAttachments = task.attachments.filter((a) => a.url !== url)
    await supabase.from('tasks').update({ attachments: nextAttachments as unknown as Json }).eq('id', task.id)
    setTask({ ...task, attachments: nextAttachments })
  }

  return (
    <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        {loading || !task ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              {canManage && editing ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => markDirty(setTitle)(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent text-lg font-semibold text-navy outline-none focus:border-border focus:bg-bg focus:px-2 focus:py-1"
                />
              ) : (
                <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-navy">{title}</h2>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  aria-label="Edit"
                  className={['shrink-0', editing ? 'text-accent' : 'text-ink-muted hover:text-ink'].join(' ')}
                >
                  <EditIcon className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>

            {canManage && (
              <div className="flex items-center gap-3 text-ink-muted">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Add attachment"
                  className="hover:text-ink disabled:opacity-50"
                >
                  <AttachmentIcon className="h-[18px] w-[18px]" />
                </button>
                <input ref={fileInputRef} type="file" onChange={handleAttachmentSelect} className="hidden" />
                <button
                  type="button"
                  onClick={handleDuplicate}
                  disabled={duplicating}
                  aria-label="Duplicate"
                  className="hover:text-ink disabled:opacity-50"
                >
                  <DuplicateIcon className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={handleDelete} aria-label="Delete" className="hover:text-accent">
                  <DeleteIcon className="h-[18px] w-[18px]" />
                </button>
                {editing && (
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="ml-auto shrink-0 rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                  </button>
                )}
              </div>
            )}

            {canManage && editing ? (
              <>
                <label className="block text-xs text-ink-muted">
                  Starts
                  <div className="mt-1 flex gap-1">
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={(e) => markDirty(setDueAt)(e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                    />
                    {dueAt && (
                      <button
                        type="button"
                        onClick={() => markDirty(setDueAt)('')}
                        className="shrink-0 rounded-lg border border-border px-2 text-xs text-ink-muted hover:text-ink"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </label>

                <label className="block text-xs text-ink-muted">
                  Ends
                  <div className="mt-1 flex gap-1">
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => markDirty(setEndAt)(e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                    />
                    {endAt && (
                      <button
                        type="button"
                        onClick={() => markDirty(setEndAt)('')}
                        className="shrink-0 rounded-lg border border-border px-2 text-xs text-ink-muted hover:text-ink"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </label>

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

                <textarea
                  placeholder="Notes"
                  value={notes}
                  onChange={(e) => markDirty(setNotes)(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />

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
              <div className="space-y-1.5">
                {(task.due_date || task.end_at) && (
                  <p className="text-sm text-ink-muted">
                    {task.due_date && format(new Date(task.due_date), 'MMM d, h:mm a')}
                    {task.end_at ? ` – ${format(new Date(task.end_at), 'h:mm a')}` : ''}
                  </p>
                )}
                {courseName && <p className="text-sm text-ink-muted">{courseName}</p>}
                {notes && <p className="whitespace-pre-wrap text-sm text-ink">{notes}</p>}
                <span
                  className={[
                    'inline-block rounded-full px-2 py-0.5 text-xs capitalize',
                    visibility === 'shared' ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                  ].join(' ')}
                >
                  {visibility}
                </span>
              </div>
            )}

            <div>
              <span className="text-xs font-semibold text-ink-muted">Subtasks</span>
              <ul className="mt-1 space-y-1">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleSubtask(item.id)}
                      className="h-3.5 w-3.5 shrink-0 accent-accent"
                    />
                    <span className={['flex-1 text-sm', item.done ? 'text-ink-muted line-through' : 'text-ink'].join(' ')}>
                      {item.text}
                    </span>
                    {canManage && (
                      <button onClick={() => removeSubtask(item.id)} className="text-ink-muted hover:text-accent">
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canManage && (
                <div className="mt-2 flex gap-1">
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
                    placeholder="Add a subtask…"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                  />
                  <button onClick={addSubtask} className="rounded-lg bg-bg px-3 py-1 text-xs font-medium text-ink-muted">
                    Add
                  </button>
                </div>
              )}
            </div>

            {(task.attachments.length > 0 || uploading) && (
              <div>
                <span className="text-xs font-semibold text-ink-muted">Attachments</span>
                <ul className="mt-1 space-y-1">
                  {task.attachments.map((a) => (
                    <li key={a.url} className="flex items-center gap-2">
                      <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm text-accent underline">
                        {a.name}
                      </a>
                      {canManage && (
                        <button onClick={() => removeAttachment(a.url)} className="text-ink-muted hover:text-accent">
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                  {uploading && <li className="text-sm text-ink-muted">Uploading…</li>}
                </ul>
              </div>
            )}

            <TaskComments comments={task.comments ?? []} onChange={updateComments} meId={userId} nameFor={nameFor} />

            <div className="flex justify-end border-t border-border pt-3">
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
