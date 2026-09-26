import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import UtilityPanel from '../../components/UtilityPanel.jsx';
import { IconCalculator } from '../../components/icons.jsx';

// Quick calculator — a basic four-function calculator that is always one click
// away (sidebar on desktop, top bar on phones). Deliberately has NO global
// keyboard listener: a floating widget must not hijack keystrokes while the
// user types elsewhere in the app.

// Trim floating-point noise (0.1 + 0.2 → 0.3, not 0.30000000000000004).
const fmt = (n) => (Number.isFinite(n) ? String(parseFloat(n.toPrecision(12))) : 'Error');

function calc(a, b, o) {
  if (o === '+') return a + b;
  if (o === '-') return a - b;
  if (o === '*') return a * b;
  if (o === '/') return b !== 0 ? a / b : NaN;
  return b;
}

const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function Key({ label, onClick, variant = 'num', span = 1, ariaLabel }) {
  const styles = {
    num: { background: 'var(--card)', color: 'var(--text)' },
    fn: { background: 'var(--bg-2)', color: 'var(--text-muted)' },
    op: { background: 'var(--bg-2)', color: 'var(--accent)' },
    eq: { background: 'var(--primary)', color: 'var(--on-primary)' },
  }[variant];
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel}
      className="flex items-center justify-center transition-colors hover:brightness-95 active:brightness-90"
      style={{
        ...styles, border: 0, fontFamily: 'var(--font-mono)', fontSize: '1.0625rem', fontWeight: 600,
        gridColumn: span > 1 ? `span ${span}` : undefined, minHeight: '2.75rem',
      }}>
      {label}
    </button>
  );
}

function QuickCalcPad() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [reset, setReset] = useState(false);

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

  return (
    <div>
      <div className="px-3.5 pt-2 pb-3" style={{ borderBottom: '1px solid var(--rule)' }}>
        <p className="mono text-right" aria-hidden="true" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minHeight: '1.1rem' }}>
          {prev !== null && op ? `${fmt(prev)} ${OP_SYMBOL[op]}` : ''}
        </p>
        <div className="text-right tabular" aria-live="polite" aria-atomic="true"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display}
        </div>
      </div>
      <div className="grid grid-cols-4" style={{ gap: 1, background: 'var(--rule)' }}>
        <Key label="C" onClick={clear} variant="fn" ariaLabel="clear" />
        <Key label="+/−" onClick={toggleSign} variant="fn" ariaLabel="toggle sign" />
        <Key label="%" onClick={percent} variant="fn" />
        <Key label="÷" onClick={() => operate('/')} variant="op" ariaLabel="divide" />
        {['7', '8', '9'].map(d => <Key key={d} label={d} onClick={() => input(d)} />)}
        <Key label="×" onClick={() => operate('*')} variant="op" ariaLabel="multiply" />
        {['4', '5', '6'].map(d => <Key key={d} label={d} onClick={() => input(d)} />)}
        <Key label="−" onClick={() => operate('-')} variant="op" ariaLabel="subtract" />
        {['1', '2', '3'].map(d => <Key key={d} label={d} onClick={() => input(d)} />)}
        <Key label="+" onClick={() => operate('+')} variant="op" ariaLabel="add" />
        <Key label="0" onClick={() => input('0')} span={2} />
        <Key label="." onClick={decimal} ariaLabel="decimal point" />
        <Key label="=" onClick={equals} variant="eq" ariaLabel="equals" />
      </div>
    </div>
  );
}

export function QuickCalcPanel({ open, onClose }) {
  const lang = useLang();
  return (
    <UtilityPanel open={open} onClose={onClose} title={t('quickCalc', lang)} icon={<IconCalculator size={15} />} width={264}>
      <QuickCalcPad />
    </UtilityPanel>
  );
}

// Trigger. variant 'sidebar' → labelled tool tile; 'topbar' → icon button.
export default function QuickCalculatorButton({ open = false, onToggle, variant = 'topbar' }) {
  const lang = useLang();
  const label = t('quickCalc', lang);
  if (variant === 'sidebar') {
    return (
      <button type="button" className="sidebar-tool" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog" aria-label={label} title={label}>
        <IconCalculator size={15} />
        <span>{t('toolCalc', lang)}</span>
      </button>
    );
  }
  return (
    <button type="button" className="topbar-btn" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog" aria-label={label} title={label}>
      <IconCalculator size={20} />
    </button>
  );
}
