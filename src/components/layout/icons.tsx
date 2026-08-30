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
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? BASE}>
      <path d="M12 20.5s-7-4.2-9.3-8.4C1.1 8.7 3 5.3 6.3 5.3c1.9 0 3.4 1.1 3.9 2.2.5-1.1 2-2.2 3.9-2.2 3.3 0 5.2 3.4 3.6 6.8C19.2 16.3 12 20.5 12 20.5z" />
    </svg>
  )
}
