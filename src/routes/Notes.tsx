import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { NoteCard } from '../components/notes/NoteCard'
import { AddNoteModal } from '../components/notes/AddNoteModal'
import { CourseCard } from '../components/courses/CourseCard'
import { AddCourseModal } from '../components/courses/AddCourseModal'
import { useSettings } from '../hooks/useSettings'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { SettingsIcon } from '../components/layout/icons'

const REALTIME_TABLES = ['notes', 'courses', 'reading_items']
const SUBVIEW_ORDER = ['notes', 'courses'] as const
const SWIPE_MIN_DISTANCE = 60

interface Course {
  id: string
  name: string
  professor: string | null
  color: string | null
  is_shared: boolean
}

interface Note {
  id: string
  title: string
  type: 'case_brief' | 'freeform'
  visibility: 'private' | 'shared'
  owner_id: string
  course_id: string | null
  updated_at: string
  courses: { name: string; color: string | null } | null
}

export function Notes() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()
  const { openSettings } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()

  // Courses got merged into this tab rather than kept as its own nav
  // destination — the two were always browsing the same underlying data
  // (a course's reading list vs. notes tagged to it), so a sub-view toggle
  // here mirrors how Us does Nudges/Thoughts. ?view=courses lets
  // CourseDetail's delete redirect land back on Courses instead of
  // dropping to the Notes list.
  const initialView = searchParams.get('view') === 'courses' ? 'courses' : 'notes'
  const [subView, setSubView] = useState<'notes' | 'courses'>(initialView)

  const [notes, setNotes] = useState<Note[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [readingCounts, setReadingCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [addCourseOpen, setAddCourseOpen] = useState(false)

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const [notesRes, coursesRes, readingsRes] = await Promise.all([
      supabase
        .from('notes')
        .select('id, title, type, visibility, owner_id, course_id, updated_at, courses(name, color)')
        .eq('space', 'law')
        .order('updated_at', { ascending: false }),
      supabase.from('courses').select('id, name, professor, color, is_shared').order('created_at', { ascending: true }),
      supabase.from('reading_items').select('course_id'),
    ])

    setNotes((notesRes.data ?? []) as unknown as Note[])
    setCourses((coursesRes.data ?? []) as Course[])

    const counts: Record<string, number> = {}
    for (const row of (readingsRes.data ?? []) as { course_id: string }[]) {
      counts[row.course_id] = (counts[row.course_id] ?? 0) + 1
    }
    setReadingCounts(counts)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  function selectSubView(view: 'notes' | 'courses') {
    setSubView(view)
    setSearchParams(view === 'courses' ? { view } : {}, { replace: true })
  }

  // Same gesture as Us's Goals/Thoughts swipe (touchstart/touchend only,
  // horizontal-dominance + minimum-distance check, no preventDefault) —
  // with only two sub-views, either direction just toggles between them.
  const subViewSwipeStart = useRef<{ x: number; y: number } | null>(null)

  function handleSubViewSwipeStart(e: ReactTouchEvent) {
    const t = e.touches[0]
    subViewSwipeStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleSubViewSwipeEnd(e: ReactTouchEvent) {
    const start = subViewSwipeStart.current
    subViewSwipeStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const idx = SUBVIEW_ORDER.indexOf(subView)
    const nextIdx = dx < 0 ? (idx + 1) % SUBVIEW_ORDER.length : (idx - 1 + SUBVIEW_ORDER.length) % SUBVIEW_ORDER.length
    selectSubView(SUBVIEW_ORDER[nextIdx])
  }

  // The persistent "+" in AppShell adds whatever this tab is currently
  // showing — a note or a course — instead of always opening Timeline's
  // task/event quick-add.
  useQuickAdd(
    householdId && user ? (subView === 'notes' ? () => setAddNoteOpen(true) : () => setAddCourseOpen(true)) : null,
  )

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (courseFilter && n.course_id !== courseFilter) return false
      if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [notes, search, courseFilter])

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Law</h1>
        <div className="flex items-center gap-2">
          <button onClick={openSettings} aria-label="Settings" className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-full bg-surface p-1 text-xs">
        {(
          [
            ['notes', 'Notes'],
            ['courses', 'Courses'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => selectSubView(value)}
            className={['rounded-full px-3 py-1 font-medium', subView === value ? 'bg-accent-bg text-accent' : 'text-ink-muted'].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div onTouchStart={handleSubViewSwipeStart} onTouchEnd={handleSubViewSwipeEnd} className="space-y-4">
        {subView === 'notes' && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              {courses.length > 0 && (
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="w-32 shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="">All courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-ink-muted">{notes.length === 0 ? 'No notes yet.' : 'No notes match.'}</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((n) => (
                  <NoteCard
                    key={n.id}
                    id={n.id}
                    title={n.title}
                    type={n.type}
                    courseName={n.courses?.name ?? null}
                    courseColor={n.courses?.color ?? null}
                    visibility={n.visibility}
                    updatedAt={n.updated_at}
                    ownerLabel={user && n.owner_id !== user.id ? profiles[n.owner_id] : undefined}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {subView === 'courses' &&
          (courses.length === 0 ? (
            <p className="text-sm text-ink-muted">No courses yet — add your first one.</p>
          ) : (
            <div className="space-y-2">
              {courses.map((c) => (
                <CourseCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  professor={c.professor}
                  color={c.color}
                  readingCount={readingCounts[c.id] ?? 0}
                  isShared={c.is_shared}
                />
              ))}
            </div>
          ))}
      </div>

      {addNoteOpen && householdId && user && (
        <AddNoteModal householdId={householdId} userId={user.id} space="law" courses={courses} onClose={() => setAddNoteOpen(false)} />
      )}
      {addCourseOpen && householdId && user && (
        <AddCourseModal householdId={householdId} userId={user.id} onAdded={load} onClose={() => setAddCourseOpen(false)} />
      )}
    </div>
  )
}
