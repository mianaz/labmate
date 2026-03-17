import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

// ── Timer types ──

interface Timer {
  id: number
  label: string
  totalSeconds: number
  remaining: number
  running: boolean
}

interface TimerContextValue {
  timers: Timer[]
  addTimer: (label: string, seconds: number) => number
  removeTimer: (id: number) => void
  pauseTimer: (id: number) => void
  resumeTimer: (id: number) => void
  resetTimer: (id: number) => void
}

const TimerContext = createContext<TimerContextValue>({
  timers: [],
  addTimer: () => 0,
  removeTimer: () => {},
  pauseTimer: () => {},
  resumeTimer: () => {},
  resetTimer: () => {},
})

export function useTimers() {
  return useContext(TimerContext)
}

// ── Provider ──

export default function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }

  const addTimer = (label: string, seconds: number) => {
    const id = Date.now() + Math.random()
    const s = Math.round(seconds) // guard against floating-point drift
    setTimers(prev => [...prev, { id, label, totalSeconds: s, remaining: s, running: true }])
    return id
  }

  const removeTimer = (id: number) => setTimers(prev => prev.filter(t => t.id !== id))
  const pauseTimer = (id: number) => setTimers(prev => prev.map(t => t.id === id ? { ...t, running: false } : t))
  const resumeTimer = (id: number) => setTimers(prev => prev.map(t => t.id === id ? { ...t, running: true } : t))
  const resetTimer = (id: number) => setTimers(prev => prev.map(t => t.id === id ? { ...t, remaining: t.totalSeconds, running: false } : t))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => prev.map(tmr => {
        if (!tmr.running || tmr.remaining <= 0) return tmr
        const next = tmr.remaining - 1
        if (next <= 0) {
          // Audio alert — triple beep
          try {
            const ctx = getAudioCtx()
            if (ctx.state === 'suspended') ctx.resume()
            ;[0, 0.3, 0.6].forEach(delay => {
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.frequency.value = 880
              osc.type = 'sine'
              gain.gain.value = 0.3
              osc.start(ctx.currentTime + delay)
              osc.stop(ctx.currentTime + delay + 0.15)
            })
          } catch { /* audio not available */ }
          // Browser notification
          if (Notification.permission === 'granted') {
            new Notification('Timer Done!', { body: tmr.label })
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission()
          }
        }
        return { ...tmr, remaining: Math.max(0, next), running: next > 0 }
      }))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <TimerContext.Provider value={{ timers, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer }}>
      {children}
    </TimerContext.Provider>
  )
}

// ── Floating Timer Bar (bottom-right) ──

export function TimerBar() {
  const { t } = useTranslation()
  const { timers, removeTimer, pauseTimer, resumeTimer, resetTimer } = useTimers()
  const active = timers.filter(tmr => tmr.remaining > 0 || tmr.running)
  const done = timers.filter(tmr => tmr.remaining <= 0 && !tmr.running)

  if (timers.length === 0) return null

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2" style={{ maxWidth: 320 }}>
      {active.map(tmr => {
        const pct = ((tmr.totalSeconds - tmr.remaining) / tmr.totalSeconds) * 100
        return (
          <div key={tmr.id} className="rounded-xl p-3" style={{
            background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)', backdropFilter: 'blur(10px)',
          }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)', maxWidth: 160 }}>
                {tmr.label}
              </span>
              <span className="mono text-sm font-bold" style={{
                color: tmr.remaining < 60 ? 'var(--color-error)' : 'var(--color-primary)',
                fontFamily: 'var(--font-mono)',
              }}>
                {fmtTime(tmr.remaining)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border-light)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--color-primary)' }} />
            </div>
            <div className="flex gap-1 mt-2">
              {tmr.running ? (
                <button onClick={() => pauseTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>
                  {t('timer.pause')}
                </button>
              ) : (
                <button onClick={() => resumeTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'hsl(168, 55%, 92%)', color: 'var(--color-primary)', border: 'none', cursor: 'pointer' }}>
                  {t('timer.resume')}
                </button>
              )}
              <button onClick={() => resetTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>
                {t('timer.reset')}
              </button>
              <button onClick={() => removeTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'var(--color-border-light)', color: 'var(--color-error)', border: 'none', cursor: 'pointer' }}>
                &times;
              </button>
            </div>
          </div>
        )
      })}
      {done.map(tmr => (
        <div key={tmr.id} className="rounded-xl p-3" style={{
          background: 'hsl(168, 55%, 92%)', border: '2px solid var(--color-primary)',
          boxShadow: 'var(--shadow-lg)', animation: 'pulse 2s infinite',
        }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
              {tmr.label} — {t('timer.done')}
            </span>
            <button onClick={() => removeTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>
              &times;
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Quick Timer FAB (bottom-left) ──

export function QuickTimerButton() {
  const { t } = useTranslation()
  const { addTimer } = useTimers()
  const [open, setOpen] = useState(false)
  const [customMin, setCustomMin] = useState('')
  const [customLabel, setCustomLabel] = useState('')

  // Auto-collapse after 60s of inactivity
  const lastActivityRef = useRef(0)
  const touch = useCallback(() => { lastActivityRef.current = Date.now() }, [])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 60_000) setOpen(false)
    }, 5000)
    return () => clearInterval(id)
  }, [open])

  const quickTimes = [
    { min: 1, label: '1 min' },
    { min: 5, label: '5 min' },
    { min: 10, label: '10 min' },
    { min: 15, label: '15 min' },
    { min: 30, label: '30 min' },
    { min: 60, label: '1 h' },
  ]

  if (!open) {
    return (
      <button
        onClick={() => { lastActivityRef.current = Date.now(); setOpen(true) }}
        className="fixed bottom-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center text-lg transition-transform hover:scale-110"
        style={{ background: 'var(--color-primary)', color: 'white', opacity: 0.85, border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-lg)' }}
        title={t('timer.add')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="13" x2="15" y2="13" />
          <line x1="10" y1="2" x2="14" y2="2" />
          <line x1="12" y1="2" x2="12" y2="5" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 left-4 z-50 rounded-xl p-4" style={{
      background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
      width: 280, boxShadow: 'var(--shadow-lg)',
    }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{t('timer.add')}</span>
        <button onClick={() => setOpen(false)} className="text-xs px-2 py-0.5 rounded"
          style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          &times;
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {quickTimes.map(qt => (
          <button
            key={qt.min}
            onClick={() => { touch(); addTimer(qt.label, qt.min * 60); setOpen(false) }}
            className="px-2 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{
              background: 'hsl(168, 55%, 92%)', color: 'var(--color-primary)',
              border: '1px solid var(--color-border)', cursor: 'pointer',
            }}
          >
            {qt.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <input
          type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
          placeholder={t('timer.labelPlaceholder')}
          className="w-full px-2 py-1.5 rounded text-xs"
          style={{ background: 'var(--color-border-light)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <div className="flex gap-2">
          <input
            type="number" value={customMin} onChange={e => setCustomMin(e.target.value)}
            placeholder={t('timer.minutes')} min="0.5" step="0.5"
            className="flex-1 px-2 py-1.5 rounded text-xs"
            style={{ background: 'var(--color-border-light)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <button
            onClick={() => {
              const m = parseFloat(customMin)
              if (m > 0) {
                addTimer(customLabel || `${m} min`, m * 60)
                setCustomMin('')
                setCustomLabel('')
                setOpen(false)
              }
            }}
            className="px-3 py-1.5 rounded text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {t('timer.start')}
          </button>
        </div>
      </div>
    </div>
  )
}
