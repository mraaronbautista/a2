import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { ReadingItemRow } from '../components/courses/ReadingItemRow'
import { AddReadingButton } from '../components/courses/AddReadingButton'
import { EditCourseButton } from '../components/courses/EditCourseButton'

type PrepStatus = 'unprepped' | 'prepped' | 'cold_called'

interface Course {
  id: string
  name: string
  professor: string | null
  color: string | null
  owner_id: string
}

interface ReadingItem {
  id: string
  title: string
  source_link: string | null
  due_date: string | null
  order_index: number
}

interface ReadingStatusRow {
  completed_at: string | null
  prep_status: PrepStatus
}

export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [readings, setReadings] = useState<ReadingItem[]>([])
  const [statusByReading, setStatusByReading] = useState<Record<string, ReadingStatusRow>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!courseId || !user) return
    setLoading(true)

    const [courseRes, readingsRes] = await Promise.all([
      supabase.from('courses').select('id, name, professor, color, owner_id').eq('id', courseId).single(),
      supabase.from('reading_items').select('id, title, source_link, due_date, order_index').eq('course_id', courseId).order('order_index'),
    ])

    setCourse((courseRes.data ?? null) as Course | null)
    const readingItems = (readingsRes.data ?? []) as ReadingItem[]
    setReadings(readingItems)

    if (readingItems.length > 0) {
      const { data: statusRows } = await supabase
        .from('reading_status')
        .select('reading_item_id, completed_at, prep_status')
        .eq('user_id', user.id)
        .in(
          'reading_item_id',
          readingItems.map((r) => r.id),
        )
      const map: Record<string, ReadingStatusRow> = {}
      for (const row of (statusRows ?? []) as { reading_item_id: string; completed_at: string | null; prep_status: PrepStatus }[]) {
        map[row.reading_item_id] = { completed_at: row.completed_at, prep_status: row.prep_status }
      }
      setStatusByReading(map)
    } else {
      setStatusByReading({})
    }

    setLoading(false)
  }, [courseId, user])

  useEffect(() => {
    load()
  }, [load])

  async function toggleRead(readingId: string) {
    if (!user) return
    const wasDone = !!statusByReading[readingId]?.completed_at
    setStatusByReading((prev) => ({
      ...prev,
      [readingId]: { prep_status: prev[readingId]?.prep_status ?? 'unprepped', completed_at: wasDone ? null : new Date().toISOString() },
    }))
    await supabase
      .from('reading_status')
      .upsert({ reading_item_id: readingId, user_id: user.id, completed_at: wasDone ? null : new Date().toISOString() })
  }

  async function cyclePrep(readingId: string, next: PrepStatus) {
    if (!user) return
    setStatusByReading((prev) => ({
      ...prev,
      [readingId]: { completed_at: prev[readingId]?.completed_at ?? null, prep_status: next },
    }))
    await supabase.from('reading_status').upsert({ reading_item_id: readingId, user_id: user.id, prep_status: next })
  }

  async function moveReading(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= readings.length) return
    const a = readings[index]
    const b = readings[targetIndex]
    await Promise.all([
      supabase.from('reading_items').update({ order_index: b.order_index }).eq('id', a.id),
      supabase.from('reading_items').update({ order_index: a.order_index }).eq('id', b.id),
    ])
    load()
  }

  async function deleteReading(readingId: string) {
    if (!window.confirm('Delete this reading?')) return
    await supabase.from('reading_items').delete().eq('id', readingId)
    load()
  }

  if (loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  if (!course) {
    return <div className="p-6 text-sm text-ink-muted">Course not found.</div>
  }

  const canManage = user?.id === course.owner_id
  const nextOrderIndex = readings.length > 0 ? Math.max(...readings.map((r) => r.order_index)) + 1 : 0

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <Link to="/courses" className="text-sm text-ink-muted hover:text-ink">
        ← Courses
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: course.color ?? '#5b6478' }} />
          <div>
            <h1 className="text-2xl font-semibold text-navy">{course.name}</h1>
            {course.professor && <p className="text-sm text-ink-muted">{course.professor}</p>}
          </div>
        </div>
        {canManage && (
          <EditCourseButton
            courseId={course.id}
            initialName={course.name}
            initialProfessor={course.professor}
            initialColor={course.color}
            onSaved={load}
            onDeleted={() => navigate('/courses')}
          />
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-muted">Readings</h2>
          {canManage && <AddReadingButton courseId={course.id} nextOrderIndex={nextOrderIndex} onAdded={load} />}
        </div>

        {readings.length === 0 ? (
          <p className="text-sm text-ink-muted">No readings yet.</p>
        ) : (
          <ul className="space-y-2">
            {readings.map((r, index) => (
              <ReadingItemRow
                key={r.id}
                title={r.title}
                sourceLink={r.source_link}
                dueDate={r.due_date}
                completed={!!statusByReading[r.id]?.completed_at}
                prepStatus={statusByReading[r.id]?.prep_status ?? 'unprepped'}
                canManage={canManage}
                isFirst={index === 0}
                isLast={index === readings.length - 1}
                onToggleRead={() => toggleRead(r.id)}
                onCyclePrep={(next) => cyclePrep(r.id, next)}
                onMoveUp={() => moveReading(index, -1)}
                onMoveDown={() => moveReading(index, 1)}
                onDelete={() => deleteReading(r.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
