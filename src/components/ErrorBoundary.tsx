import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

// Without this, any uncaught render error blanks the whole app to a plain
// white screen with no way back short of knowing to reload — this at
// least gives a real screen and a way out.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
          <p className="text-lg font-semibold text-navy">Something went wrong.</p>
          <p className="max-w-xs text-sm text-ink-muted">
            The app hit an error it couldn't recover from. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
