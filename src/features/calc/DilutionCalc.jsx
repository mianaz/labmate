import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED, S_PRIMARY, S_TEXT } from '../../lib/styleConstants.js';

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

  const unitFactorsC = { M: 1, mM: 1e-3, µM: 1e-6, nM: 1e-9, '%': 1 };
  const unitFactorsV = { L: 1, mL: 1e-3, µL: 1e-6 };

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

  function InputRow({ label, desc, value, setValue, disabled, unit, setUnit, units, isSolveTarget }) {
    return (
      <div className={`p-3 rounded-lg ${isSolveTarget ? 'bg-primary-light border-2 border-primary' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold mono text-base">{label}</span>
          {desc && <span className="text-xs" style={S_MUTED}>{desc}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">=</span>
          {isSolveTarget ? (
            <div className="flex-1 text-center">
              {result ? (
                <span className="text-xl font-bold mono" style={S_PRIMARY}>
                  {result.val < 0.001 ? result.val.toExponential(3) : result.val.toFixed(4)}
                </span>
              ) : (
                <span className="text-gray-400 text-sm">{t('enterOther3', lang)}</span>
              )}
            </div>
          ) : (
            <input type="number" value={value} onChange={e => setValue(e.target.value)}
              className="flex-1" placeholder="0" step="any" style={{minWidth: 0}} />
          )}
          <select value={unit} onChange={e => setUnit(e.target.value)} style={{width:'4.5rem', flexShrink: 0}}>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
    );
  }

  const concUnits = ['M', 'mM', 'µM', 'nM', '%'];
  const volUnits = ['L', 'mL', 'µL'];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold">{t('dilutionFormula', lang)}</h3>
        <div className="flex items-center gap-2 text-sm">
          <span style={S_MUTED}>{t('solveFor', lang)}:</span>
          {['c1','v1','c2','v2'].map(s => (
            <button key={s} onClick={() => setSolve(s)}
              className={`px-2.5 py-1 rounded-md mono font-bold text-xs transition-all ${
                solve === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>{s === 'c1' ? 'C₁' : s === 'v1' ? 'V₁' : s === 'c2' ? 'C₂' : 'V₂'}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <InputRow label="C₁" desc={t('dilC1Desc', lang)} value={c1} setValue={setC1} unit={c1Unit} setUnit={setC1Unit} units={concUnits} isSolveTarget={solve==='c1'} />
        <InputRow label="V₁" desc={t('dilV1Desc', lang)} value={v1} setValue={setV1} unit={v1Unit} setUnit={setV1Unit} units={volUnits} isSolveTarget={solve==='v1'} />
        <div className="text-center mono text-gray-300 text-lg">=</div>
        <InputRow label="C₂" desc={t('dilC2Desc', lang)} value={c2} setValue={setC2} unit={c2Unit} setUnit={setC2Unit} units={concUnits} isSolveTarget={solve==='c2'} />
        <InputRow label="V₂" desc={t('dilV2Desc', lang)} value={v2} setValue={setV2} unit={v2Unit} setUnit={setV2Unit} units={volUnits} isSolveTarget={solve==='v2'} />
      </div>

      <div aria-live="polite" aria-atomic="true">
      {result && (
        <div className="mt-4 p-4 rounded-lg border-2 border-primary bg-primary-light text-center">
          <p className="text-sm" style={S_MUTED}>{t('result', lang)}</p>
          <p className="text-2xl font-bold mono" style={S_PRIMARY}>
            {result.label} = {result.val < 0.001 ? result.val.toExponential(3) : result.val.toFixed(4)} {result.unit}
          </p>
        </div>
      )}
      </div>
      {result && (() => {
        const fmtVal = (v) => v < 0.001 ? v.toExponential(3) : v.toFixed(4);
        let prep = null;
        if (solve === 'v1') {
          const solventVol = +v2 - result.val;
          if (solventVol > 0) {
            prep = (<p className="text-sm" style={S_TEXT}>
              {t('dilPrepPipette', lang)} <strong>{fmtVal(result.val)} {v1Unit}</strong> {t('dilPrepStock', lang)}{lang === 'zh' ? '，' : ', '}
              {t('dilPrepAdd', lang)} <strong>{fmtVal(solventVol)} {v2Unit}</strong> {t('dilPrepSolvent', lang)}{lang === 'zh' ? '，' : ' '}
              {t('dilPrepReach', lang)} <strong>{(+v2).toFixed(4)} {v2Unit}</strong> {t('dilPrepTotal', lang)}
            </p>);
          }
        } else if (solve === 'v2') {
          const v1Val = +v1;
          const solventVol = result.val - v1Val;
          if (solventVol > 0) {
            prep = (<p className="text-sm" style={S_TEXT}>
              {t('dilPrepPipette', lang)} <strong>{fmtVal(v1Val)} {v1Unit}</strong> {t('dilPrepStock', lang)}{lang === 'zh' ? '，' : ', '}
              {t('dilPrepAdd', lang)} <strong>{fmtVal(solventVol)} {v2Unit}</strong> {t('dilPrepSolvent', lang)}{lang === 'zh' ? '，' : ' '}
              {t('dilPrepReach', lang)} <strong>{fmtVal(result.val)} {v2Unit}</strong> {t('dilPrepTotal', lang)}
            </p>);
          }
        } else if (solve === 'c2') {
          prep = (<p className="text-sm" style={S_TEXT}>
            {t('dilPrepDilute', lang)} <strong>{fmtVal(result.val)} {c2Unit}</strong>{lang === 'zh' ? '，' : ', '}
            {t('dilPrepUsing', lang)} <strong>{(+v1).toFixed(4)} {v1Unit}</strong> {t('dilPrepStock', lang)}{lang === 'zh' ? '，' : ' → '}
            <strong>{(+v2).toFixed(4)} {v2Unit}</strong> {t('dilPrepFinalVol', lang)}
          </p>);
        } else if (solve === 'c1') {
          prep = (<p className="text-sm" style={S_TEXT}>
            {t('dilPrepNeedStock', lang)} <strong>{fmtVal(result.val)} {c1Unit}</strong>{lang === 'zh' ? '，' : ' '}
            {t('dilPrepToGet', lang)} <strong>{(+c2).toFixed(4)} {c2Unit}</strong>{lang === 'zh' ? '，' : ', '}
            {t('dilPrepFrom', lang)} <strong>{(+v1).toFixed(4)} {v1Unit}</strong> → <strong>{(+v2).toFixed(4)} {v2Unit}</strong>
          </p>);
        }
        return prep ? (
          <div className="mt-3 p-3 rounded-lg" style={{background:'var(--accent-light)', border:'1px solid var(--border)'}}>
            <p className="text-xs font-semibold mb-1" style={S_MUTED}>{t('dilPrepSummary', lang)}</p>
            {prep}
          </div>
        ) : null;
      })()}
    </div>
  );
}
