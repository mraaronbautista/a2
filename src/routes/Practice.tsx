import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { usePracticeQuestions } from '../hooks/usePracticeQuestions'
import { AddQuestionForm } from '../components/practice/AddQuestionForm'
import { QuestionBank } from '../components/practice/QuestionBank'
import { SchoolNav } from '../components/school/SchoolNav'
import type { PracticeQuestion } from '../lib/practiceTypes'

export function Practice() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const [params] = useSearchParams()
  const course = params.get('course')
  const { questions, loading, error, reload } = usePracticeQuestions(course)
  const [tab, setTab] = useState<'start' | 'bank' | 'progress' | 'together'>('start')
  const reviewed = useMemo(() => questions.filter((question) => question.review_status === 'reviewed'), [questions])
  function startQuickFire() {
    if (!reviewed.length) return
    const question = reviewed[Math.floor(Math.random() * reviewed.length)]
    navigate(`/practice/${question.id}?quick=1`)
  }

  if (loading) return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  return <main className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
    <h1 className="text-2xl font-semibold text-navy">Law School</h1>
    <SchoolNav active="practice" />
    <div><p className="text-sm text-ink-muted">A2's practice format</p><h2 className="text-3xl font-semibold text-navy">Practice</h2><p className="mt-1 text-sm text-ink-muted">Real questions, deliberate answers, evidence-based review—with optional AI grading when you request it.</p></div>
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-full bg-surface p-1">{([['start', 'Start practice'], ['bank', 'Question bank'], ['progress', 'Progress'], ['together', 'You & partner']] as const).map(([id, label]) => <button role="tab" aria-selected={tab === id} onClick={() => setTab(id)} key={id} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === id ? 'bg-accent-bg text-accent' : 'text-ink-muted'}`}>{label}</button>)}</div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    {tab === 'start' && <section className="space-y-5"><div className="rounded-2xl border border-accent bg-surface p-6"><p className="text-sm font-medium text-accent">Quick Fire</p><h2 className="mt-1 text-xl font-semibold">One random question. One focused answer.</h2><p className="mt-2 text-sm text-ink-muted">Answer in one box, then get a 0–5 rating, legal-answer guidance, and writing tips for grammar and capitalization.</p><button onClick={startQuickFire} disabled={!reviewed.length} className="mt-4 rounded-xl bg-accent px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">Give me a question</button>{!reviewed.length && <p className="mt-3 text-xs text-ink-muted">Quick Fire becomes available when at least one question has a reviewed answer key.</p>}</div><div><h2 className="mb-3 text-lg font-semibold">Choose a question</h2>{reviewed.length ? <ReadyQuestions questions={reviewed} /> : <div className="rounded-2xl border border-dashed border-border p-8 text-center"><p>No reviewed questions are ready yet.</p><button onClick={() => setTab('bank')} className="mt-2 text-sm text-accent">Open the question bank</button></div>}</div></section>}
    {tab === 'bank' && <section className="space-y-4">{user && householdId && <AddQuestionForm householdId={householdId} userId={user.id} courseId={course} onAdded={reload} />}<QuestionBank questions={questions} /></section>}
    {tab === 'progress' && <section className="grid gap-3 sm:grid-cols-3"><Stat label="Questions available" value={questions.length} /><Stat label="Reviewed" value={reviewed.length} /><Stat label="Drafts awaiting review" value={questions.length - reviewed.length} /></section>}
    {tab === 'together' && <section className="rounded-2xl border border-border bg-surface p-6"><h2 className="font-semibold">You & your partner</h2><p className="mt-2 text-sm text-ink-muted">Partner answers appear only after both of you submit the same question, unless an answer is revealed early.</p></section>}
  </main>
}

function ReadyQuestions({ questions }: { questions: PracticeQuestion[] }) {
  return <div className="grid gap-3">{questions.map((question) => <Link key={question.id} to={`/practice/${question.id}`} className="rounded-2xl border border-border bg-surface p-4 hover:border-accent"><div className="flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-2 py-1 ${question.kind === 'variation' ? 'bg-purple-100 text-purple-800' : 'bg-accent-bg text-accent'}`}>{question.kind === 'variation' ? 'Bar Question Variation' : 'Official Bar Question'}</span><span className="rounded-full bg-green-100 px-2 py-1 text-green-800">Reviewed</span></div><h3 className="mt-2 font-semibold">{question.subject} · {question.bar_year} · Question {question.question_number}</h3><p className="mt-1 line-clamp-2 text-sm text-ink-muted">{question.question_text}</p></Link>)}</div>
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-border bg-surface p-5"><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-ink-muted">{label}</p></div>
}
