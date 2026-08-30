import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import type { JSONContent } from '@tiptap/react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useProfiles } from '../hooks/useProfiles'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { RichTextEditor } from '../components/notes/RichTextEditor'
import { CaseBriefFields, type CaseBrief } from '../components/notes/CaseBriefFields'

const REALTIME_TABLES = ['notes']

interface Course {
  id: string
  name: string
}

interface NoteRow {
  id: string
  title: string
  type: 'case_brief' | 'freeform'
  visibility: 'private' | 'shared'
  owner_id: string
  last_edited_by: string | null
  course_id: string | null
  tags: string[]
  updated_at: string
  content: JSONContent | null
  case_brief_facts: string | null
  case_brief_issue: string | null
  case_brief_holding: string | null
  case_brief_reasoning: string | null
  case_brief_dissent: string | null
}

export function NoteDetail() {
  const { noteId } = useParams<{ noteId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const profiles = useProfiles()

  const [note, setNote] = useState<NoteRow | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private')
  const [tagsInput, setTagsInput] = useState('')
  const [content, setContent] = useState<JSONContent | null>(null)
  const [caseBrief, setCaseBrief] = useState<CaseBrief>({ facts: '', issue: '', holding: '', reasoning: '', dissent: '' })

  const load = useCallback(async () => {
    if (!noteId) return
    setLoading(true)

    const [noteRes, coursesRes] = await Promise.all([
      supabase
        .from('notes')
        .select(
          'id, title, type, visibility, owner_id, last_edited_by, course_id, tags, updated_at, content, case_brief_facts, case_brief_issue, case_brief_holding, case_brief_reasoning, case_brief_dissent',
        )
        .eq('id', noteId)
        .single(),
      supabase.from('courses').select('id, name'),
    ])

    const n = (noteRes.data ?? null) as NoteRow | null
    setNote(n)
    setCourses((coursesRes.data ?? []) as Course[])

    if (n) {
      setTitle(n.title)
      setCourseId(n.course_id ?? '')
      setVisibility(n.visibility)
      setTagsInput((n.tags ?? []).join(', '))
      setContent(n.content)
      setCaseBrief({
        facts: n.case_brief_facts ?? '',
        issue: n.case_brief_issue ?? '',
        holding: n.case_brief_holding ?? '',
        reasoning: n.case_brief_reasoning ?? '',
        dissent: n.case_brief_dissent ?? '',
      })
    }

    setDirty(false)
    setLoading(false)
  }, [noteId])

  useEffect(() => {
    load()
  }, [load])

  // Skip the live refresh while there are unsaved local edits — pulling the
  // partner's version mid-edit would silently overwrite what's being typed.
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  const handleRealtimeChange = useCallback(() => {
    if (!dirtyRef.current) load()
  }, [load])
  useRealtimeRefresh(REALTIME_TABLES, handleRealtimeChange)

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setDirty(true)
    }
  }

  async function handleSave() {
    if (!note || !user) return
    setSaving(true)

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const updatedAt = new Date().toISOString()

    await supabase
      .from('notes')
      .update({
        title,
        course_id: courseId || null,
        visibility,
        tags,
        content: note.type === 'freeform' ? content : null,
        case_brief_facts: note.type === 'case_brief' ? caseBrief.facts : null,
        case_brief_issue: note.type === 'case_brief' ? caseBrief.issue : null,
        case_brief_holding: note.type === 'case_brief' ? caseBrief.holding : null,
        case_brief_reasoning: note.type === 'case_brief' ? caseBrief.reasoning : null,
        case_brief_dissent: note.type === 'case_brief' ? caseBrief.dissent : null,
        last_edited_by: user.id,
        updated_at: updatedAt,
      })
      .eq('id', note.id)

    setNote((prev) => (prev ? { ...prev, last_edited_by: user.id, updated_at: updatedAt } : prev))
    setSaving(false)
    setDirty(false)
  }

  async function handleDelete() {
    if (!note || !window.confirm(`Delete "${note.title || 'this note'}"?`)) return
    await supabase.from('notes').delete().eq('id', note.id)
    navigate('/notes')
  }

  if (loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  if (!note) {
    return <div className="p-6 text-sm text-ink-muted">Note not found.</div>
  }

  // Shared notes are co-managed (RLS lets either partner update/delete a
  // shared row) — private notes are only ever fetchable by their owner in
  // the first place, so canManage is really just "did this note load".
  const canManage = user ? user.id === note.owner_id || note.visibility === 'shared' : false
  const lastEditorId = note.last_edited_by ?? note.owner_id
  const lastEditorLabel = lastEditorId === user?.id ? 'you' : (profiles[lastEditorId] ?? 'partner')

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6 pb-16">
      <Link to="/notes" className="text-sm text-ink-muted hover:text-ink">
        ← Notes
      </Link>

      <div className="flex items-start justify-between gap-3">
        {canManage ? (
          <input
            type="text"
            value={title}
            onChange={(e) => markDirty(setTitle)(e.target.value)}
            placeholder="Untitled"
            className="w-full rounded-lg border border-transparent bg-transparent px-0 text-2xl font-semibold text-navy outline-none focus:border-border focus:bg-surface focus:px-2 focus:py-1"
          />
        ) : (
          <h1 className="text-2xl font-semibold text-navy">{title || 'Untitled'}</h1>
        )}
        {canManage && (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="shrink-0 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-40"
          >
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        Last edited by {lastEditorLabel} · {format(new Date(note.updated_at), 'MMM d, h:mm a')}
      </p>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {courses.length > 0 && (
            <select
              value={courseId}
              onChange={(e) => markDirty(setCourseId)(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
            >
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1 text-xs">
            {(['private', 'shared'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => markDirty(setVisibility)(v)}
                className={['rounded-full px-3 py-1 capitalize', visibility === v ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(
                  ' ',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Tags, comma-separated"
            value={tagsInput}
            onChange={(e) => markDirty(setTagsInput)(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          />
        </div>
      )}

      {note.type === 'case_brief' ? (
        <CaseBriefFields value={caseBrief} editable={canManage} onChange={markDirty(setCaseBrief)} />
      ) : (
        user && <RichTextEditor content={content} editable={canManage} userId={user.id} onChange={markDirty(setContent)} />
      )}

      {canManage && (
        <button onClick={handleDelete} className="text-sm text-accent">
          Delete note
        </button>
      )}
    </div>
  )
}
