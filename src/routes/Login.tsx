import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Logo } from '../components/Logo'

export function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setStatus('error')
      setError(error.message)
      return
    }

    setStatus('sent')
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <Logo size={40} />
        <h1 className="mt-3 text-2xl font-semibold text-navy">A²</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in with a magic link.</p>

        {status === 'sent' ? (
          <p className="mt-6 rounded-lg bg-accent-bg px-4 py-3 text-sm text-ink">
            Check <span className="font-medium">{email}</span> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-lg bg-navy px-3 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {error && <p className="text-sm text-accent">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
