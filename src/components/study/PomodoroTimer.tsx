import { useEffect, useRef, useState } from 'react'

type TimerMode = 'focus' | 'shortBreak' | 'longBreak'

interface TimerState {
  mode: TimerMode
  remainingSeconds: number
  running: boolean
  endsAt: number | null
  completedFocusSessions: number
  label: string
  durations: Record<TimerMode, number>
}

const STORAGE_KEY = 'a2:pomodoro:v2'
const DEFAULT_DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}
const DURATION_PRESETS_MIN = [5, 10, 15, 20, 25, 30, 45, 60]
const MIN_DURATION_MIN = 1
const MAX_DURATION_MIN = 180

const LABELS: Record<TimerMode, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
}

function readDurations(saved: Partial<TimerState>): Record<TimerMode, number> {
  return {
    focus: saved.durations?.focus ?? DEFAULT_DURATIONS.focus,
    shortBreak: saved.durations?.shortBreak ?? DEFAULT_DURATIONS.shortBreak,
    longBreak: saved.durations?.longBreak ?? DEFAULT_DURATIONS.longBreak,
  }
}

function initialState(): TimerState {
  const fallback: TimerState = {
    mode: 'focus',
    remainingSeconds: DEFAULT_DURATIONS.focus,
    running: false,
    endsAt: null,
    completedFocusSessions: 0,
    label: '',
    durations: DEFAULT_DURATIONS,
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<TimerState>
    const mode = saved.mode && saved.mode in DEFAULT_DURATIONS ? saved.mode : fallback.mode
    const durations = readDurations(saved)
    const label = saved.label ?? ''

    if (saved.running && saved.endsAt) {
      const remaining = Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000))
      return {
        mode,
        remainingSeconds: remaining,
        running: remaining > 0,
        endsAt: remaining > 0 ? saved.endsAt : null,
        completedFocusSessions: saved.completedFocusSessions ?? 0,
        label,
        durations,
      }
    }
    return {
      ...fallback,
      mode,
      remainingSeconds: saved.remainingSeconds ?? durations[mode],
      completedFocusSessions: saved.completedFocusSessions ?? 0,
      label,
      durations,
    }
  } catch {
    return fallback
  }
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function playCompletionTone() {
  try {
    const AudioContextClass = window.AudioContext
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.setValueAtTime(740, context.currentTime)
    gain.gain.setValueAtTime(0.08, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.8)
  } catch {
    // The visual completion state remains sufficient when audio is blocked.
  }
}

export function PomodoroTimer() {
  const [timer, setTimer] = useState<TimerState>(initialState)
  const [open, setOpen] = useState(false)
  const [durationDraft, setDurationDraft] = useState(() => String(Math.round(timer.durations.focus / 60)))
  const completionHandledRef = useRef(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer))
  }, [timer])

  // Keeps the typed-minutes field in sync whenever the active mode changes,
  // or a preset/stepper click changes that mode's duration elsewhere — so
  // it never shows a stale number left over from the last thing edited.
  useEffect(() => {
    setDurationDraft(String(Math.round(timer.durations[timer.mode] / 60)))
  }, [timer.mode, timer.durations])

  useEffect(() => {
    if (!timer.running || !timer.endsAt) return

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timer.endsAt! - Date.now()) / 1000))
      if (remaining > 0) {
        setTimer((current) => ({ ...current, remainingSeconds: remaining }))
        return
      }

      if (!completionHandledRef.current) {
        completionHandledRef.current = true
        playCompletionTone()
      }
      setTimer((current) => ({
        ...current,
        running: false,
        endsAt: null,
        remainingSeconds: 0,
        completedFocusSessions:
          current.mode === 'focus' ? current.completedFocusSessions + 1 : current.completedFocusSessions,
      }))
    }

    tick()
    const interval = window.setInterval(tick, 500)
    return () => window.clearInterval(interval)
  }, [timer.running, timer.endsAt])

  useEffect(() => {
    if (!timer.running) {
      document.title = 'A²'
      return
    }
    document.title = `${formatTime(timer.remainingSeconds)} · ${timer.label || LABELS[timer.mode]} · A²`
    return () => {
      document.title = 'A²'
    }
  }, [timer.running, timer.remainingSeconds, timer.mode, timer.label])

  function chooseMode(mode: TimerMode) {
    completionHandledRef.current = false
    setTimer((current) => ({
      ...current,
      mode,
      remainingSeconds: current.durations[mode],
      running: false,
      endsAt: null,
    }))
  }

  function toggleRunning() {
    completionHandledRef.current = false
    setTimer((current) => {
      if (current.running && current.endsAt) {
        return {
          ...current,
          running: false,
          endsAt: null,
          remainingSeconds: Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)),
        }
      }
      const seconds = current.remainingSeconds || current.durations[current.mode]
      return { ...current, remainingSeconds: seconds, running: true, endsAt: Date.now() + seconds * 1000 }
    })
  }

  function reset() {
    completionHandledRef.current = false
    setTimer((current) => ({
      ...current,
      remainingSeconds: current.durations[current.mode],
      running: false,
      endsAt: null,
    }))
  }

  function setDurationMinutes(minutes: number) {
    const clamped = Math.min(MAX_DURATION_MIN, Math.max(MIN_DURATION_MIN, Math.round(minutes)))
    completionHandledRef.current = false
    setTimer((current) => ({
      ...current,
      durations: { ...current.durations, [current.mode]: clamped * 60 },
      remainingSeconds: clamped * 60,
      running: false,
      endsAt: null,
    }))
  }

  function commitDurationDraft() {
    const parsed = Number(durationDraft)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDurationDraft(String(Math.round(timer.durations[timer.mode] / 60)))
      return
    }
    setDurationMinutes(parsed)
  }

  const currentMinutes = Math.round(timer.durations[timer.mode] / 60)

  return (
    <div className="fixed inset-x-0 bottom-28 z-40 flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:items-end">
      {open && (
        <section className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{LABELS[timer.mode]}</p>
              <input
                type="text"
                value={timer.label}
                onChange={(e) => setTimer((current) => ({ ...current, label: e.target.value }))}
                placeholder="What are you focusing on?"
                className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-0 text-lg font-semibold text-navy outline-none focus:border-border focus:bg-bg focus:px-2 focus:py-1"
              />
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close timer" className="px-2 text-xl text-ink-muted">×</button>
          </div>

          <p className="my-5 text-center text-5xl font-semibold tabular-nums text-navy" aria-live="polite">
            {formatTime(timer.remainingSeconds)}
          </p>

          <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
            {(Object.keys(DEFAULT_DURATIONS) as TimerMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => chooseMode(mode)}
                className={[
                  'rounded-lg px-2 py-2 text-xs font-medium tabular-nums',
                  timer.mode === mode ? 'bg-surface text-accent shadow-sm' : 'text-ink-muted',
                ].join(' ')}
              >
                {Math.round(timer.durations[mode] / 60)} min
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border p-2.5">
            <div className="flex flex-wrap justify-center gap-1.5">
              {DURATION_PRESETS_MIN.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDurationMinutes(minutes)}
                  className={[
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    currentMinutes === minutes ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                  ].join(' ')}
                >
                  {minutes}m
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 rounded-full bg-bg p-1">
              <button
                type="button"
                onClick={() => setDurationMinutes(currentMinutes - 5)}
                aria-label="Decrease minutes"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-lg leading-none font-semibold text-navy shadow-sm"
              >
                −
              </button>
              <span className="flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_DURATION_MIN}
                  max={MAX_DURATION_MIN}
                  value={durationDraft}
                  onChange={(e) => setDurationDraft(e.target.value)}
                  onBlur={commitDurationDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                  className="w-12 bg-transparent text-center text-sm font-semibold text-navy outline-none"
                />
                <span className="text-xs text-ink-muted">min</span>
              </span>
              <button
                type="button"
                onClick={() => setDurationMinutes(currentMinutes + 5)}
                aria-label="Increase minutes"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-lg leading-none font-semibold text-navy shadow-sm"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={toggleRunning} className="flex-1 rounded-lg bg-accent px-4 py-2.5 font-medium text-white">
              {timer.running ? 'Pause' : timer.remainingSeconds === 0 ? 'Start again' : 'Start'}
            </button>
            <button type="button" onClick={reset} className="rounded-lg border border-border px-4 py-2.5 text-sm text-ink-muted">Reset</button>
          </div>

          <p className="mt-3 text-center text-xs text-ink-muted">
            {timer.completedFocusSessions} focus {timer.completedFocusSessions === 1 ? 'session' : 'sessions'} completed on this device
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close study timer' : 'Open study timer'}
        className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-navy shadow-lg"
      >
        <span className={timer.running ? 'h-2.5 w-2.5 animate-pulse rounded-full bg-accent' : 'h-2.5 w-2.5 rounded-full bg-ink-muted'} />
        <span className="tabular-nums">{formatTime(timer.remainingSeconds)}</span>
        <span className="max-w-32 truncate text-xs font-normal text-ink-muted">{timer.label || LABELS[timer.mode]}</span>
      </button>
    </div>
  )
}
