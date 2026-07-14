import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED } from '../../lib/styleConstants.js';
import { evalExpression } from '../../lib/calculators.js';

// Trim floating-point noise; fall back to exponential for very large/small values.
function fmtNum(n) {
  if (!Number.isFinite(n)) return 'Error';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
    return parseFloat(n.toExponential(9)).toExponential();
  }
  return String(parseFloat(n.toPrecision(12)));
}

// Full scientific calculator. Builds an expression string and evaluates it with
// the shared, unit-tested evalExpression parser (no eval/Function).
export default function ScientificCalc() {
  const lang = useLang();
  const [expr, setExpr] = useState('');
  const [deg, setDeg] = useState(true);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [lastAns, setLastAns] = useState(null);
  const [error, setError] = useState(false);

  const preview = useMemo(() => {
    if (!expr.trim()) return null;
    try { return fmtNum(evalExpression(expr, { deg })); }
    catch { return null; }
  }, [expr, deg]);

  const insert = useCallback((tok, isOperator = false) => {
    setError(false);
    setExpr((cur) => {
      if (justEvaluated) {
        setJustEvaluated(false);
        return isOperator ? (lastAns !== null ? fmtNum(lastAns) : '') + tok : tok;
      }
      return cur + tok;
    });
  }, [justEvaluated, lastAns]);

  const clearAll = useCallback(() => { setExpr(''); setError(false); setJustEvaluated(false); }, []);
  const backspace = useCallback(() => {
    setError(false);
    setJustEvaluated(false);
    setExpr((cur) => cur.slice(0, -1));
  }, []);

  const equals = useCallback(() => {
    if (!expr.trim()) return;
    try {
      const val = evalExpression(expr, { deg });
      setLastAns(val);
      setExpr(fmtNum(val));
      setJustEvaluated(true);
      setError(false);
    } catch {
      setError(true);
    }
  }, [expr, deg]);

  // Keyboard support — ignored while the user is typing in another field.
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const k = e.key;
      if (/^[0-9]$/.test(k)) insert(k);
      else if (k === '.') insert('.');
      else if (k === '+') insert('+', true);
      else if (k === '-') insert('−', true);
      else if (k === '*') insert('×', true);
      else if (k === '/') { e.preventDefault(); insert('÷', true); }
      else if (k === '^') insert('^', true);
      else if (k === '(' || k === ')') insert(k);
      else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); }
      else if (k === 'Backspace') backspace();
      else if (k === 'Escape') clearAll();
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [insert, equals, backspace, clearAll]);

  const Btn = ({ label, onClick, variant = 'num', span = 1, ariaLabel, title }) => {
    const styles = {
      num: { background: 'var(--bg)', color: 'var(--text)' },
      fn: { background: 'var(--bg-2)', color: 'var(--text-muted)', fontSize: '0.9rem' },
      op: { background: 'var(--primary-light)', color: 'var(--accent)' },
      eq: { background: 'var(--primary)', color: 'var(--on-primary)' },
      ctl: { background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '0.9rem' },
    }[variant];
    return (
      <button
        onClick={onClick}
        aria-label={ariaLabel || label}
        title={title}
        className="flex items-center justify-center font-semibold transition-all hover:opacity-80 active:scale-95"
        style={{
          ...styles,
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-mono)', fontSize: styles.fontSize || '1rem', minHeight: '2.85rem',
          gridColumn: span > 1 ? `span ${span}` : undefined, cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="card p-5 fade-in">
      <h2 className="text-xl font-bold mb-1">{t('calcTaskScientific', lang)}</h2>
      <p className="text-sm mb-4" style={S_MUTED}>{t('scientificCalcDesc', lang)}</p>

      <div className="max-w-md">
        {/* Display: expression on top, live/last result below */}
        <div
          className="px-4 py-3 mb-3"
          aria-live="polite" aria-atomic="true"
          style={{
            background: 'var(--bg-2)', border: `1px solid ${error ? 'var(--danger-border)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', minHeight: '4.25rem',
          }}
        >
          <div
            className="text-right"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: '2rem',
            }}
          >
            {expr || '0'}
          </div>
          <div
            className="text-right mt-1"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: error ? 'var(--danger-text)' : 'var(--text-muted)', minHeight: '1.2rem' }}
          >
            {error ? t('calcError', lang) : preview !== null && !justEvaluated ? '= ' + preview : ''}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {/* Row 1: mode + controls */}
          <Btn label={deg ? 'DEG' : 'RAD'} onClick={() => setDeg((d) => !d)} variant="ctl" ariaLabel="toggle degrees or radians" title="Angle mode" />
          <Btn label="AC" onClick={clearAll} variant="ctl" ariaLabel="clear all" />
          <Btn label="⌫" onClick={backspace} variant="ctl" ariaLabel="backspace" />
          <Btn label="(" onClick={() => insert('(')} variant="fn" />
          <Btn label=")" onClick={() => insert(')')} variant="fn" />

          {/* Row 2: primary functions */}
          <Btn label="sin" onClick={() => insert('sin(')} variant="fn" />
          <Btn label="cos" onClick={() => insert('cos(')} variant="fn" />
          <Btn label="tan" onClick={() => insert('tan(')} variant="fn" />
          <Btn label="ln" onClick={() => insert('ln(')} variant="fn" />
          <Btn label="log" onClick={() => insert('log(')} variant="fn" />

          {/* Row 3: constants + powers */}
          <Btn label="π" onClick={() => insert('π')} variant="fn" />
          <Btn label="e" onClick={() => insert('e')} variant="fn" />
          <Btn label="√" onClick={() => insert('√(')} variant="fn" ariaLabel="square root" />
          <Btn label="x²" onClick={() => insert('^2', true)} variant="fn" ariaLabel="square" />
          <Btn label="xʸ" onClick={() => insert('^', true)} variant="fn" ariaLabel="power" />

          {/* Row 4 */}
          <Btn label="7" onClick={() => insert('7')} />
          <Btn label="8" onClick={() => insert('8')} />
          <Btn label="9" onClick={() => insert('9')} />
          <Btn label="÷" onClick={() => insert('÷', true)} variant="op" ariaLabel="divide" />
          <Btn label="x!" onClick={() => insert('!', true)} variant="fn" ariaLabel="factorial" />

          {/* Row 5 */}
          <Btn label="4" onClick={() => insert('4')} />
          <Btn label="5" onClick={() => insert('5')} />
          <Btn label="6" onClick={() => insert('6')} />
          <Btn label="×" onClick={() => insert('×', true)} variant="op" ariaLabel="multiply" />
          <Btn label="×10ⁿ" onClick={() => insert('×10^', true)} variant="fn" ariaLabel="times ten to the power" title="Scientific notation" />

          {/* Row 6 */}
          <Btn label="1" onClick={() => insert('1')} />
          <Btn label="2" onClick={() => insert('2')} />
          <Btn label="3" onClick={() => insert('3')} />
          <Btn label="−" onClick={() => insert('−', true)} variant="op" ariaLabel="subtract" />
          <Btn label="Ans" onClick={() => insert(lastAns !== null ? fmtNum(lastAns) : '')} variant="fn" ariaLabel="last answer" />

          {/* Row 7 */}
          <Btn label="0" onClick={() => insert('0')} span={2} />
          <Btn label="." onClick={() => insert('.')} ariaLabel="decimal point" />
          <Btn label="+" onClick={() => insert('+', true)} variant="op" ariaLabel="add" />
          <Btn label="=" onClick={equals} variant="eq" ariaLabel="equals" />
        </div>
        <p className="text-[11px] mt-3" style={S_MUTED}>{t('calcKeyboardHint', lang)}</p>
      </div>
    </div>
  );
}
