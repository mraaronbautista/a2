import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { AnswerKey } from '../../lib/practiceTypes'

const keys = ['directAnswer', 'legalBasis', 'application', 'conclusion', 'legalWriting'] as const

export function SelfGradeForm({ attemptId, userId, answer, answerKey, graderType = 'self', onSaved }: {
  attemptId: string; userId: string; answer: string; answerKey: AnswerKey; graderType?: 'self' | 'partner'; onSaved: () => void; existing?: unknown
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [points, setPoints] = useState<Record<string, number>>({})
  const [spans, setSpans] = useState<Record<string, { start: number; end: number } | null>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    for (const key of keys) if ((points[key] || 0) > 0 && !spans[key]) { setError(`Attach selected evidence to ${answerKey.rubric[key].evidenceRequirement}.`); return }
    const scores = Object.fromEntries(keys.map((key) => [key, { points: points[key] || 0, evidenceSpan: spans[key] || null }]))
    const total = keys.reduce((sum, key) => sum + (points[key] || 0), 0)
    setSaving(true)
    const { error: saveError } = await supabase.from('attempt_feedback').upsert({ attempt_id: attemptId, grader_type: graderType, grader_user_id: userId, rubric_version: 'pilot-5pt-v1', scores, total_score: total, updated_at: new Date().toISOString() }, { onConflict: 'attempt_id,grader_type,grader_user_id' })
    setSaving(false)
    if (saveError) { setError(saveError.message); return }
    setError(''); onSaved()
  }

  return <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
    <h3 className="font-semibold">{graderType === 'self' ? 'Self-grade' : 'Grade your partner'}</h3>
    <p className="text-sm text-ink-muted">Select evidence in the answer, then attach that selection to each scored component.</p>
    <textarea ref={ref} readOnly value={answer} onSelect={() => { const el = ref.current; if (el && el.selectionEnd > el.selectionStart) setSelection({ start: el.selectionStart, end: el.selectionEnd }) }} aria-label="Submitted answer for evidence selection" className="min-h-48 w-full rounded-xl border border-border bg-bg p-3" />
    {keys.map((key) => <div key={key} className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
      <div><p className="text-sm font-medium">{key.replace(/([A-Z])/g, ' $1')}</p><p className="text-xs text-ink-muted">{answerKey.rubric[key].evidenceRequirement}</p></div>
      <input aria-label={`${key} points`} type="number" min="0" max={answerKey.rubric[key].maxPoints} step="0.5" value={points[key] ?? 0} onChange={(e) => setPoints({ ...points, [key]: Number(e.target.value) })} className="rounded-lg border border-border bg-bg px-2" />
      <button type="button" disabled={!selection} onClick={() => setSpans({ ...spans, [key]: selection })} className="rounded-lg border border-border px-3 text-sm disabled:opacity-40">{spans[key] ? 'Evidence attached' : 'Use selection'}</button>
    </div>)}
    {error && <p className="text-sm text-red-600">{error}</p>}
    <button disabled={saving} className="rounded-xl bg-accent px-4 py-2 text-white">{saving ? 'Saving…' : 'Save grade'}</button>
  </form>
}
