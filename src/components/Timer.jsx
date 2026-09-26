// Timer system — TimerProvider/useTimers (state), QuickTimerButton + QuickTimerPanel
// (start a timer), TimerDock (running timers in the desktop sidebar) and TimerBar
// (running timers floating above the bottom nav on phones/tablets).
import React, { useState, useCallback, useMemo } from 'react';
import { t, useLang } from '../i18n/index.js';
import UtilityPanel from './UtilityPanel.jsx';
import { IconTimer, IconPause, IconPlay, IconReset, IconClose } from './icons.jsx';

// ═══════════════════════════════════════════════
// CONTEXT & PROVIDER
// ═══════════════════════════════════════════════

export const TimerContext = React.createContext();

export function TimerProvider({ children }) {
  const [timers, setTimers] = useState([]);

  const audioCtxRef = React.useRef(null);

  // Stable mutators: the provider re-renders once a second while a timer runs,
  // so every consumer (RecipeDetail among them) would otherwise re-render each
  // tick just because these closures and the context object were recreated.
  const addTimer = useCallback((label, seconds) => {
    const id = Date.now() + Math.random();
    setTimers(prev => [...prev, { id, label, totalSeconds: seconds, remaining: seconds, running: true, startedAt: Date.now() }]);
    return id;
  }, []);

  const removeTimer = useCallback((id) => {
    setTimers(prev => {
      const next = prev.filter(t => t.id !== id);
      // Close AudioContext when no timers remain
      if (next.length === 0 && audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      return next;
    });
  }, []);
  const pauseTimer = useCallback((id) => setTimers(prev => prev.map(t => t.id === id ? {...t, running: false} : t)), []);
  const resumeTimer = useCallback((id) => setTimers(prev => prev.map(t => t.id === id ? {...t, running: true} : t)), []);
  const resetTimer = useCallback((id) => setTimers(prev => prev.map(t => t.id === id ? {...t, remaining: t.totalSeconds, running: false} : t)), []);
  const hasRunning = timers.some(t => t.running && t.remaining > 0);

  React.useEffect(() => {
    if (!hasRunning) return; // No interval when no active timers
    const interval = setInterval(() => {
      setTimers(prev => prev.map(tmr => {
        if (!tmr.running || tmr.remaining <= 0) return tmr;
        const next = tmr.remaining - 1;
        if (next <= 0) {
          // Play alert sound (reuse AudioContext)
          try {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioCtxRef.current;
            [0, 0.3, 0.6].forEach(delay => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.value = 880;
              osc.type = 'sine';
              gain.gain.value = 0.3;
              osc.start(ctx.currentTime + delay);
              osc.stop(ctx.currentTime + delay + 0.15);
            });
          } catch(e) {}
          // Browser notification
          if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
              new Notification('Timer Done!', { body: tmr.label, icon: '🧪' });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission();
            }
          }
        }
        return {...tmr, remaining: Math.max(0, next), running: next > 0 ? true : false};
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  const value = useMemo(
    () => ({ timers, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer }),
    [timers, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer]
  );
  return React.createElement(TimerContext.Provider, { value }, children);
}

export function useTimers() { return React.useContext(TimerContext); }

export function formatTimer(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════
// RUNNING TIMERS
// ═══════════════════════════════════════════════

function TimerItem({ tmr, lang, floating }) {
  const { removeTimer, pauseTimer, resumeTimer, resetTimer } = useTimers();
  const done = tmr.remaining <= 0 && !tmr.running;
  const pct = tmr.totalSeconds ? ((tmr.totalSeconds - tmr.remaining) / tmr.totalSeconds) * 100 : 0;
  return (
    <div className={done ? 'animate-pulse' : undefined} role={done ? 'alert' : undefined}
      style={{
        background: done ? 'var(--primary-light)' : 'var(--card)',
        border: `1px solid ${done ? 'var(--primary)' : 'var(--border-strong)'}`,
        boxShadow: floating ? 'var(--shadow)' : 'none',
        padding: '0.4rem 0.3rem 0.3rem 0.6rem',
      }}>
      <div className="flex items-center gap-2 pr-1">
        <span className="flex-1 min-w-0 truncate" style={{ fontSize: '0.75rem', fontWeight: 600 }} title={tmr.label}>{tmr.label}</span>
        <span className="mono tabular" style={{ fontSize: '0.9375rem', fontWeight: 700, color: done ? 'var(--accent)' : 'var(--text)' }}>
          {done ? t('timerDone', lang) : formatTimer(tmr.remaining)}
        </span>
      </div>
      <div className="flex items-center gap-0.5 mt-0.5">
        {done ? <span className="flex-1" /> : (
          <div className="flex-1 mr-1.5" style={{ height: 3, background: 'var(--bg-2)' }} aria-hidden="true">
            <div style={{ height: '100%', width: `${pct}%`, background: tmr.running ? 'var(--primary)' : 'var(--border)', transition: 'width 1s linear' }} />
          </div>
        )}
        {!done && (tmr.running ? (
          <button type="button" onClick={() => pauseTimer(tmr.id)} className="btn-ghost btn-icon btn-sm" aria-label={lang === 'zh' ? '暂停' : 'Pause'}><IconPause size={13} /></button>
        ) : (
          <button type="button" onClick={() => resumeTimer(tmr.id)} className="btn-ghost btn-icon btn-sm" aria-label={lang === 'zh' ? '继续' : 'Resume'}><IconPlay size={13} /></button>
        ))}
        {!done && <button type="button" onClick={() => resetTimer(tmr.id)} className="btn-ghost btn-icon btn-sm" aria-label={lang === 'zh' ? '重置' : 'Reset'}><IconReset size={13} /></button>}
        <button type="button" onClick={() => removeTimer(tmr.id)} className="btn-ghost btn-icon btn-sm" aria-label={lang === 'zh' ? '移除计时器' : 'Remove timer'}><IconClose size={13} /></button>
      </div>
    </div>
  );
}

// Desktop sidebar section listing every timer.
export function TimerDock() {
  const lang = useLang();
  const { timers } = useTimers();
  if (timers.length === 0) return null;
  return (
    <div className="sidebar-section" aria-label={t('toolTimer', lang)}>
      <div className="nav-group-label" style={{ padding: '0 0 0.4rem' }}>{t('toolTimer', lang)} · {timers.length}</div>
      <div className="space-y-1.5 sidebar-timers">
        {timers.map(tmr => <TimerItem key={tmr.id} tmr={tmr} lang={lang} />)}
      </div>
    </div>
  );
}

// Phones/tablets: running timers float above the bottom nav (hidden ≥1024px,
// where TimerDock shows them in the sidebar instead).
export function TimerBar() {
  const lang = useLang();
  const { timers } = useTimers();
  if (timers.length === 0) return null;
  return (
    <div className="fixed z-40 flex flex-col gap-1.5 lg:hidden"
      style={{
        right: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
        bottom: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 0px) + 0.75rem)',
        width: 'min(260px, calc(100vw - 1.5rem))',
      }}>
      {timers.map(tmr => <TimerItem key={tmr.id} tmr={tmr} lang={lang} floating />)}
    </div>
  );
}

// ═══════════════════════════════════════════════
// QUICK TIMER — trigger + panel
// ═══════════════════════════════════════════════

export function QuickTimerButton({ open, onToggle, variant = 'topbar' }) {
  const lang = useLang();
  const { timers } = useTimers();
  const running = timers.filter(tm => tm.running && tm.remaining > 0).length;
  const label = t('timerAdd', lang);
  if (variant === 'sidebar') {
    return (
      <button type="button" className="sidebar-tool" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog" aria-label={label} title={label}>
        <IconTimer size={15} />
        <span>{t('toolTimer', lang)}{running > 0 ? ` · ${running}` : ''}</span>
      </button>
    );
  }
  return (
    <button type="button" className="topbar-btn relative" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog" aria-label={label} title={label}>
      <IconTimer size={20} />
      {running > 0 && (
        <span aria-hidden="true" className="mono" style={{
          position: 'absolute', top: 6, right: 5, minWidth: 14, height: 14, padding: '0 3px',
          fontSize: 9, fontWeight: 700, lineHeight: '14px', textAlign: 'center',
          background: 'var(--primary)', color: 'var(--on-primary)', border: '1px solid var(--border-strong)',
        }}>{running}</span>
      )}
    </button>
  );
}

const QUICK_TIMES = [
  { min: 1, label: '1 min' },
  { min: 5, label: '5 min' },
  { min: 10, label: '10 min' },
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '1 h' },
];

export function QuickTimerPanel({ open, onClose }) {
  const lang = useLang();
  const { addTimer } = useTimers();
  const [customMin, setCustomMin] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  function startCustom(e) {
    e.preventDefault();
    const m = parseFloat(customMin);
    if (m > 0) {
      addTimer(customLabel || `${m} min`, Math.round(m * 60));
      setCustomMin('');
      setCustomLabel('');
      onClose();
    }
  }

  return (
    <UtilityPanel open={open} onClose={onClose} title={t('timerAdd', lang)} icon={<IconTimer size={15} />}>
      <div className="p-3.5">
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_TIMES.map(qt => (
            <button key={qt.min} type="button" className="btn btn-sm mono"
              onClick={() => { addTimer(customLabel || qt.label, qt.min * 60); setCustomLabel(''); onClose(); }}>
              {qt.label}
            </button>
          ))}
        </div>
        <form onSubmit={startCustom} className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--rule)' }}>
          <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
            aria-label={lang === 'zh' ? '计时器标签' : 'Timer label'}
            placeholder={lang === 'zh' ? '标签（如 封闭）' : 'Label (e.g. Blocking)'} className="w-full" />
          <div className="flex gap-1.5">
            <input type="number" value={customMin} onChange={e => setCustomMin(e.target.value)}
              aria-label={lang === 'zh' ? '分钟数' : 'Minutes'}
              placeholder={t('timerMinutes', lang)} min="0.5" step="0.5" className="flex-1" style={{ minWidth: 0 }} />
            <button type="submit" className="btn-primary" disabled={!(parseFloat(customMin) > 0)}>{t('timerStart', lang)}</button>
          </div>
        </form>
      </div>
    </UtilityPanel>
  );
}

export default TimerProvider;
