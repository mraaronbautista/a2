import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { AddNoteModal } from '../components/notes/AddNoteModal'
import { CourseCard } from '../components/courses/CourseCard'
import { AddCourseModal } from '../components/courses/AddCourseModal'
import { useSettings } from '../hooks/useSettings'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { SettingsIcon } from '../components/layout/icons'
import { LibraryWorkspace } from '../components/library/LibraryWorkspace'

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

export function Notes() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
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

  const [courses, setCourses] = useState<Course[]>([])
  const [readingCounts, setReadingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [addCourseOpen, setAddCourseOpen] = useState(false)

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const [coursesRes, readingsRes] = await Promise.all([
      supabase.from('courses').select('id, name, professor, color, is_shared').order('created_at', { ascending: true }),
      supabase.from('reading_items').select('course_id'),
    ])

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

      <div onTouchStart={handleSubViewSwipeStart} onTouchEnd={handleSubViewSwipeEnd} className="min-h-[60dvh] space-y-4">
        {subView === 'notes' && householdId && user && <LibraryWorkspace householdId={householdId} userId={user.id} space="law" courses={courses} onNewNote={() => setAddNoteOpen(true)} />}

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
