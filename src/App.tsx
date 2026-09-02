import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/layout/AppShell'
import { Login } from './routes/Login'
import { Today } from './routes/Today'
import { CourseDetail } from './routes/CourseDetail'
import { Notes } from './routes/Notes'
import { NoteDetail } from './routes/NoteDetail'
import { Budget } from './routes/Budget'
import { Us } from './routes/Us'

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
        <Route path="/courses" element={<Navigate to="/notes?view=courses" replace />} />
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:noteId" element={<NoteDetail />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/us" element={<Us />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
