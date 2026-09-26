import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { massCalc, formatMass } from '../../lib/calculators.js';

const COMMON_MW = [
  { name: 'NaCl', mw: 58.44 },
  { name: 'KCl', mw: 74.55 },
  { name: 'Tris', mw: 121.14 },
  { name: 'EDTA', mw: 292.24 },
  { name: 'HEPES', mw: 238.30 },
  { name: 'SDS', mw: 288.38 },
  { name: 'DTT', mw: 154.25 },
  { name: 'PMSF', mw: 174.19 },
  { name: 'Glycine', mw: 75.03 },
  { name: 'Sucrose', mw: 342.30 },
  { name: 'Glucose', mw: 180.16 },
  { name: 'CaCl₂', mw: 110.98 },
  { name: 'MgCl₂', mw: 95.21 },
  { name: 'Na₂HPO₄', mw: 141.96 },
  { name: 'KH₂PO₄', mw: 136.09 },
  { name: 'NaOH', mw: 40.00 },
  { name: 'HCl', mw: 36.46 },
  { name: 'IPTG', mw: 238.31 },
  { name: 'Ampicillin', mw: 349.41 },
  { name: 'Kanamycin', mw: 484.50 },
];

// Variable symbol inside a (globally uppercased) field label.
const SYM_STYLE = { textTransform: 'none', letterSpacing: 0, color: 'var(--text)', fontSize: '0.8125rem', marginRight: '0.45rem' };
const SUFFIX_STYLE = { fontSize: '0.75rem', color: 'var(--text-muted)' };

export default function MassCalc() {
  const lang = useLang();
  const [mw, setMw] = useState('');
  const [conc, setConc] = useState('');
  const [vol, setVol] = useState('');
  const [concUnit, setConcUnit] = useState('M');
  const [volUnit, setVolUnit] = useState('mL');

  const mass = massCalc({ mw: +mw, conc: +conc, vol: +vol, concUnit, volUnit });
  const fm = mass !== null ? formatMass(mass) : null;
  const unitWord = lang === 'zh' ? '单位' : 'unit';

  return (
    <section className="panel" aria-labelledby="calc-mass-title">
      <div className="panel-head">
        <h2 id="calc-mass-title" className="section-title min-w-0">{t('calcTaskMass', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>{t('massFormula', lang)}</span>
      </div>
      <div className="panel-body space-y-4 @container">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>{t('massCalcDesc', lang)}</p>

        {/* Quick fill: common reagents → MW */}
        <div role="group" aria-labelledby="mass-common-label">
          <div className="eyebrow mb-1.5" id="mass-common-label">{t('commonMW', lang)}</div>
          <div className="chip-row is-scroll @md:flex-wrap">
            {COMMON_MW.map(c => (
              <button key={c.name} type="button" className="chip" aria-pressed={+mw === c.mw}
                onClick={() => setMw(c.mw.toString())}>
                {c.name}<span className="chip-count">{c.mw}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @2xl:grid-cols-3 @md:items-end">
          <div className="min-w-0 @md:col-span-2 @2xl:col-span-1">
            <label htmlFor="mass-mw"><span style={SYM_STYLE}>MW</span>{t('massMwDesc', lang)}</label>
            <div className="relative">
              <input id="mass-mw" type="number" value={mw} onChange={e => setMw(e.target.value)} placeholder="e.g. 58.44 (NaCl)" step="any"
                className="w-full" aria-describedby="mass-mw-unit" style={{ paddingRight: '3.75rem' }} />
              <span id="mass-mw-unit" className="mono absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={SUFFIX_STYLE}>g/mol</span>
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="mass-conc"><span style={SYM_STYLE}>C</span>{t('targetConc', lang)}</label>
            <div className="flex gap-2">
              <input id="mass-conc" type="number" value={conc} onChange={e => setConc(e.target.value)} placeholder="0" step="any" className="flex-1 min-w-0" />
              <select value={concUnit} onChange={e => setConcUnit(e.target.value)} aria-label={`C ${unitWord}`} className="shrink-0" style={{ width: '5.5rem' }}>
                <option>M</option><option>mM</option><option>µM</option>
              </select>
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="mass-vol"><span style={SYM_STYLE}>V</span>{t('targetVol', lang)}</label>
            <div className="flex gap-2">
              <input id="mass-vol" type="number" value={vol} onChange={e => setVol(e.target.value)} placeholder="0" step="any" className="flex-1 min-w-0" />
              <select value={volUnit} onChange={e => setVolUnit(e.target.value)} aria-label={`V ${unitWord}`} className="shrink-0" style={{ width: '5.5rem' }}>
                <option>L</option><option>mL</option><option>µL</option>
              </select>
            </div>
          </div>
        </div>

        <div className={fm ? 'readout' : 'readout is-empty'} aria-live="polite" aria-atomic="true">
          <div className="readout-label">{t('massNeededLabel', lang)}</div>
          {fm ? (
            <>
              <div className="readout-value">{fm.val}<span className="unit">{fm.unit}</span></div>
              <div className="readout-sub">= {mass.toExponential(4)} g</div>
            </>
          ) : (
            <div className="readout-value">{lang === 'zh' ? '输入分子量、浓度和体积' : 'Enter MW, concentration and volume'}</div>
          )}
        </div>

        {fm && (
          <div className="notice notice-info">
            <p>
              <span className="notice-title">{t('massPrepSummary', lang)}</span>{lang === 'zh' ? '：' : ': '}
              {t('massPrepWeigh', lang)} <strong>{fm.val} {fm.unit}</strong> {t('massPrepDissolve', lang)} <strong>{vol} {volUnit}</strong> {t('massPrepTo', lang)} <strong>{conc} {concUnit}</strong> {t('massPrepSolution', lang)}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
