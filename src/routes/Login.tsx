import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Logo } from '../components/Logo'

const EMAIL_DOMAIN = 'a2.local'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`,
      password,
    })

    if (error) {
      setStatus('error')
      setError('Wrong username or password.')
      return
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <Logo size={40} className="rounded-lg" />
        <p className="mt-4 text-sm text-ink-muted">Sign in.</p>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <input
            type="text"
            required
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-lg bg-navy px-3 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {status === 'submitting' ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="text-sm text-accent">{error}</p>}
        </form>
      </div>
    </div>
  )
}
