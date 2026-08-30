interface IconProps {
  className?: string
}

const BASE = 'h-5 w-5'

export function TodayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  )
}

export function CoursesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M12 6.5c-1.6-1.1-4-1.6-6.5-1.2v13c2.5-.4 4.9.1 6.5 1.2" />
      <path d="M12 6.5c1.6-1.1 4-1.6 6.5-1.2v13c-2.5-.4-4.9.1-6.5 1.2" />
      <path d="M12 6.5v13" />
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
