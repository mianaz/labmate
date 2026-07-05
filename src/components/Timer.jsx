// Timer system — TimerContext, TimerProvider, useTimers, TimerBar, QuickTimerButton
import React, { useState } from 'react';
import { t, useLang } from '../i18n/index.js';
import { S_MUTED, S_BG2 } from '../lib/styleConstants.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';

// ═══════════════════════════════════════════════
// CONTEXT & PROVIDER
// ═══════════════════════════════════════════════

export const TimerContext = React.createContext();

export function TimerProvider({ children }) {
  const [timers, setTimers] = useState([]);

  const addTimer = (label, seconds) => {
    const id = Date.now() + Math.random();
    setTimers(prev => [...prev, { id, label, totalSeconds: seconds, remaining: seconds, running: true, startedAt: Date.now() }]);
    return id;
  };

  const removeTimer = (id) => {
    setTimers(prev => {
      const next = prev.filter(t => t.id !== id);
      // Close AudioContext when no timers remain
      if (next.length === 0 && audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      return next;
    });
  };
  const pauseTimer = (id) => setTimers(prev => prev.map(t => t.id === id ? {...t, running: false} : t));
  const resumeTimer = (id) => setTimers(prev => prev.map(t => t.id === id ? {...t, running: true} : t));
  const resetTimer = (id) => setTimers(prev => prev.map(t => t.id === id ? {...t, remaining: t.totalSeconds, running: false} : t));

  const audioCtxRef = React.useRef(null);
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
          if (Notification.permission === 'granted') {
            new Notification('Timer Done!', { body: tmr.label, icon: '🧪' });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        }
        return {...tmr, remaining: Math.max(0, next), running: next > 0 ? true : false};
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  return React.createElement(TimerContext.Provider, { value: { timers, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer } }, children);
}

export function useTimers() { return React.useContext(TimerContext); }

// ═══════════════════════════════════════════════
// TIMER BAR — Floating display for active timers
// ═══════════════════════════════════════════════

export function TimerBar() {
  const lang = useLang();
  const isMobile = useIsMobile();
  const { timers, removeTimer, pauseTimer, resumeTimer, resetTimer } = useTimers();
  const active = timers.filter(t => t.remaining > 0 || t.running);
  const done = timers.filter(t => t.remaining <= 0 && !t.running);

  if (timers.length === 0) return null;

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fixed z-40 space-y-2 ${isMobile ? '' : 'bottom-4 right-4'}`} style={{
      ...(isMobile ? { bottom: 'calc(var(--fab-b) + 3.75rem)', right: 'calc(env(safe-area-inset-right, 0px) + 1rem)' } : {}),
      maxWidth: '320px',
    }}>
      {active.map(tmr => {
        const pct = ((tmr.totalSeconds - tmr.remaining) / tmr.totalSeconds) * 100;
        return (
          <div key={tmr.id} className="p-3 shadow-lg" style={{background:'var(--card)', border:'2px solid var(--border-strong)'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold truncate" style={{color:'var(--text)', maxWidth:'160px'}}>{tmr.label}</span>
              <span className="mono text-sm font-bold" style={{color: tmr.remaining < 60 ? 'var(--accent)' : 'var(--primary)'}}>{fmtTime(tmr.remaining)}</span>
            </div>
            <div className="w-full h-1.5 overflow-hidden" style={S_BG2}>
              <div className="h-full transition-all" style={{width:`${pct}%`, background:'var(--primary)'}} />
            </div>
            <div className="flex gap-1 mt-2">
              {tmr.running ? (
                <button onClick={() => pauseTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded" style={{background:'var(--bg-2)', color:'var(--text-muted)'}}>⏸</button>
              ) : (
                <button onClick={() => resumeTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded" style={{background:'var(--primary-light)', color:'var(--primary)'}}>▶</button>
              )}
              <button onClick={() => resetTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded" style={{background:'var(--bg-2)', color:'var(--text-muted)'}}>↺</button>
              <button onClick={() => removeTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded" style={{background:'var(--accent-light)', color:'var(--accent)'}}>✕</button>
            </div>
          </div>
        );
      })}
      {done.map(tmr => (
        <div key={tmr.id} className="p-3 shadow-lg animate-pulse" style={{background:'var(--accent-light)', border:'2px solid var(--accent)'}}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{color:'var(--accent)'}}>{tmr.label} — {t('timerDone', lang)}</span>
            <button onClick={() => removeTimer(tmr.id)} className="text-xs px-2 py-0.5 rounded" style={{background:'var(--card)', color:'var(--text-muted)'}}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// QUICK TIMER BUTTON — Floating FAB with popup
// ═══════════════════════════════════════════════

export function QuickTimerButton() {
  const lang = useLang();
  const isMobile = useIsMobile();
  const { addTimer } = useTimers();
  const [open, setOpen] = useState(false);
  const [customMin, setCustomMin] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const quickTimes = [
    { min: 1, label: '1 min' },
    { min: 5, label: '5 min' },
    { min: 10, label: '10 min' },
    { min: 15, label: '15 min' },
    { min: 30, label: '30 min' },
    { min: 60, label: '1 h' },
  ];

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed z-40 w-12 h-12 flex items-center justify-center text-lg shadow-lg transition-transform hover:scale-110"
        style={{
          bottom: 'var(--fab-b)',
          right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
          background:'var(--primary)', color:'var(--on-primary)', border:'2px solid var(--border-strong)',
        }} title={t('timerAdd', lang)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="13" x2="15" y2="13"/>
          <line x1="10" y1="2" x2="14" y2="2"/>
          <line x1="12" y1="2" x2="12" y2="5"/>
          <line x1="19.5" y1="7.5" x2="21" y2="6"/>
        </svg>
      </button>
    );
  }

  return (
    <div className={`fixed z-40 p-4 shadow-lg ${isMobile ? '' : 'bottom-36 right-4'}`} style={{
      ...(isMobile ? { bottom: 'calc(var(--fab-b) + 3.75rem)', right: 'calc(env(safe-area-inset-right, 0px) + 1rem)' } : {}),
      background:'var(--card)', border:'2px solid var(--border-strong)', width:'280px', overflow:'hidden',
    }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold">{t('timerAdd', lang)}</span>
        <button onClick={() => setOpen(false)} className="text-xs px-2 py-0.5 rounded" style={S_MUTED}>✕</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {quickTimes.map(qt => (
          <button key={qt.min} onClick={() => { addTimer(qt.label, qt.min * 60); setOpen(false); }}
            className="px-2 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--border)'}}>
            {qt.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
          placeholder={lang === 'en' ? 'Label (e.g. Blocking)' : '标签（如 封闭）'}
          className="w-full px-2 py-1.5 rounded text-xs"
          style={{background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text)'}} />
        <div className="flex gap-2">
          <input type="number" value={customMin} onChange={e => setCustomMin(e.target.value)}
            placeholder={t('timerMinutes', lang)} min="0.5" step="0.5"
            className="flex-1 px-2 py-1.5 rounded text-xs min-w-0"
            style={{background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text)', minWidth:0}} />
          <button onClick={() => {
            const m = parseFloat(customMin);
            if (m > 0) { addTimer(customLabel || `${m} min`, m * 60); setCustomMin(''); setCustomLabel(''); setOpen(false); }
          }}
            className="px-3 py-1.5 rounded text-xs font-bold"
            style={{background:'var(--primary)', color:'var(--on-primary)', whiteSpace:'nowrap', flexShrink:0}}>
            {t('timerStart', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TimerProvider;
