// Timer system — TimerProvider/useTimers (state), QuickTimerButton + QuickTimerPanel
// (start a timer), TimerDock (running timers in the desktop sidebar) and TimerBar
// (running timers floating above the bottom nav on phones/tablets).
//
// A running timer stores the moment it ends, not a counter: browsers throttle
// background tabs and suspend locked phones, and a counter that only moved when
// the page got CPU time fell minutes behind. Timers are saved to localStorage, so
// a reload or relaunch keeps them, and followed across open tabs.
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { t, useLang } from '../i18n/index.js';
import UtilityPanel from './UtilityPanel.jsx';
import { IconTimer, IconPause, IconPlay, IconReset, IconClose } from './icons.jsx';
import { primeTimerAlerts, unlockTimerAudio, alertTimerDone, releaseTimerAudio } from '../lib/timerAlerts.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

export const TIMERS_KEY = 'labmate_timers';

// ═══════════════════════════════════════════════
// TIMER MODEL
// ═══════════════════════════════════════════════
// { id, label, totalSeconds, running, endsAt (ms, while running),
//   remaining (s, while paused), done, finishedAt (ms) }

export function timerRemaining(tmr, now) {
  if (!tmr.running) return tmr.remaining;
  return Math.max(0, Math.ceil((tmr.endsAt - now) / 1000));
}

function finished(tmr) {
  return { ...tmr, running: false, done: true, remaining: 0, endsAt: null, finishedAt: tmr.endsAt };
}

function isTimer(x) {
  return !!x && typeof x === 'object' && ['number', 'string'].includes(typeof x.id)
    && typeof x.label === 'string' && Number.isFinite(x.totalSeconds) && x.totalSeconds > 0
    && (x.running ? Number.isFinite(x.endsAt) : Number.isFinite(x.remaining));
}

// Stored timers that ran out while the page was closed come back finished, without
// an alarm: that may have been hours ago, and the dock shows them as done.
export function parseTimers(raw, now) {
  let list;
  try { list = JSON.parse(raw || '[]'); } catch { return []; }
  if (!Array.isArray(list)) return [];
  return list.filter(isTimer).map(tmr => (tmr.running && tmr.endsAt <= now ? finished(tmr) : tmr));
}

function loadTimers() {
  try { return parseTimers(localStorage.getItem(TIMERS_KEY), Date.now()); } catch { return []; }
}

// ═══════════════════════════════════════════════
// CONTEXT & PROVIDER
// ═══════════════════════════════════════════════

export const TimerContext = React.createContext();
// The actions never change, so components that only start timers (RecipeDetail)
// don't re-render every second while one runs.
const TimerActionsContext = React.createContext();

export function TimerProvider({ children }) {
  const [timers, setTimers] = useState(loadTimers);
  const [now, setNow] = useState(() => Date.now());
  const coarsePointer = useMediaQuery('(pointer: coarse)');

  // "id:endsAt|…" for the running timers: changes only when one starts, pauses or ends.
  const runningKey = timers.filter(tm => tm.running).map(tm => `${tm.id}:${tm.endsAt}`).join('|');
  const hasRunning = runningKey !== '';

  const addTimer = useCallback((label, seconds) => {
    const total = Math.max(1, Math.round(seconds));
    const start = Date.now();
    const id = start + Math.random();
    primeTimerAlerts();
    setTimers(prev => [...prev, { id, label, totalSeconds: total, remaining: total, running: true, endsAt: start + total * 1000, startedAt: start }]);
    setNow(start);
    return id;
  }, []);
  const removeTimer = useCallback((id) => setTimers(prev => prev.filter(tm => tm.id !== id)), []);
  const pauseTimer = useCallback((id) => {
    const at = Date.now();
    setTimers(prev => prev.map(tm => (tm.id === id && tm.running && tm.endsAt > at
      ? { ...tm, running: false, remaining: timerRemaining(tm, at), endsAt: null }
      : tm)));
  }, []);
  const resumeTimer = useCallback((id) => {
    const at = Date.now();
    primeTimerAlerts();
    setTimers(prev => prev.map(tm => (tm.id === id && !tm.running && !tm.done && tm.remaining > 0
      ? { ...tm, running: true, endsAt: at + tm.remaining * 1000 }
      : tm)));
    setNow(at);
  }, []);
  const resetTimer = useCallback((id) => setTimers(prev => prev.map(tm => (tm.id === id
    ? { ...tm, running: false, done: false, remaining: tm.totalSeconds, endsAt: null, finishedAt: null }
    : tm))), []);

  // Save, and follow changes made in other tabs (the storage event only fires there).
  useEffect(() => {
    try {
      if (timers.length) localStorage.setItem(TIMERS_KEY, JSON.stringify(timers));
      else localStorage.removeItem(TIMERS_KEY);
    } catch { /* storage blocked or full: timers still run for this session */ }
    if (!timers.length) releaseTimerAudio();
  }, [timers]);
  useEffect(() => {
    const onStorage = (e) => { if (e.key === TIMERS_KEY) setTimers(parseTimers(e.newValue, Date.now())); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // While something runs: repaint when the next displayed second changes, give each
  // timer a one-shot timeout for the moment it ends (hidden tabs batch chained timers
  // to once a minute, but not one-shots), and catch up at once when the page is
  // shown again after a locked screen or another tab.
  useEffect(() => {
    if (!runningKey) return undefined;
    const ends = runningKey.split('|').map(entry => Number(entry.slice(entry.lastIndexOf(':') + 1)));
    let tickHandle;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      let wait = 1000;
      for (const end of ends) if (end > at) wait = Math.min(wait, (end - at) % 1000 || 1000);
      tickHandle = setTimeout(tick, wait + 5);
    };
    tick();
    const endHandles = ends.map(end => setTimeout(() => setNow(Date.now()), Math.max(0, end - Date.now()) + 5));
    const wake = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      clearTimeout(tickHandle);
      endHandles.forEach(clearTimeout);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
    };
  }, [runningKey]);

  // Finish the timers that have run out, then alert: outside the state updater,
  // which has to stay free of side effects.
  useEffect(() => {
    const due = timers.filter(tm => tm.running && tm.endsAt <= now);
    if (!due.length) return;
    const ids = new Set(due.map(tm => tm.id));
    setTimers(prev => prev.map(tm => (ids.has(tm.id) && tm.running ? finished(tm) : tm)));
    due.forEach(alertTimerDone);
  }, [timers, now]);

  // Timers restored by a reload have had no click to unlock audio with: use the next one.
  useEffect(() => {
    if (!hasRunning) return undefined;
    window.addEventListener('pointerdown', unlockTimerAudio, true);
    window.addEventListener('keydown', unlockTimerAudio, true);
    return () => {
      window.removeEventListener('pointerdown', unlockTimerAudio, true);
      window.removeEventListener('keydown', unlockTimerAudio, true);
    };
  }, [hasRunning]);

  // A locked phone or tablet suspends the page, which holds the alarm until you
  // come back, so keep the screen on there while a timer runs.
  useWakeLock(hasRunning && coarsePointer);

  const actions = useMemo(
    () => ({ addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer }),
    [addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer]
  );
  const view = useMemo(
    () => timers.map(tm => (tm.running ? { ...tm, remaining: timerRemaining(tm, now) } : tm)),
    [timers, now]
  );
  const value = useMemo(() => ({ timers: view, ...actions }), [view, actions]);
  return (
    <TimerActionsContext.Provider value={actions}>
      <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
    </TimerActionsContext.Provider>
  );
}

export function useTimers() { return React.useContext(TimerContext); }
export function useTimerActions() { return React.useContext(TimerActionsContext); }

export function formatTimer(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

function formatClock(ms, lang) {
  return new Date(ms).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : undefined, { hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════
// RUNNING TIMERS
// ═══════════════════════════════════════════════

function TimerItem({ tmr, lang, floating }) {
  const { removeTimer, pauseTimer, resumeTimer, resetTimer } = useTimerActions();
  const done = tmr.done || (tmr.remaining <= 0 && !tmr.running);
  const pct = tmr.totalSeconds ? ((tmr.totalSeconds - tmr.remaining) / tmr.totalSeconds) * 100 : 0;
  return (
    <div className={done ? 'timer-done' : undefined} role={done ? 'alert' : undefined}
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
        {done ? (
          <span className="flex-1 mono tabular" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {tmr.finishedAt ? `${t('timerFinishedAt', lang)} ${formatClock(tmr.finishedAt, lang)}` : ''}
          </span>
        ) : (
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
  const { addTimer } = useTimerActions();
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
