import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';

// Floating quick calculator — a basic four-function calculator that lives as a
// FAB stacked above the other bottom-right FABs. Restored from the version
// retired in the mobile nav overhaul. Deliberately has NO global keyboard
// listener: a floating widget must not hijack keystrokes while the user types
// elsewhere in the app.
//
// Bottom-right FAB stack (rows are 3.75rem apart = 3rem button + 0.75rem gap):
//   row 0: QuickTimerButton  (var(--fab-b))
//   row 1: AgentLauncher     (+3.75rem, only when agentAvailable)
//   row 2/1: this calculator — takes the first free row above the stack so it
//            never overlaps the timer or the agent launcher.
export default function QuickCalculatorButton({ agentAvailable = false }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [reset, setReset] = useState(false);

  // Trim floating-point noise (0.1 + 0.2 → 0.3, not 0.30000000000000004).
  const fmt = (n) => (Number.isFinite(n) ? String(parseFloat(n.toPrecision(12))) : 'Error');

  function input(d) {
    if (reset) { setDisplay(d); setReset(false); return; }
    setDisplay(display === '0' ? d : display + d);
  }
  function decimal() {
    if (reset) { setDisplay('0.'); setReset(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  }
  function clear() { setDisplay('0'); setPrev(null); setOp(null); setReset(false); }
  function toggleSign() { setDisplay(fmt(-parseFloat(display))); }
  function percent() { setDisplay(fmt(parseFloat(display) / 100)); }
  function calc(a, b, o) {
    if (o === '+') return a + b;
    if (o === '-') return a - b;
    if (o === '*') return a * b;
    if (o === '/') return b !== 0 ? a / b : NaN;
    return b;
  }
  function operate(nextOp) {
    if (prev !== null && op && !reset) {
      const result = calc(prev, parseFloat(display), op);
      setDisplay(fmt(result));
      setPrev(result);
    } else {
      setPrev(parseFloat(display));
    }
    setOp(nextOp);
    setReset(true);
  }
  function equals() {
    if (prev !== null && op) {
      setDisplay(fmt(calc(prev, parseFloat(display), op)));
      setPrev(null);
      setOp(null);
      setReset(true);
    }
  }

  // Take the first free row above the timer (row 0) and the agent launcher
  // (row 1, present only when the agent is available).
  const rightAnchor = 'calc(env(safe-area-inset-right, 0px) + 1rem)';
  const buttonRow = agentAvailable ? 7.5 : 3.75;
  const buttonBottom = `calc(var(--fab-b) + ${buttonRow}rem)`;
  // Popover grows upward from the button's row, clearing the FABs below it.
  const popoverBottom = buttonBottom;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed z-40 w-12 h-12 flex items-center justify-center shadow-lg transition-transform hover:scale-110"
        style={{
          bottom: buttonBottom, right: rightAnchor,
          background: 'var(--card)', color: 'var(--accent)', border: '2px solid var(--border-strong)',
        }} title={t('quickCalc', lang)} aria-label={t('quickCalc', lang)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" />
          <line x1="8" y1="18" x2="16" y2="18" />
        </svg>
      </button>
    );
  }

  const btnStyle = (bg, col) => ({
    background: bg, color: col, border: '1px solid var(--border)', cursor: 'pointer',
    borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600,
    minHeight: '2.4rem',
  });

  return (
    <div className="fixed z-40 shadow-lg" style={{
      bottom: popoverBottom, right: rightAnchor,
      background: 'var(--card)', border: '2px solid var(--border-strong)', width: '240px', overflow: 'hidden',
    }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{t('quickCalc', lang)}</span>
        <button onClick={() => setOpen(false)} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)' }} aria-label="close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <div className="px-3 py-2 text-right" aria-live="polite" aria-atomic="true"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', minHeight: '2.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {display}
      </div>
      <div className="grid grid-cols-4 gap-1 p-2" style={{ gridAutoRows: '2.4rem' }}>
        <button onClick={clear} style={btnStyle('var(--bg-2)', 'var(--text-muted)')} aria-label="clear">C</button>
        <button onClick={toggleSign} style={btnStyle('var(--bg-2)', 'var(--text-muted)')} aria-label="toggle sign">+/−</button>
        <button onClick={percent} style={btnStyle('var(--bg-2)', 'var(--text-muted)')}>%</button>
        <button onClick={() => operate('/')} style={btnStyle('var(--primary-light)', 'var(--accent)')} aria-label="divide">÷</button>
        {['7', '8', '9'].map(d => <button key={d} onClick={() => input(d)} style={btnStyle('var(--bg)', 'var(--text)')}>{d}</button>)}
        <button onClick={() => operate('*')} style={btnStyle('var(--primary-light)', 'var(--accent)')} aria-label="multiply">×</button>
        {['4', '5', '6'].map(d => <button key={d} onClick={() => input(d)} style={btnStyle('var(--bg)', 'var(--text)')}>{d}</button>)}
        <button onClick={() => operate('-')} style={btnStyle('var(--primary-light)', 'var(--accent)')} aria-label="subtract">−</button>
        {['1', '2', '3'].map(d => <button key={d} onClick={() => input(d)} style={btnStyle('var(--bg)', 'var(--text)')}>{d}</button>)}
        <button onClick={() => operate('+')} style={btnStyle('var(--primary-light)', 'var(--accent)')} aria-label="add">+</button>
        <button onClick={() => input('0')} style={{ ...btnStyle('var(--bg)', 'var(--text)'), gridColumn: 'span 2' }}>0</button>
        <button onClick={decimal} style={btnStyle('var(--bg)', 'var(--text)')} aria-label="decimal point">.</button>
        <button onClick={equals} style={btnStyle('var(--primary)', 'var(--on-primary)')} aria-label="equals">=</button>
      </div>
    </div>
  );
}
