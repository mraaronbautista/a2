import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import type { JSONContent } from '@tiptap/react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useProfiles } from '../hooks/useProfiles'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { RichTextEditor } from '../components/notes/RichTextEditor'
import { PaginatedEditor, type PaginatedEditorHandle } from '../components/notes/PaginatedEditor'
import { PageThumbnailRail, type PagePreview } from '../components/notes/pagination/PageThumbnailRail'
import { CaseBriefFields, type CaseBrief } from '../components/notes/CaseBriefFields'
import { CheckIcon, SpinnerIcon } from '../components/layout/icons'
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from '../lib/pageSizes'
import { useFocusLayout } from '../hooks/useFocusLayout'
import { PAPER_TEMPLATES } from '../lib/paperTemplates'
import { notePlainText } from '../lib/notePlainText'
import { CanvasEditor } from '../components/notes/CanvasEditor'

// How long to wait after the last keystroke before autosaving.
const AUTOSAVE_DELAY_MS = 900
// An autosave's own write echoes back through the realtime subscription
// a moment later — long enough that `dirty` has usually already reset to
// false by the time it arrives, which used to make the echo look just
// like a genuine remote change and trigger a reload. Ignore any realtime
// event this soon after our own save; a real edit from the partner is
// vanishingly unlikely to land in this exact window.
const SELF_ECHO_WINDOW_MS = 6000

const REALTIME_TABLES = ['notes']

interface Course {
  id: string
  name: string
}

interface NoteRow {
  id: string
  title: string
  type: 'case_brief' | 'freeform' | 'paginated' | 'canvas'
  visibility: 'private' | 'shared'
  space: 'law' | 'personal'
  owner_id: string
  last_edited_by: string | null
  course_id: string | null
  tags: string[]
  updated_at: string
  content: JSONContent | null
  page_settings: PageSettings | null
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
  const { setFocused } = useFocusLayout()

  const [note, setNote] = useState<NoteRow | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private')
  const [tagsInput, setTagsInput] = useState('')
  const [content, setContent] = useState<JSONContent | null>(null)
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS)
  const [caseBrief, setCaseBrief] = useState<CaseBrief>({ facts: '', issue: '', holding: '', reasoning: '', dissent: '' })
  const editVersionRef = useRef(0)
  const paginatedEditorRef = useRef<PaginatedEditorHandle>(null)
  const [pagePreviews, setPagePreviews] = useState<PagePreview[]>([])
  const [visiblePage, setVisiblePage] = useState(1)

  // Only the very first fetch of a given note should show the full-page
  // "Loading…" state (which unmounts the editor) — a background refresh
  // of a note already on screen (a genuine partner edit arriving live)
  // should update in place instead of flashing the whole view away.
  const loadedNoteIdRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!noteId) return
    if (loadedNoteIdRef.current !== noteId) setLoading(true)

    const [noteRes, coursesRes] = await Promise.all([
      supabase
        .from('notes')
        .select(
          'id, title, type, visibility, space, owner_id, last_edited_by, course_id, tags, updated_at, content, page_settings, case_brief_facts, case_brief_issue, case_brief_holding, case_brief_reasoning, case_brief_dissent',
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
      setPageSettings(n.page_settings ?? DEFAULT_PAGE_SETTINGS)
      setCaseBrief({
        facts: n.case_brief_facts ?? '',
        issue: n.case_brief_issue ?? '',
        holding: n.case_brief_holding ?? '',
        reasoning: n.case_brief_reasoning ?? '',
        dissent: n.case_brief_dissent ?? '',
      })
    }

    editVersionRef.current = 0
    setSaveError('')
    setDirty(false)
    setLoading(false)
    loadedNoteIdRef.current = noteId
  }, [noteId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => { if (noteId && user) void supabase.from('note_user_state').upsert({ note_id: noteId, user_id: user.id, last_opened_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }, [noteId, user])

  useEffect(() => {
    setFocused(note?.type === 'paginated')
    return () => setFocused(false)
  }, [note?.type, noteId, setFocused])

  // Skip the live refresh while there are unsaved local edits — pulling the
  // partner's version mid-edit would silently overwrite what's being typed.
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  const justSavedAtRef = useRef(0)
  const handleRealtimeChange = useCallback(() => {
    if (dirtyRef.current) return
    if (Date.now() - justSavedAtRef.current < SELF_ECHO_WINDOW_MS) return
    load()
  }, [load])
  useRealtimeRefresh(REALTIME_TABLES, handleRealtimeChange)

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      editVersionRef.current += 1
      setDirty(true)
      setSaveError('')
    }
  }

  const handleSave = useCallback(async () => {
    if (!note || !user) return false
    setSaving(true)
    setSaveError('')
    const savingVersion = editVersionRef.current

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const updatedAt = new Date().toISOString()

    // Arm the self-echo guard before the write goes out, not after it
    // resolves — the realtime notification for this exact update can
    // otherwise arrive (over its own, separate websocket connection)
    // before this await returns, landing outside the guard window entirely.
    justSavedAtRef.current = Date.now()

    const { error } = await supabase
      .from('notes')
      .update({
        title,
        course_id: courseId || null,
        visibility,
        tags,
        search_text: note.type === 'case_brief' ? [caseBrief.facts, caseBrief.issue, caseBrief.holding, caseBrief.reasoning, caseBrief.dissent].join('\n').trim().slice(0, 200_000) : notePlainText(content),
        content: note.type === 'freeform' || note.type === 'paginated' ? content : null,
        page_settings: note.type === 'paginated' ? pageSettings : null,
        case_brief_facts: note.type === 'case_brief' ? caseBrief.facts : null,
        case_brief_issue: note.type === 'case_brief' ? caseBrief.issue : null,
        case_brief_holding: note.type === 'case_brief' ? caseBrief.holding : null,
        case_brief_reasoning: note.type === 'case_brief' ? caseBrief.reasoning : null,
        case_brief_dissent: note.type === 'case_brief' ? caseBrief.dissent : null,
        last_edited_by: user.id,
        updated_at: updatedAt,
      })
      .eq('id', note.id)

    if (error) {
      setSaving(false)
      setSaveError(error.message || 'Could not save this note.')
      setDirty(true)
      return false
    }

    setNote((prev) => (prev ? { ...prev, last_edited_by: user.id, updated_at: updatedAt } : prev))
    setSaving(false)
    const fullySaved = editVersionRef.current === savingVersion
    if (fullySaved) {
      setDirty(false)
      dirtyRef.current = false
    }
    return fullySaved
  }, [note, user, title, courseId, visibility, tagsInput, content, pageSettings, caseBrief])

  // Autosave: once something's dirty, wait for a pause in typing, then
  // save. Resets on every keystroke via handleSave's changing identity, so
  // it only actually fires AUTOSAVE_DELAY_MS after the last edit.
  useEffect(() => {
    if (!dirty || saving || saveError) return
    const timer = setTimeout(() => {
      handleSave()
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [dirty, saving, saveError, handleSave])

  // Flush any pending edit immediately when leaving the note, so a quick
  // back-navigation doesn't lose the last few keystrokes to the debounce.
  // Goes through a ref so the cleanup always calls the latest handleSave
  // (with the latest field values), not a stale one captured at mount.
  const handleSaveRef = useRef(handleSave)
  useEffect(() => {
    handleSaveRef.current = handleSave
  }, [handleSave])
  useEffect(() => {
    return () => {
      if (dirtyRef.current) handleSaveRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [])

  async function handleBack() {
    if (!note) return
    const destination = note.space === 'personal' ? '/us?view=notes' : '/notes'
    if (!dirty) {
      navigate(destination)
      return
    }
    if (await handleSave()) {
      navigate(destination)
      return
    }
    if (window.confirm("Couldn't save this note. Discard your unsaved changes and leave?")) {
      setDirty(false)
      dirtyRef.current = false
      navigate(destination)
    }
  }

  async function handleDelete() {
    if (!note || !window.confirm(`Delete "${note.title || 'this note'}"?`)) return
    await supabase.from('notes').delete().eq('id', note.id)
    navigate(note.space === 'personal' ? '/us?view=notes' : '/notes')
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

  if (note.type === 'canvas') return <section className="flex h-full min-h-0 flex-col bg-bg"><header className="flex min-h-12 items-center gap-2 border-b border-border bg-surface px-3 print:hidden"><button onClick={handleBack} className="px-2 text-sm text-ink-muted">←</button><h1 className="min-w-0 flex-1 truncate font-semibold text-navy">{note.title||'Untitled canvas'}</h1><span className="text-xs text-ink-muted">Canvas</span></header>{user&&<CanvasEditor noteId={note.id} userId={user.id} editable={canManage}/>}</section>

  if (note.type === 'paginated') {
    const pageSetupControls = (
      <div className="space-y-3 text-sm">
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-ink-muted">Paper size</legend>
          <div className="flex gap-1">
            {(['a4', 'letter'] as const).map((paper) => (
              <button key={paper} type="button" aria-pressed={pageSettings.paper === paper} onClick={() => markDirty(setPageSettings)({ ...pageSettings, paper })} className={['min-h-11 rounded-lg px-3 uppercase', pageSettings.paper === paper ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(' ')}>{paper}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-ink-muted">Orientation</legend>
          <div className="flex gap-1">
            {(['portrait', 'landscape'] as const).map((orientation) => (
              <button key={orientation} type="button" aria-pressed={pageSettings.orientation === orientation} onClick={() => markDirty(setPageSettings)({ ...pageSettings, orientation })} className={['min-h-11 rounded-lg px-3 capitalize', pageSettings.orientation === orientation ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(' ')}>{orientation}</button>
            ))}
          </div>
        </fieldset>
        <label className="block text-xs font-medium text-ink-muted">
          Margin (inches)
          <input type="number" min="0.25" max="2" step="0.25" value={pageSettings.marginIn} onChange={(event) => markDirty(setPageSettings)({ ...pageSettings, marginIn: Math.min(2, Math.max(0.25, Number(event.target.value) || 0.25)) })} className="mt-1 block h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-ink-muted">Paper style</legend>
          <div className="grid grid-cols-2 gap-1">
            {PAPER_TEMPLATES.map(({ value: paperStyle, label }) => (
              <button key={paperStyle} type="button" aria-pressed={(pageSettings.paperStyle ?? 'blank') === paperStyle} onClick={() => markDirty(setPageSettings)({ ...pageSettings, paperStyle })} className={['min-h-11 rounded-lg px-3', (pageSettings.paperStyle ?? 'blank') === paperStyle ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(' ')}>{label}</button>
            ))}
          </div>
        </fieldset>
      </div>
    )

    return (
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-bg" aria-label="Paginated note editor">
        <header className="z-30 flex min-h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 print:hidden sm:min-h-[52px] sm:px-3">
          <button type="button" onClick={handleBack} className="min-h-11 shrink-0 rounded-lg px-2 text-sm text-ink-muted hover:bg-bg hover:text-ink" aria-label={note.space === 'personal' ? 'Back to Us' : 'Back to Law'}>←</button>
          {canManage ? (
            <input type="text" value={title} onChange={(event) => markDirty(setTitle)(event.target.value)} placeholder="Untitled" className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-navy outline-none focus:border-border focus:bg-bg sm:text-lg" />
          ) : (
            <h1 className="min-w-0 flex-1 truncate px-2 text-base font-semibold text-navy sm:text-lg">{title || 'Untitled'}</h1>
          )}
          {canManage && (
            <div className="shrink-0" aria-live="polite">
              {saveError ? (
                <button type="button" onClick={() => handleSave()} className="rounded-lg bg-accent-bg px-2 py-1 text-xs font-medium text-accent" title={saveError}>Save failed · Retry</button>
              ) : saving || dirty ? (
                <span className="flex items-center gap-1 text-xs text-ink-muted"><SpinnerIcon className="h-3.5 w-3.5 animate-spin" /><span className="hidden sm:inline">Saving…</span></span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-ink-muted"><CheckIcon className="h-3.5 w-3.5 text-accent" /><span className="hidden sm:inline">Saved</span></span>
              )}
            </div>
          )}
          {canManage && (
            <details className="relative hidden md:block">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg px-3 text-sm text-ink-muted hover:bg-bg">Page setup</summary>
              <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-surface p-4 shadow-xl">{pageSetupControls}</div>
            </details>
          )}
          {canManage && (
            <details className="relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg px-3 text-sm text-ink-muted hover:bg-bg" aria-label="More document options">More</summary>
              <div className="fixed inset-x-2 top-14 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80">
                <div className="mb-4 md:hidden">{pageSetupControls}</div>
                <div className="space-y-3 border-t border-border pt-4 md:border-0 md:pt-0">
                  {note.space === 'law' && courses.length > 0 && (
                    <label className="block text-xs font-medium text-ink-muted">Course<select value={courseId} onChange={(event) => markDirty(setCourseId)(event.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-ink"><option value="">No course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
                  )}
                  <fieldset><legend className="mb-1 text-xs font-medium text-ink-muted">Visibility</legend><div className="flex gap-1">{(['private', 'shared'] as const).map((value) => <button key={value} type="button" aria-pressed={visibility === value} onClick={() => markDirty(setVisibility)(value)} className={['min-h-11 rounded-lg px-3 capitalize', visibility === value ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(' ')}>{value}</button>)}</div></fieldset>
                  <label className="block text-xs font-medium text-ink-muted">Tags<input type="text" value={tagsInput} onChange={(event) => markDirty(setTagsInput)(event.target.value)} placeholder="Comma-separated" className="mt-1 block h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-ink" /></label>
                  <p className="text-xs text-ink-muted">Last edited by {lastEditorLabel} · {format(new Date(note.updated_at), 'MMM d, h:mm a')}</p>
                  <button type="button" onClick={handleDelete} className="min-h-11 w-full border-t border-border pt-3 text-left text-sm font-medium text-accent">Delete note</button>
                </div>
              </div>
            </details>
          )}
        </header>
        {saveError && <div role="alert" className="shrink-0 border-b border-border bg-accent-bg px-3 py-2 text-xs text-accent">Couldn’t save this note. Your changes are still here. Retry before leaving.</div>}
        {user && <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 lg:flex-row lg:p-3"><PageThumbnailRail pages={pagePreviews} currentPage={visiblePage} onSelect={(page) => paginatedEditorRef.current?.scrollToPage(page)} /><PaginatedEditor ref={paginatedEditorRef} content={content} editable={canManage} userId={user.id} pageSettings={pageSettings} onChange={markDirty(setContent)} onPagesChange={setPagePreviews} onVisiblePageChange={setVisiblePage} /></div>}
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6 pb-16">
      <Link to={note.space === 'personal' ? '/us?view=notes' : '/notes'} className="text-sm text-ink-muted hover:text-ink">
        {note.space === 'personal' ? '← Us' : '← Law'}
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
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted" aria-live="polite">
            {saving || dirty ? (
              <>
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckIcon className="h-3.5 w-3.5 text-accent" />
                Saved
              </>
            )}
          </span>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        Last edited by {lastEditorLabel} · {format(new Date(note.updated_at), 'MMM d, h:mm a')}
      </p>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {note.space === 'law' && courses.length > 0 && (
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
