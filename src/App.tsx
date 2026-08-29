import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/layout/AppShell'
import { Login } from './routes/Login'
import { Today } from './routes/Today'
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
        <Route path="/calendar" element={<Placeholder title="Calendar" />} />
        <Route path="/courses" element={<Placeholder title="Courses" />} />
        <Route path="/notes" element={<Placeholder title="Notes" />} />
        <Route path="/us" element={<Placeholder title="Us" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
