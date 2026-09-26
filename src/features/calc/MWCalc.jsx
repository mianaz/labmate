import { useState, useMemo } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { calcMW, COMMON_MOLECULES } from '../../data/periodicTable.js';
import { IconAlert } from '../../components/icons.jsx';

// Tighter cells than the global table default so the 4 columns fit a phone.
const CELL = { paddingLeft: '0.5rem', paddingRight: '0.5rem' };
const NUM = { ...CELL, textAlign: 'right' };

export default function MWCalc() {
  const lang = useLang();
  const [formula, setFormula] = useState('');
  const result = useMemo(() => (formula.trim() ? calcMW(formula.trim()) : null), [formula]);

  const ok = result && !result.error && result.breakdown.length > 0;

  return (
    <section className="panel" aria-labelledby="calc-mw-title">
      <div className="panel-head">
        <h2 id="calc-mw-title" className="section-title min-w-0">{t('calcTaskMW', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>MW = Σ(n × Aᵣ)</span>
      </div>
      <div className="panel-body space-y-4 @container">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>{t('mwCalcSubtitle', lang)}</p>

        <div>
          <label htmlFor="mw-formula">{t('mwFormula', lang)}</label>
          <input id="mw-formula" type="text" value={formula} onChange={e => setFormula(e.target.value)}
            placeholder={t('mwFormulaPlaceholder', lang)} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            className="w-full" style={{ fontSize: '1rem' }} />
        </div>

        <div role="group" aria-labelledby="mw-common-label">
          <div className="eyebrow mb-1.5" id="mw-common-label">{t('mwCommon', lang)}</div>
          <div className="chip-row">
            {COMMON_MOLECULES.map(m => (
              <button key={m.name} type="button" className="chip" aria-pressed={formula === m.formula} onClick={() => setFormula(m.formula)}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div aria-live="polite" aria-atomic="true">
          {result && result.error ? (
            <div className="notice notice-danger">
              <IconAlert size={15} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 2 }} />
              <p><span className="notice-title">{t('mwParseError', lang)}</span>{lang === 'zh' ? '：' : ': '}{lang === 'en' ? 'Unknown element' : '未知元素'} <span className="mono">"{result.sym}"</span></p>
            </div>
          ) : (
            <div className={ok ? 'readout' : 'readout is-empty'}>
              <div className="readout-label">{t('mwResult', lang)}</div>
              <div className="readout-value">
                {ok ? <>{result.total.toFixed(3)}<span className="unit">g/mol</span></> : (lang === 'zh' ? '输入化学式' : 'Enter a chemical formula')}
              </div>
            </div>
          )}
        </div>

        {ok && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={CELL}>{t('mwElement', lang)}</th>
                  <th style={NUM}>{t('mwCount', lang)}</th>
                  <th style={NUM}>{t('mwAtomicMass', lang)}</th>
                  <th style={NUM}>{t('mwSubtotal', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {result.breakdown.map((b, i) => (
                  <tr key={i}>
                    <td style={CELL}>
                      <span className="mono" style={{ fontWeight: 700 }}>{b.sym}</span>
                      <span className="ml-2 hidden @sm:inline" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.name}</span>
                    </td>
                    <td className="tabular" style={NUM}>{b.count}</td>
                    <td className="tabular" style={NUM}>{b.mass.toFixed(3)}</td>
                    <td className="tabular" style={{ ...NUM, fontWeight: 700 }}>{b.subtotal.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ ...CELL, fontWeight: 700, borderBottom: 0 }}>{t('mwResult', lang)}</td>
                  <td className="tabular" style={{ ...NUM, fontWeight: 700, borderBottom: 0 }}>{result.total.toFixed(3)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
