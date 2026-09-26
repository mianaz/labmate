import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { evalExpression } from '../../lib/calculators.js';

// Key faces — same vocabulary as the quick calculator (QuickCalculatorButton):
// hairline-separated grid, digits on card, functions/operators on paper, one
// green equals key.
const KEY_STYLES = {
  num: { background: 'var(--card)', color: 'var(--text)', fontSize: '1.0625rem' },
  fn: { background: 'var(--bg-2)', color: 'var(--text-muted)', fontSize: '0.875rem' },
  op: { background: 'var(--bg-2)', color: 'var(--accent)', fontSize: '1.125rem' },
  eq: { background: 'var(--primary)', color: 'var(--on-primary)', fontSize: '1.125rem', outlineColor: 'var(--on-primary)' },
  ctl: { background: 'var(--bg-3)', color: 'var(--text)', fontSize: '0.8125rem' },
};

// Defined at module scope: an inline component definition gets a new identity
// every render, which makes React unmount and remount all 34 buttons per keystroke.
function Btn({ label, onClick, variant = 'num', span = 1, ariaLabel, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      title={title}
      className="flex items-center justify-center transition-[filter] hover:brightness-95 active:brightness-90"
      style={{
        ...KEY_STYLES[variant],
        border: 0, fontFamily: 'var(--font-mono)', fontWeight: 600, minHeight: '3rem',
        gridColumn: span > 1 ? `span ${span}` : undefined,
        outlineOffset: '-3px', // keep the focus ring inside the key (1px gaps)
      }}
    >
      {label}
    </button>
  );
}

// Trim floating-point noise; fall back to exponential for very large/small values.
function fmtNum(n) {
  if (!Number.isFinite(n)) return 'Error';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
    return parseFloat(n.toExponential(9)).toExponential();
  }
  return String(parseFloat(n.toPrecision(12)));
}

const SHORTCUTS = [
  { keys: ['0–9', '.'], en: 'Digits', zh: '数字' },
  { keys: ['+', '-', '*', '/', '^'], en: 'Operators', zh: '运算符' },
  { keys: ['(', ')'], en: 'Parentheses', zh: '括号' },
  { keys: ['Enter', '='], en: 'Equals', zh: '等于' },
  { keys: ['Backspace'], en: 'Delete last', zh: '删除末位' },
  { keys: ['Esc'], en: 'Clear all', zh: '全部清除' },
];

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

  // Keyboard support — ignored while the user is typing in another field. The
  // actions are read through a ref so the listener is registered once instead
  // of being torn down and re-added on every keystroke.
  const actionsRef = useRef(null);
  actionsRef.current = { insert, equals, backspace, clearAll };
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const { insert, equals, backspace, clearAll } = actionsRef.current;
      const k = e.key;
      // Enter on a control elsewhere on the page (calculator list, sidebar links)
      // keeps its native action instead of being swallowed as "=".
      if (k === 'Enter' && el && el.closest && !el.closest('[data-sci-calc]')
        && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SELECT' || el.getAttribute('role') === 'button')) return;
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
  }, []);

  return (
    <section className="panel" aria-labelledby="calc-sci-title" data-sci-calc="">
      <div className="panel-head">
        <h2 id="calc-sci-title" className="section-title min-w-0">{t('calcTaskScientific', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>sin · log · xʸ</span>
      </div>
      <div className="panel-body space-y-4 @container">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>{t('scientificCalcDesc', lang)}</p>

        <div className="grid gap-6 @2xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] @2xl:items-start">
          {/* Instrument: display + keypad */}
          <div className="w-full max-w-md" style={{ border: '1px solid var(--border-strong)' }}>
            {/* Display: expression on top, live/last result below */}
            <div
              className="px-4 pt-2 pb-2.5"
              aria-live="polite" aria-atomic="true"
              style={{
                background: error ? 'var(--danger-bg)' : 'var(--primary-light)',
                borderBottom: '1px solid var(--border-strong)',
                boxShadow: `inset 4px 0 0 ${error ? 'var(--danger-border)' : 'var(--primary)'}`,
              }}
            >
              <div className="flex items-center justify-between gap-2 mono" aria-hidden="true"
                style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', minHeight: '1rem' }}>
                <span>{deg ? 'DEG' : 'RAD'}</span>
                {lastAns !== null && <span>ANS</span>}
              </div>
              <div
                className="text-right tabular"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: '2.1rem',
                }}
              >
                {expr || '0'}
              </div>
              <div
                className="text-right tabular"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', lineHeight: 1.4, color: error ? 'var(--danger-text)' : 'var(--text-muted)', minHeight: '1.3rem' }}
              >
                {error ? t('calcError', lang) : preview !== null && !justEvaluated ? '= ' + preview : ''}
              </div>
            </div>

            <div className="grid grid-cols-5" style={{ gap: 1, background: 'var(--rule)' }}>
              {/* Row 1: mode + controls */}
              <Btn label={deg ? 'DEG' : 'RAD'} onClick={() => setDeg((d) => !d)} variant="ctl" ariaLabel="toggle degrees or radians" title="Angle mode" />
              <Btn label="AC" onClick={clearAll} variant="ctl" ariaLabel="clear all" />
              <Btn label={<span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⌫</span>} onClick={backspace} variant="ctl" ariaLabel="backspace" />
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
          </div>

          {/* Keyboard reference (hidden on phones — no hardware keyboard) */}
          <div className="hidden @2xl:block min-w-0 max-w-xs">
            <div className="eyebrow mb-1">{lang === 'zh' ? '键盘快捷键' : 'Keyboard'}</div>
            <dl>
              {SHORTCUTS.map(s => (
                <div key={s.en} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: '1px solid var(--rule)' }}>
                  <dt className="flex flex-wrap gap-1">{s.keys.map(k => <kbd key={k}>{k}</kbd>)}</dt>
                  <dd style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{lang === 'zh' ? s.zh : s.en}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
