import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { CourseCard } from '../components/courses/CourseCard'
import { AddCourseButton } from '../components/courses/AddCourseButton'

interface Course {
  id: string
  name: string
  professor: string | null
  color: string | null
  is_shared: boolean
}

export function Courses() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const [courses, setCourses] = useState<Course[]>([])
  const [readingCounts, setReadingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

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

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Courses</h1>
        {householdId && user && <AddCourseButton householdId={householdId} userId={user.id} onAdded={load} />}
      </div>

      {courses.length === 0 ? (
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
      )}
    </div>
  )
}
