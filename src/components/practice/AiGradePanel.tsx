/* oxlint-disable react/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { estimatedGradeCostUsd } from '../../lib/aiGradingPricing'
import type { Feedback, PracticeAttempt } from '../../lib/practiceTypes'
import { PracticeAiSettings } from './PracticeAiSettings'

export function AiGradePanel({ attemptId }: { attemptId: string }) {
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [configured, setConfigured] = useState(false)
  const [grade, setGrade] = useState<Feedback | null>(null)
  const [calibrated, setCalibrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    const attemptResult = await supabase.from('practice_attempts').select('*').eq('id', attemptId).single()
    const current = attemptResult.data as unknown as PracticeAttempt | null
    setAttempt(current)
    if (!current) return
    const [status, existing, settings] = await Promise.all([
      supabase.functions.invoke('grade-practice-attempt', { body: { action: 'status' } }),
      supabase.from('attempt_feedback').select('*').eq('attempt_id', attemptId).eq('grader_type', 'ai').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('practice_settings').select('ai_grading_calibrated').eq('household_id', current.household_id).maybeSingle(),
    ])
    setConfigured(!!status.data?.configured)
    setGrade(existing.data as unknown as Feedback | null)
    setCalibrated(settings.data?.ai_grading_calibrated ?? false)
  }
  useEffect(() => { load() }, [attemptId])
  if (!attempt) return null
  async function run() {
    if (!window.confirm(`Request an optional AI grade? Estimated cost: $${estimatedGradeCostUsd.toFixed(4)}.`)) return
    setLoading(true); setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('grade-practice-attempt', { body: { attemptId } })
    setLoading(false)
    if (invokeError || data?.error) { setError(data?.error ?? "Couldn't get an AI grade right now — your answer and other feedback are unaffected."); return }
    setGrade(data.feedback as Feedback); setCalibrated(!!data.calibrated)
  }
  async function toggleBenchmark() { if (!attempt) return; await supabase.from('practice_attempts').update({ is_benchmark: !attempt.is_benchmark }).eq('id', attempt.id); await load() }
  const details = grade?.metadata && typeof grade.metadata === 'object' && !Array.isArray(grade.metadata) ? grade.metadata as Record<string, unknown> : null
  const list = (key: string) => Array.isArray(details?.[key]) ? details[key] as string[] : []
  return <section className="mt-5 space-y-3 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Optional AI grade</h3><p className="text-xs text-ink-muted">Uses only your answer and the reviewed rubric.</p></div><button type="button" onClick={toggleBenchmark} className="text-sm text-accent">{attempt.is_benchmark ? 'Remove benchmark' : 'Use for calibration'}</button></div>
    {grade ? <div className="space-y-4"><div><span className={`rounded-full px-2 py-1 text-xs ${calibrated ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{calibrated ? 'Household calibrated' : 'Provisional — not yet calibrated'}</span><p className="mt-2 text-3xl font-semibold">{grade.total_score} / 5</p></div>{[['strengths','What worked'],['improvements','Improve next'],['grammarTips','Grammar'],['capitalizationTips','Capitalization']].map(([key,label]) => list(key).length ? <div key={key}><h4 className="text-sm font-semibold">{label}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-muted">{list(key).map((tip,index)=><li key={index}>{tip}</li>)}</ul></div> : null)}</div> : configured ? <button type="button" onClick={run} disabled={loading} className="rounded-xl border border-accent px-4 py-2 text-accent">{loading ? 'Grading…' : `Get rating & improvement tips · est. $${estimatedGradeCostUsd.toFixed(4)}`}</button> : <p className="text-sm text-ink-muted">No provider is configured. Self and partner grading remain free and fully available.</p>}
    {error && <p className="text-sm text-red-600">{error}</p>}
    <PracticeAiSettings householdId={attempt.household_id} />
  </section>
}
