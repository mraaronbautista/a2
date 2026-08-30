import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { NoteCard } from '../components/notes/NoteCard'
import { AddNoteButton } from '../components/notes/AddNoteButton'
import { useSettings } from '../hooks/useSettings'
import { SettingsIcon } from '../components/layout/icons'

const REALTIME_TABLES = ['notes']

interface Course {
  id: string
  name: string
  color: string | null
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

  const [notes, setNotes] = useState<Note[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const [notesRes, coursesRes] = await Promise.all([
      supabase
        .from('notes')
        .select('id, title, type, visibility, owner_id, course_id, updated_at, courses(name, color)')
        .order('updated_at', { ascending: false }),
      supabase.from('courses').select('id, name, color'),
    ])

    setNotes((notesRes.data ?? []) as unknown as Note[])
    setCourses((coursesRes.data ?? []) as Course[])
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

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
          {householdId && user && <AddNoteButton householdId={householdId} userId={user.id} courses={courses} />}
          <button onClick={openSettings} aria-label="Settings" className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
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
    </div>
  )
}
