interface IconProps {
  className?: string
}

const BASE = 'h-5 w-5'

// A vertical spine with three nodes and ticks reading outward — distinct
// from a plain calendar glyph, reads as "a timeline of entries" rather
// than "a date."
export function TimelineIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <line x1="6" y1="3" x2="6" y2="21" />
      <circle cx="6" cy="7" r="1.6" />
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="6" cy="17" r="1.6" />
      <path d="M10 7h9M10 12h9M10 17h9" />
    </svg>
  )
}

export function NotesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

// A wallet with a coin slot circle — reads as "money" distinct from
// Shopping/Notes glyphs elsewhere in the app.
export function BudgetIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
      <path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" />
      <path d="M16 12h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4Z" />
    </svg>
  )
}

export function UsIcon({ className }: IconProps) {
  // Hand-built symmetric about x=12 (each control point mirrored exactly,
  // 24-x), rather than eyeballed coordinates — those read as visibly
  // crooked at small sizes.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M12 20C12 20 3 14 3 8.5C3 5.5 5.5 3.5 8 3.5C10 3.5 11.5 5 12 6.5C12.5 5 14 3.5 16 3.5C18.5 3.5 21 5.5 21 8.5C21 14 12 20 12 20Z" />
    </svg>
  )
}

// Built from one tooth shape rotated 8 times around the center, and two
// concentric circles — symmetric by construction, rather than a hand-typed
// cog path (which read visibly lopsided, same issue the heart icon had).
const GEAR_TOOTH_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
      {GEAR_TOOTH_ANGLES.map((angle) => (
        <rect key={angle} x="10.85" y="1.6" width="2.3" height="3" rx="0.7" transform={`rotate(${angle} 12 12)`} />
      ))}
    </svg>
  )
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M6 9a6 6 0 0 1 12 0c0 3.5 1 5 2 6H4c1-1 2-2.5 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function EditIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function AttachmentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M21 11.5 12.4 20a5 5 0 0 1-7-7l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.6 1.6 0 0 1-2.4-2.4l7.4-7.4" />
    </svg>
  )
}

export function DuplicateIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

// A three-quarter ring — paired with a `animate-spin` class wherever it's
// used, rather than baking rotation into the svg itself.
export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className ?? BASE}>
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  )
}

export function DeleteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M18 7l-.8 12.1a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}
