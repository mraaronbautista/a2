import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { NoteCard } from '../components/notes/NoteCard'
import { AddNoteButton } from '../components/notes/AddNoteButton'
import { CourseCard } from '../components/courses/CourseCard'
import { AddCourseButton } from '../components/courses/AddCourseButton'
import { useSettings } from '../hooks/useSettings'
import { SettingsIcon } from '../components/layout/icons'

const REALTIME_TABLES = ['notes', 'courses', 'reading_items']

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

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const [notesRes, coursesRes, readingsRes] = await Promise.all([
      supabase
        .from('notes')
        .select('id, title, type, visibility, owner_id, course_id, updated_at, courses(name, color)')
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
        <h1 className="text-2xl font-semibold text-navy">Notes</h1>
        <div className="flex items-center gap-2">
          {subView === 'notes' && householdId && user && <AddNoteButton householdId={householdId} userId={user.id} courses={courses} />}
          {subView === 'courses' && householdId && user && <AddCourseButton householdId={householdId} userId={user.id} onAdded={load} />}
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
  )
}
