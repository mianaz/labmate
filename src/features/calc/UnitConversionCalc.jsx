import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED, S_PRIMARY } from '../../lib/styleConstants.js';

export default function UnitConversionCalc() {
  const lang = useLang();
  const categories = {
    volume: {
      label: () => t('convertCatVolume', lang),
      units: ['L', 'mL', 'µL', 'nL', 'fl oz', 'cup', 'pt', 'qt', 'gal'],
      toBase: { L: 1, mL: 1e-3, 'µL': 1e-6, nL: 1e-9, 'fl oz': 0.0295735, cup: 0.236588, pt: 0.473176, qt: 0.946353, gal: 3.78541 },
    },
    mass: {
      label: () => t('convertCatMass', lang),
      units: ['kg', 'g', 'mg', 'µg', 'ng', 'lb', 'oz'],
      toBase: { kg: 1000, g: 1, mg: 1e-3, 'µg': 1e-6, ng: 1e-9, lb: 453.592, oz: 28.3495 },
    },
    length: {
      label: () => t('convertCatLength', lang),
      units: ['m', 'cm', 'mm', 'µm', 'nm', 'in', 'ft', 'yd'],
      toBase: { m: 1, cm: 0.01, mm: 0.001, 'µm': 1e-6, nm: 1e-9, 'in': 0.0254, ft: 0.3048, yd: 0.9144 },
    },
    temperature: {
      label: () => t('convertCatTemp', lang),
      units: ['°C', '°F', 'K'],
      convert: (val, from, to) => {
        let c;
        if (from === '°C') c = val;
        else if (from === '°F') c = (val - 32) * 5/9;
        else c = val - 273.15;
        if (to === '°C') return c;
        if (to === '°F') return c * 9/5 + 32;
        return c + 273.15;
      }
    },
    pressure: {
      label: () => t('convertCatPressure', lang),
      units: ['atm', 'Pa', 'kPa', 'bar', 'psi', 'mmHg', 'Torr'],
      toBase: { atm: 1, Pa: 9.8692e-6, kPa: 0.00986923, bar: 0.986923, psi: 0.068046, mmHg: 0.00131579, Torr: 0.00131579 },
    },
  };

  const [cat, setCat] = useState('volume');
  const [fromUnit, setFromUnit] = useState('mL');
  const [toUnit, setToUnit] = useState('µL');
  const [value, setValue] = useState('');

  const catData = categories[cat];
  const numVal = parseFloat(value);
  let result = null;
  if (!isNaN(numVal) && value !== '') {
    if (catData.convert) {
      result = catData.convert(numVal, fromUnit, toUnit);
    } else {
      result = numVal * catData.toBase[fromUnit] / catData.toBase[toUnit];
    }
  }

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    if (Math.abs(n) < 0.0001 && n !== 0) return n.toExponential(4);
    if (Math.abs(n) >= 1e7) return n.toExponential(4);
    return parseFloat(n.toPrecision(8)).toString();
  }

  return (
    <div className="fade-in">
      <div className="card p-5">
        <h3 className="text-sm font-bold mb-1">{t('calcTaskConvert', lang)}</h3>
        <p className="text-xs mb-4" style={S_MUTED}>
          {lang === 'en' ? 'Convert between metric, imperial, and lab units' : '公制、英制和实验室单位互转'}
        </p>
        <div className="mb-4">
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('convertCategory', lang)}</label>
          <div className="flex gap-1.5 flex-wrap">
            {Object.keys(categories).map(k => (
              <button key={k} onClick={() => { setCat(k); setFromUnit(categories[k].units[0]); setToUnit(categories[k].units[1]); setValue(''); }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: cat === k ? 'var(--primary)' : 'var(--card)',
                  color: cat === k ? 'white' : 'var(--text-muted)',
                  border: `1px solid ${cat === k ? 'var(--primary)' : 'var(--border)'}`,
                }}>
                {categories[k].label()}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('convertFrom', lang)}</label>
            <div className="flex gap-2">
              <input type="number" value={value} onChange={e => setValue(e.target.value)}
                placeholder="0" step="any" className="flex-1" />
              <select value={fromUnit} onChange={e => setFromUnit(e.target.value)} style={{width:'4.5rem', flexShrink:0}}>
                {catData.units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-center text-lg" style={S_MUTED}>→</div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('convertTo', lang)}</label>
            <div className="flex gap-2 items-center">
              <div className="flex-1 p-2 rounded-lg text-center" style={{background:'var(--primary-light)', minHeight:'2.5rem'}}>
                <span className="text-xl font-bold mono" style={S_PRIMARY}>
                  {result !== null ? fmt(result) : '—'}
                </span>
              </div>
              <select value={toUnit} onChange={e => setToUnit(e.target.value)} style={{width:'4.5rem', flexShrink:0}}>
                {catData.units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
