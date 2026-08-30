interface HowToGuideProps {
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'Today',
    body: "Day/Week/Month agenda — everything due or scheduled, plus recurring class times. Quick-add a task or event from the + button. Nudges from your partner are pinned at the top.",
  },
  {
    title: 'Courses',
    body: 'Reading lists with due dates, source links, and per-person completion. The class-prep pill cycles Unprepped → Prepped → Cold-called.',
  },
  {
    title: 'Notes',
    body: 'Case briefs (Facts/Issue/Holding/Reasoning/Dissent) or freeform rich text with headings, highlights, and images. Private by default — share explicitly when you want your partner to see one.',
  },
  {
    title: 'Us',
    body: "Nudge your partner to flag a task or reading, with two-way On it/Later/Done reactions. Thoughts is a scratchpad for anything unstructured — pin it, comment on it, or promote it straight into a task.",
  },
]

export function HowToGuide({ onClose }: HowToGuideProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-t-2xl border border-border bg-surface p-6 md:rounded-2xl"
      >
        <h2 className="text-sm font-semibold text-navy">How to use A²</h2>
        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="text-sm font-medium text-ink">{s.title}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
