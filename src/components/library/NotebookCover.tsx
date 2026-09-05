import type { NotebookCover as Cover } from '../../lib/libraryTypes'

export function NotebookCover({ cover, className = '' }: { cover: Cover; className?: string }) {
  const pattern = cover.pattern === 'grid' ? 'linear-gradient(#ffffff30 1px,transparent 1px),linear-gradient(90deg,#ffffff30 1px,transparent 1px)' : cover.pattern === 'linen' ? 'repeating-linear-gradient(0deg,#ffffff20 0,#ffffff20 1px,transparent 1px,transparent 5px)' : cover.pattern === 'diagonal' ? 'repeating-linear-gradient(135deg,#ffffff22 0,#ffffff22 6px,transparent 6px,transparent 14px)' : cover.pattern === 'legal' ? 'linear-gradient(90deg,transparent 14%,#ffffff55 14%,#ffffff55 calc(14% + 1px),transparent calc(14% + 1px))' : cover.pattern === 'speckled' ? 'radial-gradient(#ffffff45 1px,transparent 1px)' : undefined
  return <div aria-hidden className={`flex items-center justify-center rounded-lg text-2xl shadow-resting ${className}`} style={{ backgroundColor: cover.color, backgroundImage: pattern, backgroundSize: cover.pattern === 'grid' ? '12px 12px' : cover.pattern === 'speckled' ? '9px 9px' : undefined }}>{cover.icon ?? '📓'}</div>
}
