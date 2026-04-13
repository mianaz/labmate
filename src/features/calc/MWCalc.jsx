import React, { useState, useEffect } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { calcMW, COMMON_MOLECULES } from '../../data/periodicTable.js';

export default function MWCalc() {
  const lang = useLang();
  const [formula, setFormula] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!formula.trim()) { setResult(null); return; }
    const r = calcMW(formula.trim());
    setResult(r);
  }, [formula]);

  return (
    <div className="card p-5 fade-in">
      <h2 className="text-xl font-bold mb-1">{t('mwCalcTitle', lang)}</h2>
      <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>{t('mwCalcSubtitle', lang)}</p>

      <div className="mb-4">
        <label className="text-xs font-semibold block mb-1" style={{color:'var(--text-muted)'}}>{t('mwFormula', lang)}</label>
        <input type="text" value={formula} onChange={e => setFormula(e.target.value)}
          placeholder={t('mwFormulaPlaceholder', lang)}
          className="w-full text-lg mono" style={{fontFamily:'var(--font-mono)'}} />
      </div>

      {/* Common molecules */}
      <div className="mb-4">
        <label className="text-xs font-semibold block mb-1.5" style={{color:'var(--text-muted)'}}>{t('mwCommon', lang)}</label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_MOLECULES.map(m => (
            <button key={m.name} onClick={() => setFormula(m.formula)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
              style={{
                background: formula === m.formula ? 'var(--primary)' : 'var(--bg-2)',
                color: formula === m.formula ? 'white' : 'var(--text-muted)',
                border: '1px solid ' + (formula === m.formula ? 'var(--primary)' : 'var(--border)'),
              }}>
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && !result.error && (
        <div className="fade-in">
          <div className="p-4 rounded-xl mb-4" style={{background:'var(--primary-light)', border:'1px solid var(--primary)'}} aria-live="polite" aria-atomic="true">
            <div className="text-xs font-semibold mb-1" style={{color:'var(--text-muted)'}}>{t('mwResult', lang)}</div>
            <div className="text-2xl font-bold mono" style={{color:'var(--primary)'}}>{result.total.toFixed(3)} g/mol</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th className="text-left py-2 px-2 font-semibold" style={{color:'var(--text-muted)'}}>{t('mwElement', lang)}</th>
                  <th className="text-right py-2 px-2 font-semibold" style={{color:'var(--text-muted)'}}>{t('mwCount', lang)}</th>
                  <th className="text-right py-2 px-2 font-semibold" style={{color:'var(--text-muted)'}}>{t('mwAtomicMass', lang)}</th>
                  <th className="text-right py-2 px-2 font-semibold" style={{color:'var(--text-muted)'}}>{t('mwSubtotal', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {result.breakdown.map((b, i) => (
                  <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                    <td className="py-1.5 px-2 font-semibold">{b.sym} <span className="text-xs" style={{color:'var(--text-muted)'}}>({b.name})</span></td>
                    <td className="py-1.5 px-2 text-right mono">{b.count}</td>
                    <td className="py-1.5 px-2 text-right mono">{b.mass.toFixed(3)}</td>
                    <td className="py-1.5 px-2 text-right mono font-semibold">{b.subtotal.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:'2px solid var(--primary)'}}>
                  <td colSpan={3} className="py-2 px-2 font-bold">{t('mwResult', lang)}</td>
                  <td className="py-2 px-2 text-right mono font-bold" style={{color:'var(--primary)'}}>{result.total.toFixed(3)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {result && result.error && (
        <div className="p-3 rounded-lg text-sm" style={{background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5'}}>
          {t('mwParseError', lang)}: {lang === 'en' ? 'Unknown element' : '未知元素'} "{result.sym}"
        </div>
      )}
    </div>
  );
}
