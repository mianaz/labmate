import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { molarityCalc, formatConcentration } from '../../lib/calculators.js';
import { S_MUTED, S_MUTED_DIM } from '../../lib/styleConstants.js';

export default function MolarityCalc() {
  const lang = useLang();
  const [mass, setMass] = useState('');
  const [mw, setMw] = useState('');
  const [vol, setVol] = useState('');
  const [massUnit, setMassUnit] = useState('g');
  const [volUnit, setVolUnit] = useState('mL');

  const molarity = molarityCalc({ mass: +mass, mw: +mw, vol: +vol, massUnit, volUnit });

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="text-sm font-bold mb-1">{t('molarityCalcTitle', lang)}</h3>
      <p className="text-xs mb-4 mono" style={S_MUTED}>{t('molarityFormula', lang)}</p>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('measuredMass', lang)} m</label>
          <p className="text-xs mb-1" style={S_MUTED_DIM}>{t('molMassDesc', lang)}</p>
          <div className="flex gap-2 items-center">
            <input type="number" value={mass} onChange={e => setMass(e.target.value)} placeholder="0" step="any" className="flex-1" style={{minWidth:0}} />
            <select value={massUnit} onChange={e => setMassUnit(e.target.value)} style={{width:'4.5rem', flexShrink:0}}>
              <option>g</option><option>mg</option><option>µg</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('mwLabel', lang)}</label>
          <p className="text-xs mb-1" style={S_MUTED_DIM}>{t('molMwDesc', lang)}</p>
          <input type="number" value={mw} onChange={e => setMw(e.target.value)} placeholder="e.g. 58.44" step="any" />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('solnVolume', lang)} V</label>
          <p className="text-xs mb-1" style={S_MUTED_DIM}>{t('molVolDesc', lang)}</p>
          <div className="flex gap-2 items-center">
            <input type="number" value={vol} onChange={e => setVol(e.target.value)} placeholder="0" step="any" className="flex-1" style={{minWidth:0}} />
            <select value={volUnit} onChange={e => setVolUnit(e.target.value)} style={{width:'4.5rem', flexShrink:0}}>
              <option>L</option><option>mL</option><option>µL</option>
            </select>
          </div>
        </div>
      </div>
      {molarity !== null && (
        <div className="mt-5 p-4 rounded-lg border-2 border-accent bg-accent-light text-center">
          <p className="text-sm mb-1" style={S_MUTED}>{t('molConc', lang)}</p>
          <p className="text-2xl font-bold mono" style={{color:'var(--accent)'}}>
            {formatConcentration(molarity).val} {formatConcentration(molarity).unit}
          </p>
          <p className="text-xs text-gray-500 mt-1 mono">= {molarity.toExponential(4)} M</p>
        </div>
      )}
    </div>
  );
}
