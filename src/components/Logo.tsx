interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#1b2436" />
      <path
        d="M32 15 L17 49 M32 15 L47 49 M22 38 L42 38"
        fill="none"
        stroke="#faf7f2"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="47" cy="16" r="5.5" fill="#d97a4d" />
    </svg>
  )
}
