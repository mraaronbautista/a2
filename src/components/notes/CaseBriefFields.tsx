export interface CaseBrief {
  facts: string
  issue: string
  holding: string
  reasoning: string
  dissent: string
}

interface CaseBriefFieldsProps {
  value: CaseBrief
  editable: boolean
  onChange: (value: CaseBrief) => void
}

const FIELDS: { key: keyof CaseBrief; label: string }[] = [
  { key: 'facts', label: 'Facts' },
  { key: 'issue', label: 'Issue' },
  { key: 'holding', label: 'Holding' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'dissent', label: 'Dissent' },
]

export function CaseBriefFields({ value, editable, onChange }: CaseBriefFieldsProps) {
  return (
    <div className="space-y-3">
      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-semibold text-ink-muted">{label}</label>
          <textarea
            value={value[key]}
            readOnly={!editable}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            rows={3}
            className="mt-1 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
      ))}
    </div>
  )
}
