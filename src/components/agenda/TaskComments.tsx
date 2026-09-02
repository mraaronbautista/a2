import { useState } from 'react'

export interface TaskComment {
  id: string
  askedBy: string
  question: string
  answer: string | null
  answeredBy: string | null
  askedAt: string
  answeredAt: string | null
  resolved: boolean
  resolvedBy: string | null
  resolvedAt: string | null
}

interface TaskCommentsProps {
  comments: TaskComment[]
  onChange: (comments: TaskComment[]) => void
  meId: string
  nameFor: (userId: string) => string
}

function AnswerRow({ onAnswer }: { onAnswer: (answer: string) => void }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        placeholder="Type your reply…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
      />
      {draft.trim() && (
        <button
          type="button"
          onClick={() => onAnswer(draft.trim())}
          className="self-end rounded-lg bg-navy px-3 py-1 text-xs font-medium text-bg"
        >
          Reply
        </button>
      )}
    </div>
  )
}

// A lightweight comment/question thread on a task — either person can
// ask a question or leave a plain comment; the other can reply, or mark
// it resolved if there's nothing to answer (an FYI, not a question).
// Writes the whole updated array back through onChange on every action,
// same pattern as the checklist above it.
export function TaskComments({ comments, onChange, meId, nameFor }: TaskCommentsProps) {
  const [draft, setDraft] = useState('')

  function ask() {
    const question = draft.trim()
    if (!question) return
    const entry: TaskComment = {
      id: crypto.randomUUID(),
      askedBy: meId,
      question,
      answer: null,
      answeredBy: null,
      askedAt: new Date().toISOString(),
      answeredAt: null,
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
    }
    onChange([...comments, entry])
    setDraft('')
  }

  function answer(item: TaskComment, text: string) {
    onChange(comments.map((c) => (c.id === item.id ? { ...c, answer: text, answeredBy: meId, answeredAt: new Date().toISOString() } : c)))
  }

  function resolve(item: TaskComment) {
    onChange(comments.map((c) => (c.id === item.id ? { ...c, resolved: true, resolvedBy: meId, resolvedAt: new Date().toISOString() } : c)))
  }

  return (
    <div>
      <span className="text-xs font-semibold text-ink-muted">Comments</span>

      {comments.length > 0 && (
        <div className="mt-1.5 space-y-2">
          {comments.map((item) => (
            <div key={item.id} className="space-y-1.5 rounded-lg border border-border bg-bg px-2.5 py-2">
              <p className="break-words text-xs text-ink">
                <span className="font-semibold">{nameFor(item.askedBy)}:</span> {item.question}
              </p>

              {item.answer ? (
                <p className="break-words text-xs text-ink">
                  <span className="font-semibold">{nameFor(item.answeredBy as string)}:</span> {item.answer}
                </p>
              ) : item.resolved ? (
                <p className="text-xs text-ink-muted">{nameFor(item.resolvedBy as string)} marked this handled — no reply needed</p>
              ) : item.askedBy === meId ? (
                <p className="text-xs italic text-ink-muted">Waiting for a reply…</p>
              ) : (
                <>
                  <AnswerRow onAnswer={(text) => answer(item, text)} />
                  <button type="button" onClick={() => resolve(item)} className="text-xs text-ink-muted underline hover:text-ink">
                    Mark handled — no reply needed
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ask()
            }
          }}
          placeholder="Ask a question or leave a comment…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
        {draft.trim() && (
          <button type="button" onClick={ask} className="rounded-lg bg-navy px-3 py-1 text-xs font-medium text-bg">
            Send
          </button>
        )}
      </div>
    </div>
  )
}
