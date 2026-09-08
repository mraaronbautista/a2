import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { emptyAnswerKey, type PracticeQuestion, type VariationType } from '../../lib/practiceTypes'

const types: VariationType[] = ['change_material_fact', 'change_immaterial_fact', 'reverse_result', 'add_exception', 'remove_necessary_fact', 'combine_doctrines', 'convert_format']

export function ManualVariationForm({ householdId, questions, onAdded }: { householdId: string; questions: PracticeQuestion[]; onAdded: () => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [parentIds, setParentIds] = useState<string[]>([])
  const [type, setType] = useState<VariationType>('change_material_fact')
  const [questionText, setQuestionText] = useState('')
  const [field, setField] = useState('')
  const [before, setBefore] = useState('')
  const [after, setAfter] = useState('')
  const [effect, setEffect] = useState('')
  const [answer, setAnswer] = useState('')
  const [basis, setBasis] = useState('')
  const [application, setApplication] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [error, setError] = useState('')
  const eligible = questions.filter((question) => question.kind === 'official' && question.review_status === 'reviewed' && question.locked)
  const requiredParentCount = type === 'combine_doctrines' ? 2 : 1

  function selectParents(nextIds: string[]) {
    setParentIds(nextIds)
    setQuestionText(nextIds.map((id) => eligible.find((question) => question.id === id)?.question_text ?? '').filter(Boolean).join('\n\n'))
  }

  function toggleParent(id: string) {
    selectParents(parentIds.includes(id) ? parentIds.filter((currentId) => currentId !== id) : [...parentIds, id].slice(-requiredParentCount))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    const parents = parentIds.map((id) => eligible.find((question) => question.id === id)).filter((question): question is PracticeQuestion => Boolean(question))
    if (parents.length !== requiredParentCount) { setError(`Choose exactly ${requiredParentCount} reviewed official parent${requiredParentCount === 2 ? 's' : ''}.`); return }
    if (!parents.some((parent) => parent.question_text.includes(before)) || !questionText.includes(after)) { setError('The before and after facts must appear verbatim in a parent and the variation.'); return }
    const authorities = [...new Set(parents.flatMap((parent) => parent.answer_key.legalBasis.authorities))]
    const answerKey = { ...emptyAnswerKey, directAnswer: answer, legalBasis: { authorities, explanation: basis }, application, conclusion }
    const parent = parents[0]
    const { error: insertError } = await supabase.from('practice_questions').insert({ household_id: householdId, created_by: user.id, source_tier: parent.source_tier, kind: 'variation', parent_question_ids: parentIds, variation_type: type, fact_changes: [{ field, previousValue: before, newValue: after, legalEffect: effect }], bar_year: parent.bar_year, exam_date: parent.exam_date, subject: parent.subject, question_number: `${parent.question_number}-M`, question_text: questionText, source_url: parent.source_url, source_page: parent.source_page, course_id: parent.course_id, legal_cutoff_date: parent.legal_cutoff_date ?? null, answer_key: answerKey, review_status: 'unreviewed', locked: false })
    if (insertError) { setError(insertError.message); return }
    setOpen(false)
    onAdded()
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full border border-border px-4 py-2 text-sm">Write variation manually</button>
  const textareas: [string, string, (value: string) => void][] = [['Fact or field changed', field, setField], ['Previous exact text', before, setBefore], ['New exact text', after, setAfter], ['Legal effect', effect, setEffect], ['Expected direct answer', answer, setAnswer], ['Legal basis', basis, setBasis], ['Application', application, setApplication], ['Conclusion', conclusion, setConclusion]]
  return <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
    <div className="flex justify-between"><h2 className="font-semibold">Manual variation</h2><button type="button" onClick={() => setOpen(false)}>Close</button></div>
    <label className="block text-sm">Type<select value={type} onChange={(event) => { setType(event.target.value as VariationType); selectParents([]) }} className="mt-1 w-full rounded-xl border border-border bg-bg p-2">{types.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>
    <fieldset><legend className="text-sm">Choose exactly {requiredParentCount} reviewed official parent{requiredParentCount === 2 ? 's' : ''}</legend><div className="mt-2 space-y-2">{eligible.map((question) => <label key={question.id} className="flex gap-2 text-sm"><input type="checkbox" checked={parentIds.includes(question.id)} onChange={() => toggleParent(question.id)} /><span>{question.subject} · {question.bar_year} · Q{question.question_number}</span></label>)}</div></fieldset>
    {textareas.map(([label, value, setter]) => <label key={label} className="block text-sm">{label}<textarea required value={value} onChange={(event) => setter(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-border bg-bg p-3" /></label>)}
    <label className="block text-sm">Variation question<textarea required value={questionText} onChange={(event) => setQuestionText(event.target.value)} className="mt-1 min-h-48 w-full rounded-xl border border-border bg-bg p-3" /></label>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <button disabled={parentIds.length !== requiredParentCount} className="rounded-xl bg-accent px-4 py-2 text-white disabled:opacity-40">Save unreviewed variation</button>
  </form>
}
