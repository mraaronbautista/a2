import { useState } from 'react'

interface MonthYearPickerProps {
  anchorDate: Date
  onSelect: (date: Date) => void
  onClose: () => void
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthYearPicker({ anchorDate, onSelect, onClose }: MonthYearPickerProps) {
  const [year, setYear] = useState(anchorDate.getFullYear())

  return (
    <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-4 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-ink-muted hover:text-ink"
            aria-label="Previous year"
          >
            ‹
          </button>
          <span className="text-base font-semibold text-navy">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-ink-muted hover:text-ink"
            aria-label="Next year"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {MONTHS.map((label, i) => {
            const isSelected = year === anchorDate.getFullYear() && i === anchorDate.getMonth()
            return (
              <button
                key={label}
                onClick={() => onSelect(new Date(year, i, 1))}
                className={[
                  'rounded-lg px-2 py-2.5 text-sm font-medium',
                  isSelected ? 'bg-accent-bg text-accent' : 'bg-bg text-ink hover:text-accent',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>

        <button onClick={onClose} className="w-full text-center text-sm text-ink-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  )
}
