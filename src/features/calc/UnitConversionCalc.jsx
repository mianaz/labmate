import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { IconArrowRight } from '../../components/icons.jsx';

const CATEGORIES = {
  volume: {
    labelKey: 'convertCatVolume',
    units: ['L', 'mL', 'µL', 'nL', 'fl oz', 'cup', 'pt', 'qt', 'gal'],
    toBase: { L: 1, mL: 1e-3, 'µL': 1e-6, nL: 1e-9, 'fl oz': 0.0295735, cup: 0.236588, pt: 0.473176, qt: 0.946353, gal: 3.78541 },
  },
  mass: {
    labelKey: 'convertCatMass',
    units: ['kg', 'g', 'mg', 'µg', 'ng', 'lb', 'oz'],
    toBase: { kg: 1000, g: 1, mg: 1e-3, 'µg': 1e-6, ng: 1e-9, lb: 453.592, oz: 28.3495 },
  },
  length: {
    labelKey: 'convertCatLength',
    units: ['m', 'cm', 'mm', 'µm', 'nm', 'in', 'ft', 'yd'],
    toBase: { m: 1, cm: 0.01, mm: 0.001, 'µm': 1e-6, nm: 1e-9, 'in': 0.0254, ft: 0.3048, yd: 0.9144 },
  },
  temperature: {
    labelKey: 'convertCatTemp',
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
    labelKey: 'convertCatPressure',
    units: ['atm', 'Pa', 'kPa', 'bar', 'psi', 'mmHg', 'Torr'],
    toBase: { atm: 1, Pa: 9.8692e-6, kPa: 0.00986923, bar: 0.986923, psi: 0.068046, mmHg: 0.00131579, Torr: 0.00131579 },
  },
};

function fmt(n) {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) < 0.0001 && n !== 0) return n.toExponential(4);
  if (Math.abs(n) >= 1e7) return n.toExponential(4);
  return parseFloat(n.toPrecision(8)).toString();
}

const UNIT_W = { width: '6rem' };

export default function UnitConversionCalc() {
  const lang = useLang();
  const [cat, setCat] = useState('volume');
  const [fromUnit, setFromUnit] = useState('mL');
  const [toUnit, setToUnit] = useState('µL');
  const [value, setValue] = useState('');

  const catData = CATEGORIES[cat];
  const numVal = parseFloat(value);
  let result = null;
  if (!isNaN(numVal) && value !== '') {
    if (catData.convert) {
      result = catData.convert(numVal, fromUnit, toUnit);
    } else {
      result = numVal * catData.toBase[fromUnit] / catData.toBase[toUnit];
    }
  }

  function pickCategory(k) {
    setCat(k); setFromUnit(CATEGORIES[k].units[0]); setToUnit(CATEGORIES[k].units[1]); setValue('');
  }
  // Swap direction and carry the converted value across, so the same quantity
  // is shown the other way round (1.5 mL → 1500 µL becomes 1500 µL → 1.5 mL).
  function swap() {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    if (result !== null && Number.isFinite(result)) setValue(fmt(result));
  }

  const unitWord = lang === 'zh' ? '单位' : 'unit';
  const swapLabel = lang === 'zh' ? '交换单位' : 'Swap units';

  return (
    <section className="panel" aria-labelledby="calc-convert-title">
      <div className="panel-head">
        <h2 id="calc-convert-title" className="section-title min-w-0">{t('calcTaskConvert', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>{lang === 'zh' ? '单位 ↔ 单位' : 'unit ↔ unit'}</span>
      </div>
      <div className="panel-body space-y-4 @container">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>
          {t('convertCalcDesc', lang)}
        </p>

        <div role="group" aria-labelledby="conv-cat-label">
          <div className="eyebrow mb-1.5" id="conv-cat-label">{t('convertCategory', lang)}</div>
          <div className="chip-row">
            {Object.keys(CATEGORIES).map(k => (
              <button key={k} type="button" className="chip" aria-pressed={cat === k} onClick={() => pickCategory(k)}>
                {t(CATEGORIES[k].labelKey, lang)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 @xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @xl:items-end">
          <div className="min-w-0">
            <label htmlFor="conv-value">{t('convertFrom', lang)}</label>
            <div className="flex gap-2">
              <input id="conv-value" type="number" value={value} onChange={e => setValue(e.target.value)}
                placeholder="0" step="any" className="flex-1 min-w-0" />
              <select value={fromUnit} onChange={e => setFromUnit(e.target.value)} aria-label={`${t('convertFrom', lang)} ${unitWord}`}
                className="shrink-0" style={UNIT_W}>
                {catData.units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-center">
            <button type="button" className="btn btn-icon" onClick={swap} aria-label={swapLabel} title={swapLabel}>
              {/* ⇄ built from the stroke icon set; turned to ⇅ when from/to stack on phones */}
              <span aria-hidden="true" className="inline-flex flex-col items-center rotate-90 @xl:rotate-0">
                <IconArrowRight size={14} style={{ marginBottom: -4 }} />
                <IconArrowRight size={14} style={{ transform: 'scaleX(-1)' }} />
              </span>
            </button>
          </div>

          <div className={result !== null ? 'readout' : 'readout is-empty'} aria-live="polite" aria-atomic="true"
            style={{ padding: '0.5rem 0.5rem 0.5rem 1rem' }}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="readout-label">{t('convertTo', lang)}</div>
                <div className="readout-value tabular" style={result !== null ? { fontSize: '1.375rem', marginTop: '0.1rem' } : { marginTop: '0.1rem' }}>
                  {result !== null ? fmt(result) : (lang === 'zh' ? '输入数值' : 'Enter a value')}
                </div>
              </div>
              <select value={toUnit} onChange={e => setToUnit(e.target.value)} aria-label={`${t('convertTo', lang)} ${unitWord}`}
                className="shrink-0" style={UNIT_W}>
                {catData.units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
