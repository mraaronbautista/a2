import { Link } from 'react-router-dom'

export type SchoolSection = 'notes' | 'courses' | 'practice'

const sections: { value: SchoolSection; label: string; to: string }[] = [
  { value: 'notes', label: 'Notes', to: '/notes' },
  { value: 'courses', label: 'Courses', to: '/notes?view=courses' },
  { value: 'practice', label: 'Practice', to: '/practice' },
]

export function SchoolNav({ active, onSelect }: { active: SchoolSection; onSelect?: (section: SchoolSection) => void }) {
  const itemClass = (selected: boolean) => `flex-1 rounded-full px-3 py-1 text-center text-xs font-medium ${selected ? 'bg-accent-bg text-accent' : 'text-ink-muted'}`
  return (
    <nav aria-label="Law School sections" className="flex gap-1 rounded-full bg-surface p-1">
      {sections.map((section) => onSelect
        ? <button key={section.value} type="button" onClick={() => onSelect(section.value)} className={itemClass(active === section.value)}>{section.label}</button>
        : <Link key={section.value} to={section.to} className={itemClass(active === section.value)}>{section.label}</Link>)}
    </nav>
  )
}
