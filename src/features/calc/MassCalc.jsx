import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { massCalc, formatMass } from '../../lib/calculators.js';
import { S_MUTED, S_MUTED_DIM, S_PRIMARY, S_TEXT } from '../../lib/styleConstants.js';

export default function MassCalc() {
  const lang = useLang();
  const [mw, setMw] = useState('');
  const [conc, setConc] = useState('');
  const [vol, setVol] = useState('');
  const [concUnit, setConcUnit] = useState('M');
  const [volUnit, setVolUnit] = useState('mL');

  const mass = massCalc({ mw: +mw, conc: +conc, vol: +vol, concUnit, volUnit });

  const commonMW = [
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 card p-6">
        <h3 className="text-sm font-bold mb-1">{t('massCalcTitle', lang)}</h3>
        <p className="text-xs mb-4 mono" style={S_MUTED}>{t('massFormula', lang)}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('mwLabel', lang)}</label>
            <p className="text-xs mb-1" style={S_MUTED_DIM}>{t('massMwDesc', lang)}</p>
            <input type="number" value={mw} onChange={e => setMw(e.target.value)} placeholder="e.g. 58.44 (NaCl)" step="any" />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('targetConc', lang)} C</label>
            <p className="text-xs mb-1" style={S_MUTED_DIM}>{t('massConcDesc', lang)}</p>
            <div className="flex gap-2 items-center">
              <input type="number" value={conc} onChange={e => setConc(e.target.value)} placeholder="0" step="any" className="flex-1" style={{minWidth:0}} />
              <select value={concUnit} onChange={e => setConcUnit(e.target.value)} style={{width:'4.5rem', flexShrink:0}}>
                <option>M</option><option>mM</option><option>µM</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('targetVol', lang)} V</label>
            <p className="text-xs mb-1" style={S_MUTED_DIM}>{t('massVolDesc', lang)}</p>
            <div className="flex gap-2 items-center">
              <input type="number" value={vol} onChange={e => setVol(e.target.value)} placeholder="0" step="any" className="flex-1" style={{minWidth:0}} />
              <select value={volUnit} onChange={e => setVolUnit(e.target.value)} style={{width:'4.5rem', flexShrink:0}}>
                <option>L</option><option>mL</option><option>µL</option>
              </select>
            </div>
          </div>
        </div>

        {mass !== null && (
          <div className="mt-5 p-4 rounded-lg border-2 border-primary bg-primary-light text-center">
            <p className="text-sm mb-1" style={S_MUTED}>{t('massNeededLabel', lang)}</p>
            <p className="text-2xl font-bold mono" style={S_PRIMARY}>
              {formatMass(mass).val} {formatMass(mass).unit}
            </p>
            <p className="text-xs mt-1 mono" style={S_MUTED}>= {mass.toExponential(4)} g</p>
          </div>
        )}
        {mass !== null && (
          <div className="mt-3 p-3 rounded-lg" style={{background:'var(--accent-light)', border:'1px solid var(--border)'}}>
            <p className="text-xs font-semibold mb-1" style={S_MUTED}>{t('massPrepSummary', lang)}</p>
            <p className="text-sm" style={S_TEXT}>
              {t('massPrepWeigh', lang)} <strong>{formatMass(mass).val} {formatMass(mass).unit}</strong> {t('massPrepDissolve', lang)} <strong>{vol} {volUnit}</strong> {t('massPrepTo', lang)} <strong>{conc} {concUnit}</strong> {t('massPrepSolution', lang)}
            </p>
          </div>
        )}
      </div>

      <div className="card p-5 h-fit">
        <h4 className="text-sm font-bold mb-3">{t('commonMW', lang)}</h4>
        <div className="max-h-[420px] overflow-y-auto space-y-0">
          {commonMW.map(c => (
            <button key={c.name} onClick={() => setMw(c.mw.toString())}
              className="w-full flex items-center justify-between py-1.5 px-2 text-xs rounded hover:bg-primary-light transition-colors">
              <span className="font-medium">{c.name}</span>
              <span className="mono text-gray-500">{c.mw}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
