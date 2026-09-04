import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// A household of two tends to leave this open for days at a stretch (a
// pinned browser tab, a phone that's never fully force-quit), so a
// deploy can otherwise go unnoticed indefinitely — the browser only
// checks for a new worker on its own around page navigations. Re-check
// hourly as a floor, and also every time the app comes back to the
// foreground (far more frequent in practice than the hourly timer, and
// the moment someone's actually about to use it) so a build pushed
// minutes ago shows up on the next open, not the next hour.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
