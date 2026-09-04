import { useEffect, useRef, useState } from 'react'

type TimerMode = 'focus' | 'shortBreak' | 'longBreak'

interface TimerState {
  mode: TimerMode
  remainingSeconds: number
  running: boolean
  endsAt: number | null
  completedFocusSessions: number
}

const STORAGE_KEY = 'a2:pomodoro:v1'
const DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

const LABELS: Record<TimerMode, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
}

function initialState(): TimerState {
  const fallback: TimerState = {
    mode: 'focus',
    remainingSeconds: DURATIONS.focus,
    running: false,
    endsAt: null,
    completedFocusSessions: 0,
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<TimerState>
    const mode = saved.mode && saved.mode in DURATIONS ? saved.mode : fallback.mode
    if (saved.running && saved.endsAt) {
      const remaining = Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000))
      return {
        mode,
        remainingSeconds: remaining,
        running: remaining > 0,
        endsAt: remaining > 0 ? saved.endsAt : null,
        completedFocusSessions: saved.completedFocusSessions ?? 0,
      }
    }
    return {
      ...fallback,
      mode,
      remainingSeconds: saved.remainingSeconds ?? DURATIONS[mode],
      completedFocusSessions: saved.completedFocusSessions ?? 0,
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
  const completionHandledRef = useRef(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer))
  }, [timer])

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
    document.title = `${formatTime(timer.remainingSeconds)} · ${LABELS[timer.mode]} · A²`
    return () => {
      document.title = 'A²'
    }
  }, [timer.running, timer.remainingSeconds, timer.mode])

  function chooseMode(mode: TimerMode) {
    completionHandledRef.current = false
    setTimer((current) => ({
      ...current,
      mode,
      remainingSeconds: DURATIONS[mode],
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
      const seconds = current.remainingSeconds || DURATIONS[current.mode]
      return { ...current, remainingSeconds: seconds, running: true, endsAt: Date.now() + seconds * 1000 }
    })
  }

  function reset() {
    completionHandledRef.current = false
    setTimer((current) => ({
      ...current,
      remainingSeconds: DURATIONS[current.mode],
      running: false,
      endsAt: null,
    }))
  }

  return (
    <div className="fixed right-4 bottom-28 z-40 flex flex-col items-end gap-2 md:right-6 md:bottom-6">
      {open && (
        <section className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Study session</p>
              <h2 className="mt-1 text-lg font-semibold text-navy">{LABELS[timer.mode]}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close timer" className="px-2 text-xl text-ink-muted">×</button>
          </div>

          <p className="my-5 text-center text-5xl font-semibold tabular-nums text-navy" aria-live="polite">
            {formatTime(timer.remainingSeconds)}
          </p>

          <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
            {(Object.keys(DURATIONS) as TimerMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => chooseMode(mode)}
                className={[
                  'rounded-lg px-2 py-2 text-xs font-medium',
                  timer.mode === mode ? 'bg-surface text-accent shadow-sm' : 'text-ink-muted',
                ].join(' ')}
              >
                {mode === 'focus' ? '25 min' : mode === 'shortBreak' ? '5 min' : '15 min'}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
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
        <span className="text-xs font-normal text-ink-muted">{LABELS[timer.mode]}</span>
      </button>
    </div>
  )
}
