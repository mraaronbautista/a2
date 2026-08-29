import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/layout/AppShell'
import { Login } from './routes/Login'
import { Today } from './routes/Today'
import { Calendar } from './routes/Calendar'
import { Courses } from './routes/Courses'
import { CourseDetail } from './routes/CourseDetail'
import { Notes } from './routes/Notes'
import { NoteDetail } from './routes/NoteDetail'
import { Placeholder } from './routes/Placeholder'

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-ink-muted">Loading…</div>
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:noteId" element={<NoteDetail />} />
        <Route path="/us" element={<Placeholder title="Us" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
