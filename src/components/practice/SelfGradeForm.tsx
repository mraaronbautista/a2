import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { AnswerKey } from '../../lib/practiceTypes'
import { AiGradePanel } from './AiGradePanel'

const gradeDescriptions: Record<number, string> = {
  0: 'No answer, or the response is irrelevant, incoherent, or nonsensical.',
  1: 'Incorrect conclusion with weak reasoning or communication, despite a bona fide attempt.',
  2: 'Incorrect conclusion, but the answer shows effective legal reasoning and coherent communication.',
  3: 'Correct conclusion, but the legal basis is incorrect, inapplicable, or materially mixed with incorrect law.',
  4: 'Correct conclusion and legal basis, with flaws in grammar, presentation, completeness, or precision.',
  5: 'Correct conclusion and legal basis, presented clearly and completely with minimal errors.',
}

export function SelfGradeForm({ attemptId, userId, answer, graderType = 'self', onSaved }: {
  attemptId: string; userId: string; answer: string; answerKey: AnswerKey; graderType?: 'self' | 'partner'; onSaved: () => void; existing?: unknown
}) {
  const [grade, setGrade] = useState(0)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const scores = { holistic: { points: grade, notes: notes.trim(), standard: gradeDescriptions[Math.floor(grade)] } }
    setSaving(true)
    const { error: saveError } = await supabase.from('attempt_feedback').upsert({ attempt_id: attemptId, grader_type: graderType, grader_user_id: userId, rubric_version: 'sc-holistic-5pt-v1', scores, total_score: grade, updated_at: new Date().toISOString() }, { onConflict: 'attempt_id,grader_type,grader_user_id' })
    setSaving(false)
    if (saveError) { setError(saveError.message); return }
    setError(''); onSaved()
  }

  return <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
    <h3 className="font-semibold">{graderType === 'self' ? 'Self-grade' : 'Grade your partner'}</h3>
    <p className="text-sm text-ink-muted">Give the complete answer one holistic score. Half-points are allowed.</p>
    <textarea readOnly value={answer} aria-label="Submitted answer" className="min-h-48 w-full rounded-xl border border-border bg-bg p-3" />
    <label className="block text-sm font-medium">Score · {grade.toFixed(1)} / 5<input aria-label="Holistic score" type="range" min="0" max="5" step="0.5" value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-accent)]" /></label>
    <p className="rounded-xl bg-bg p-3 text-sm">{gradeDescriptions[Math.floor(grade)]}{grade % 1 ? ' This half-point sits between the two adjacent standards.' : ''}</p>
    <label className="block text-sm font-medium">Why this score?<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Compare the conclusion, legal basis, analysis, and clarity with the reviewed answer." className="mt-1 min-h-24 w-full rounded-xl border border-border bg-bg p-3 font-normal" /></label>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <button disabled={saving} className="rounded-xl bg-accent px-4 py-2 text-white">{saving ? 'Saving…' : 'Save grade'}</button>
    {graderType === 'self' && <AiGradePanel attemptId={attemptId} />}
  </form>
}
