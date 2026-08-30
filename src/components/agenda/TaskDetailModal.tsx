import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

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
  course_id: string | null
  visibility: 'private' | 'shared'
  owner_id: string
  checklist: ChecklistItem[]
  attachments: Attachment[]
}

interface TaskDetailModalProps {
  taskId: string
  userId: string
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

export function TaskDetailModal({ taskId, userId, courses, onClose, onSaved, onDeleted }: TaskDetailModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [task, setTask] = useState<TaskRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [courseId, setCourseId] = useState('')
  const [notes, setNotes] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [newSubtask, setNewSubtask] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('id, title, description, due_date, course_id, visibility, owner_id, checklist, attachments')
      .eq('id', taskId)
      .single()

    const t = data as TaskRow | null
    setTask(t)
    if (t) {
      setTitle(t.title)
      setDueAt(t.due_date ? toLocalInputValue(t.due_date) : '')
      setCourseId(t.course_id ?? '')
      setNotes(t.description ?? '')
      setVisibility(t.visibility)
      setChecklist(t.checklist ?? [])
    }
    setDirty(false)
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    load()
  }, [load])

  const canManage = !!task && task.owner_id === userId

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setDirty(true)
    }
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
        course_id: courseId || null,
        description: notes || null,
        visibility,
        checklist,
      })
      .eq('id', task.id)
    setSaving(false)
    setDirty(false)
    onSaved()
  }

  async function handleDelete() {
    if (!task || !window.confirm(`Delete "${task.title}"?`)) return
    await supabase.from('tasks').delete().eq('id', task.id)
    onDeleted()
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
      await supabase.from('tasks').update({ attachments: nextAttachments }).eq('id', task.id)
      setTask({ ...task, attachments: nextAttachments })
    }
    setUploading(false)
  }

  async function removeAttachment(url: string) {
    if (!task) return
    const nextAttachments = task.attachments.filter((a) => a.url !== url)
    await supabase.from('tasks').update({ attachments: nextAttachments }).eq('id', task.id)
    setTask({ ...task, attachments: nextAttachments })
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 md:rounded-2xl"
      >
        {loading || !task ? (
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
                <label className="block text-xs text-ink-muted">
                  Due
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
              notes && <p className="text-sm text-ink-muted">{notes}</p>
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
              </ul>
              {canManage && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg bg-bg px-3 py-1 text-xs font-medium text-ink-muted disabled:opacity-50"
                  >
                    {uploading ? 'Uploading…' : '+ Add attachment'}
                  </button>
                  <input ref={fileInputRef} type="file" onChange={handleAttachmentSelect} className="hidden" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              {canManage ? (
                <button onClick={handleDelete} className="text-sm text-accent">
                  Delete task
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
