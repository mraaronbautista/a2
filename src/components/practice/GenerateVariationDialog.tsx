import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { PracticeQuestion, VariationType } from '../../lib/practiceTypes'
import { estimatedGradeCostUsd } from '../../lib/aiGradingPricing'

const options: VariationType[] = ['change_material_fact', 'change_immaterial_fact', 'reverse_result', 'add_exception', 'remove_necessary_fact', 'combine_doctrines', 'convert_format']

export function GenerateVariationDialog({ questions, onGenerated }: { questions: PracticeQuestion[]; onGenerated: () => void }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<VariationType>('change_material_fact')
  const [parentIds, setParentIds] = useState<string[]>([])
  const [pool, setPool] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const eligible = useMemo(() => questions.filter((question) => question.kind === 'official' && question.review_status === 'reviewed' && question.locked), [questions])
  const requiredParentCount = type === 'combine_doctrines' ? 2 : 1

  function setParents(nextIds: string[]) {
    setParentIds(nextIds)
    const authorities = nextIds.flatMap((id) => eligible.find((question) => question.id === id)?.answer_key.legalBasis.authorities ?? [])
    setPool([...new Set(authorities)].join('\n'))
  }

  function toggle(id: string) {
    setParents(parentIds.includes(id) ? parentIds.filter((currentId) => currentId !== id) : [...parentIds, id].slice(-requiredParentCount))
  }

  async function generate() {
    setLoading(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('generate-practice-variation', {
      body: { parentQuestionIds: parentIds, variationType: type, approvedAuthorityPool: pool.split('\n').map((value) => value.trim()).filter(Boolean) },
    })
    setLoading(false)
    if (invokeError || data?.error) {
      setError(data?.error ?? 'Generation failed without saving a draft.')
      return
    }
    setOpen(false)
    onGenerated()
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full border border-accent px-4 py-2 text-sm text-accent">Generate variation</button>
  return <div role="dialog" aria-modal="true" className="space-y-4 rounded-2xl border border-border bg-surface p-5">
    <div className="flex justify-between"><h2 className="font-semibold">Generate an unreviewed variation</h2><button onClick={() => setOpen(false)}>Close</button></div>
    <label className="block text-sm font-medium">Variation type<select value={type} onChange={(event) => { setType(event.target.value as VariationType); setParents([]) }} className="mt-1 w-full rounded-xl border border-border bg-bg p-2">{options.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>
    <fieldset><legend className="text-sm font-medium">Choose exactly {requiredParentCount} reviewed official parent{requiredParentCount === 2 ? 's' : ''}</legend><div className="mt-2 space-y-2">{eligible.map((question) => <label key={question.id} className="flex gap-2 text-sm"><input type="checkbox" checked={parentIds.includes(question.id)} onChange={() => toggle(question.id)} /><span>{question.subject} · {question.bar_year} · Q{question.question_number}</span></label>)}</div></fieldset>
    <label className="block text-sm font-medium">Approved authorities<textarea required value={pool} onChange={(event) => setPool(event.target.value)} className="mt-1 min-h-28 w-full rounded-xl border border-border bg-bg p-3" /></label>
    <p className="text-xs text-ink-muted">Estimated cost is similar to one grade (about ${estimatedGradeCostUsd.toFixed(4)}). It shares the same monthly cap.</p>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <button onClick={generate} disabled={loading || parentIds.length !== requiredParentCount || !pool.trim()} className="rounded-xl bg-accent px-4 py-2 text-white disabled:opacity-40">{loading ? 'Generating…' : 'Generate unreviewed draft'}</button>
  </div>
}
