/* oxlint-disable react/set-state-in-effect, react/immutability, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Comparison = { id: string; ai: number | null; human: number | null }

export function PracticeAiSettings({ householdId }: { householdId: string }) {
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState('')
  const [calibrated, setCalibrated] = useState(false)
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) load() }, [open, householdId])
  async function load() {
    const { data: settings } = await supabase.from('practice_settings').select('*').eq('household_id', householdId).maybeSingle()
    setLimit(settings?.monthly_ai_cost_limit_usd == null ? '' : String(settings.monthly_ai_cost_limit_usd))
    setCalibrated(settings?.ai_grading_calibrated ?? false)
    const { data: attempts } = await supabase.from('practice_attempts').select('id').eq('household_id', householdId).eq('is_benchmark', true)
    const ids = (attempts ?? []).map((attempt) => attempt.id)
    if (!ids.length) { setComparisons([]); return }
    const { data: feedback } = await supabase.from('attempt_feedback').select('attempt_id,grader_type,total_score').in('attempt_id', ids)
    setComparisons(ids.map((id) => ({ id, ai: feedback?.find((item) => item.attempt_id === id && item.grader_type === 'ai')?.total_score ?? null, human: feedback?.find((item) => item.attempt_id === id && (item.grader_type === 'self' || item.grader_type === 'partner'))?.total_score ?? null })))
  }
  async function save() {
    setSaving(true)
    await supabase.from('practice_settings').upsert({ household_id: householdId, monthly_ai_cost_limit_usd: limit === '' ? null : Number(limit), ai_grading_calibrated: calibrated, updated_at: new Date().toISOString() })
    setSaving(false); setOpen(false)
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm text-accent">AI grading settings & calibration</button>
  return <div role="dialog" aria-modal="true" aria-label="AI grading settings" className="rounded-2xl border border-border bg-bg p-5">
    <h2 className="font-semibold">AI grading settings</h2>
    <p className="mt-1 text-sm text-ink-muted">Optional and off unless a server-side provider key is configured. A2 always enforces its own $5 monthly ceiling.</p>
    <label className="mt-4 block text-sm font-medium">Your lower monthly limit in USD<input type="number" min="0" max="5" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="Leave blank to use A2's $5 ceiling" className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2" /></label>
    <div className="mt-5"><h3 className="text-sm font-semibold">Benchmark comparison</h3>{comparisons.length ? <div className="mt-2 space-y-2">{comparisons.map((item, index) => <div key={item.id} className="grid grid-cols-3 rounded-lg bg-surface p-2 text-sm"><span>Attempt {index + 1}</span><span>Human: {item.human ?? '—'}</span><span>AI: {item.ai ?? '—'}</span></div>)}</div> : <p className="mt-1 text-sm text-ink-muted">Mark submitted attempts as benchmarks to compare human and AI scores.</p>}</div>
    <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={calibrated} onChange={(event) => setCalibrated(event.target.checked)} className="mt-1" /><span>I reviewed the benchmark comparisons and accept AI grades as calibrated for this household.</span></label>
    <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="button" onClick={save} disabled={saving} className="rounded-xl bg-accent px-4 py-2 text-white">{saving ? 'Saving…' : 'Save'}</button></div>
  </div>
}
