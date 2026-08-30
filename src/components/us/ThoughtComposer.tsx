import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface ThoughtComposerProps {
  householdId: string
  userId: string
  onPosted: () => void
}

export function ThoughtComposer({ householdId, userId, onPosted }: ThoughtComposerProps) {
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared')
  const [posting, setPosting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    setPosting(true)

    await supabase.from('thoughts').insert({
      household_id: householdId,
      owner_id: userId,
      body: trimmed,
      visibility,
    })

    setBody('')
    setVisibility('shared')
    setPosting(false)
    onPosted()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Pin a thought, with no due date so it doesn't get lost…"
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-1 text-xs">
          {(['private', 'shared'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={[
                'rounded-full px-3 py-1 capitalize',
                visibility === v ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
              ].join(' ')}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={posting || !body.trim()}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
        >
          {posting ? 'Pinning…' : 'Pin it'}
        </button>
      </div>
    </form>
  )
}
