import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { molarityCalc, formatConcentration } from '../../lib/calculators.js';

// Variable symbol inside a (globally uppercased) field label.
const SYM_STYLE = { textTransform: 'none', letterSpacing: 0, color: 'var(--text)', fontSize: '0.8125rem', marginRight: '0.45rem' };
const SUFFIX_STYLE = { fontSize: '0.75rem', color: 'var(--text-muted)' };

export default function MolarityCalc() {
  const lang = useLang();
  const [mass, setMass] = useState('');
  const [mw, setMw] = useState('');
  const [vol, setVol] = useState('');
  const [massUnit, setMassUnit] = useState('g');
  const [volUnit, setVolUnit] = useState('mL');

  const molarity = molarityCalc({ mass: +mass, mw: +mw, vol: +vol, massUnit, volUnit });
  const fc = molarity !== null ? formatConcentration(molarity) : null;
  const unitWord = lang === 'zh' ? '单位' : 'unit';

  return (
    <section className="panel" aria-labelledby="calc-molarity-title">
      <div className="panel-head">
        <h2 id="calc-molarity-title" className="section-title min-w-0">{t('calcTaskMolarity', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>{t('molarityFormula', lang)}</span>
      </div>
      <div className="panel-body space-y-4 @container">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>{t('molarityCalcDesc', lang)}</p>

        <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @2xl:grid-cols-3 @md:items-end">
          <div className="min-w-0">
            <label htmlFor="mol-mass"><span style={SYM_STYLE}>m</span>{t('measuredMass', lang)}</label>
            <div className="flex gap-2">
              <input id="mol-mass" type="number" value={mass} onChange={e => setMass(e.target.value)} placeholder="0" step="any" className="flex-1 min-w-0" />
              <select value={massUnit} onChange={e => setMassUnit(e.target.value)} aria-label={`m ${unitWord}`} className="shrink-0" style={{ width: '5.5rem' }}>
                <option>g</option><option>mg</option><option>µg</option>
              </select>
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="mol-mw"><span style={SYM_STYLE}>MW</span>{t('molMwDesc', lang)}</label>
            <div className="relative">
              <input id="mol-mw" type="number" value={mw} onChange={e => setMw(e.target.value)} placeholder="e.g. 58.44" step="any"
                className="w-full" aria-describedby="mol-mw-unit" style={{ paddingRight: '3.75rem' }} />
              <span id="mol-mw-unit" className="mono absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={SUFFIX_STYLE}>g/mol</span>
            </div>
          </div>
          <div className="min-w-0 @md:col-span-2 @2xl:col-span-1">
            <label htmlFor="mol-vol"><span style={SYM_STYLE}>V</span>{t('solnVolume', lang)}</label>
            <div className="flex gap-2">
              <input id="mol-vol" type="number" value={vol} onChange={e => setVol(e.target.value)} placeholder="0" step="any" className="flex-1 min-w-0" />
              <select value={volUnit} onChange={e => setVolUnit(e.target.value)} aria-label={`V ${unitWord}`} className="shrink-0" style={{ width: '5.5rem' }}>
                <option>L</option><option>mL</option><option>µL</option>
              </select>
            </div>
          </div>
        </div>

        <div className={fc ? 'readout' : 'readout is-empty'} aria-live="polite" aria-atomic="true">
          <div className="readout-label">{t('molConc', lang)}</div>
          {fc ? (
            <>
              <div className="readout-value">{fc.val}<span className="unit">{fc.unit}</span></div>
              <div className="readout-sub">= {molarity.toExponential(4)} M</div>
            </>
          ) : (
            <div className="readout-value">{lang === 'zh' ? '输入质量、分子量和体积' : 'Enter mass, MW and volume'}</div>
          )}
        </div>
      </div>
    </section>
  );
}
