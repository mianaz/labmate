import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { dilutionSolvent } from '../../lib/calculators.js';

const SYM = { c1: 'C₁', v1: 'V₁', c2: 'C₂', v2: 'V₂' };
const CONC_UNITS = ['M', 'mM', 'µM', 'nM', '%'];
const VOL_UNITS = ['L', 'mL', 'µL'];
const unitFactorsC = { M: 1, mM: 1e-3, µM: 1e-6, nM: 1e-9, '%': 1 };
const unitFactorsV = { L: 1, mL: 1e-3, µL: 1e-6 };

const fmtVal = (v) => (v < 0.001 ? v.toExponential(3) : v.toFixed(4));

// Variable symbol inside a (globally uppercased) field label.
const SYM_STYLE = { textTransform: 'none', letterSpacing: 0, color: 'var(--text)', fontSize: '0.8125rem', marginRight: '0.45rem' };

// One variable of C₁V₁ = C₂V₂: an input + unit select, or — when it is the
// unknown being solved for — a readout in the same slot. Module scope: defined
// inside the component it was a new element type every render, so React
// destroyed and recreated the <input> on each keystroke.
function Field({ id, sym, label, value, setValue, unit, setUnit, units, isTarget, result, lang }) {
  const unitSelect = (
    <select value={unit} onChange={e => setUnit(e.target.value)} className="shrink-0"
      aria-label={`${sym} ${lang === 'zh' ? '单位' : 'unit'}`} style={{ width: '5.5rem' }}>
      {units.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  );

  if (isTarget) {
    return (
      <div className={result ? 'readout' : 'readout is-empty'} aria-live="polite" aria-atomic="true"
        style={{ padding: '0.5rem 0.5rem 0.5rem 1rem' }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="readout-label">
              <span style={SYM_STYLE}>{sym}</span>{label}
            </div>
            <div className="readout-value tabular" style={result ? { fontSize: '1.375rem', marginTop: '0.1rem' } : { marginTop: '0.1rem' }}>
              {result ? fmtVal(result.val) : t('enterOther3', lang)}
            </div>
          </div>
          {unitSelect}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <label htmlFor={id}><span style={SYM_STYLE}>{sym}</span>{label}</label>
      <div className="flex gap-2">
        <input id={id} type="number" value={value} onChange={e => setValue(e.target.value)}
          className="flex-1 min-w-0" placeholder="0" step="any" />
        {unitSelect}
      </div>
    </div>
  );
}

export default function DilutionCalc() {
  const lang = useLang();
  const [c1, setC1] = useState('');
  const [v1, setV1] = useState('');
  const [c2, setC2] = useState('');
  const [v2, setV2] = useState('');
  const [solve, setSolve] = useState('v1');
  const [c1Unit, setC1Unit] = useState('M');
  const [v1Unit, setV1Unit] = useState('mL');
  const [c2Unit, setC2Unit] = useState('M');
  const [v2Unit, setV2Unit] = useState('mL');

  function calculate() {
    const C1 = +c1 * unitFactorsC[c1Unit];
    const V1 = +v1 * unitFactorsV[v1Unit];
    const C2 = +c2 * unitFactorsC[c2Unit];
    const V2 = +v2 * unitFactorsV[v2Unit];

    if (solve === 'v1' && C1 && C2 && V2) return { val: (C2 * V2) / C1 / unitFactorsV[v1Unit], unit: v1Unit, label: 'V₁' };
    if (solve === 'c1' && V1 && C2 && V2) return { val: (C2 * V2) / V1 / unitFactorsC[c1Unit], unit: c1Unit, label: 'C₁' };
    if (solve === 'v2' && C1 && V1 && C2) return { val: (C1 * V1) / C2 / unitFactorsV[v2Unit], unit: v2Unit, label: 'V₂' };
    if (solve === 'c2' && C1 && V1 && V2) return { val: (C1 * V1) / V2 / unitFactorsC[c2Unit], unit: c2Unit, label: 'C₂' };
    return null;
  }

  const result = calculate();

  let prep = null;
  if (result) {
    // V₁ and V₂ can carry different units: the solvent is worked out in V₂'s.
    if (solve === 'v1') {
      const solventVol = dilutionSolvent({ v1: result.val, v1Unit, v2: +v2, v2Unit });
      if (solventVol > 0) {
        prep = (<>
          {t('dilPrepPipette', lang)} <strong>{fmtVal(result.val)} {v1Unit}</strong> {t('dilPrepStock', lang)}{lang === 'zh' ? '，' : ', '}
          {t('dilPrepAdd', lang)} <strong>{fmtVal(solventVol)} {v2Unit}</strong> {t('dilPrepSolvent', lang)}{lang === 'zh' ? '，' : ' '}
          {t('dilPrepReach', lang)} <strong>{(+v2).toFixed(4)} {v2Unit}</strong> {t('dilPrepTotal', lang)}
        </>);
      }
    } else if (solve === 'v2') {
      const v1Val = +v1;
      const solventVol = dilutionSolvent({ v1: v1Val, v1Unit, v2: result.val, v2Unit });
      if (solventVol > 0) {
        prep = (<>
          {t('dilPrepPipette', lang)} <strong>{fmtVal(v1Val)} {v1Unit}</strong> {t('dilPrepStock', lang)}{lang === 'zh' ? '，' : ', '}
          {t('dilPrepAdd', lang)} <strong>{fmtVal(solventVol)} {v2Unit}</strong> {t('dilPrepSolvent', lang)}{lang === 'zh' ? '，' : ' '}
          {t('dilPrepReach', lang)} <strong>{fmtVal(result.val)} {v2Unit}</strong> {t('dilPrepTotal', lang)}
        </>);
      }
    } else if (solve === 'c2') {
      prep = (<>
        {t('dilPrepDilute', lang)} <strong>{fmtVal(result.val)} {c2Unit}</strong>{lang === 'zh' ? '，' : ', '}
        {t('dilPrepUsing', lang)} <strong>{(+v1).toFixed(4)} {v1Unit}</strong> {t('dilPrepStock', lang)}{lang === 'zh' ? '，' : ' → '}
        <strong>{(+v2).toFixed(4)} {v2Unit}</strong> {t('dilPrepFinalVol', lang)}
      </>);
    } else if (solve === 'c1') {
      prep = (<>
        {t('dilPrepNeedStock', lang)} <strong>{fmtVal(result.val)} {c1Unit}</strong>{lang === 'zh' ? '，' : ' '}
        {t('dilPrepToGet', lang)} <strong>{(+c2).toFixed(4)} {c2Unit}</strong>{lang === 'zh' ? '，' : ', '}
        {t('dilPrepFrom', lang)} <strong>{(+v1).toFixed(4)} {v1Unit}</strong> → <strong>{(+v2).toFixed(4)} {v2Unit}</strong>
      </>);
    }
  }

  const field = { result, lang };

  return (
    <section className="panel" aria-labelledby="calc-dilution-title">
      <div className="panel-head">
        <h2 id="calc-dilution-title" className="section-title min-w-0">{t('calcTaskDilution', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>C₁V₁ = C₂V₂</span>
      </div>
      <div className="panel-body space-y-4 @container">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>{t('dilutionCalcDesc', lang)}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="eyebrow" id="dil-solve-label">{t('solveFor', lang)}</span>
          <div className="seg" role="group" aria-labelledby="dil-solve-label">
            {['c1', 'v1', 'c2', 'v2'].map(s => (
              <button key={s} type="button" aria-pressed={solve === s} onClick={() => setSolve(s)}
                style={{ minWidth: '3rem', minHeight: '2.25rem', fontSize: '0.875rem' }}>
                {SYM[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Row 1 = stock side (C₁ · V₁), row 2 = final side (C₂ · V₂) */}
        <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @md:items-end">
          <Field {...field} id="dil-c1" sym="C₁" label={t('dilC1Desc', lang)} value={c1} setValue={setC1} unit={c1Unit} setUnit={setC1Unit} units={CONC_UNITS} isTarget={solve === 'c1'} />
          <Field {...field} id="dil-v1" sym="V₁" label={t('dilV1Desc', lang)} value={v1} setValue={setV1} unit={v1Unit} setUnit={setV1Unit} units={VOL_UNITS} isTarget={solve === 'v1'} />
          <Field {...field} id="dil-c2" sym="C₂" label={t('dilC2Desc', lang)} value={c2} setValue={setC2} unit={c2Unit} setUnit={setC2Unit} units={CONC_UNITS} isTarget={solve === 'c2'} />
          <Field {...field} id="dil-v2" sym="V₂" label={t('dilV2Desc', lang)} value={v2} setValue={setV2} unit={v2Unit} setUnit={setV2Unit} units={VOL_UNITS} isTarget={solve === 'v2'} />
        </div>

        {prep && (
          <div className="notice notice-info">
            <p><span className="notice-title">{t('dilPrepSummary', lang)}</span>{lang === 'zh' ? '：' : ': '}{prep}</p>
          </div>
        )}
      </div>
    </section>
  );
}
