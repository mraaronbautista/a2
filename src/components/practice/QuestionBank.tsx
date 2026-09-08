import { Link } from 'react-router-dom'
import { useHousehold } from '../../hooks/useHousehold'
import type { PracticeQuestion } from '../../lib/practiceTypes'
import { GenerateVariationDialog } from './GenerateVariationDialog'
import { ManualVariationForm } from './ManualVariationForm'
import { ReviewerQueue } from './ReviewerQueue'

const sourceLabel = { supreme_court: 'Official Bar Question', professor_supplied: 'Professor-supplied', institutional_suggested: 'Institutional suggested answer' }

export function QuestionBank({ questions }: { questions: PracticeQuestion[] }) {
  const { householdId } = useHousehold()
  return <div className="space-y-5">
    {householdId && <div className="flex flex-wrap gap-2"><ManualVariationForm householdId={householdId} questions={questions} onAdded={() => window.location.reload()} /><GenerateVariationDialog questions={questions} onGenerated={() => window.location.reload()} /></div>}
    <ReviewerQueue questions={questions} onChanged={() => window.location.reload()} />
    {!questions.length ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">No questions yet. Add and review the first question before practice.</div> : <div className="grid gap-3">{questions.map((question) => <article key={question.id} className="rounded-2xl border border-border bg-surface p-4 hover:border-accent">
      <Link to={`/practice/${question.id}`} className="block">
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2 py-1 ${question.kind === 'variation' ? 'bg-purple-100 text-purple-800' : 'bg-accent-bg text-accent'}`}>{question.kind === 'variation' ? 'Bar Question Variation' : 'Official Bar Question'}</span><span className="rounded-full bg-bg px-2 py-1 text-ink-muted">{sourceLabel[question.source_tier]}</span><span className={`rounded-full px-2 py-1 ${question.review_status === 'reviewed' ? 'bg-green-100 text-green-800' : 'bg-bg text-ink-muted'}`}>{question.review_status === 'reviewed' ? 'Reviewed' : 'Unreviewed draft'}</span></div>
        <h3 className="mt-2 font-semibold">{question.subject} · {question.bar_year} · Question {question.question_number}</h3><p className="mt-1 line-clamp-2 text-sm text-ink-muted">{question.question_text}</p>
      </Link>
      {question.kind === 'variation' && question.parent_question_ids?.length ? <div className="mt-2 flex flex-wrap gap-3">{question.parent_question_ids.map((parentId, index) => <Link key={parentId} to={`/practice/${parentId}`} className="text-xs text-accent">Open parent {question.parent_question_ids!.length > 1 ? index + 1 : 'question'}</Link>)}</div> : null}
    </article>)}</div>}
  </div>
}
