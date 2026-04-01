import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED, S_MUTED_DIM, S_PRIMARY } from '../../lib/styleConstants.js';

export default function PercentCalc() {
  const lang = useLang();
  const [solute, setSolute] = useState('');
  const [vol, setVol] = useState('');
  const [perc, setPerc] = useState('');
  const [mode, setMode] = useState('wv'); // wv or vv
  const [solve, setSolve] = useState('solute'); // solute, vol, perc

  let result = null;
  if (solve === 'solute' && +vol && +perc) {
    result = { val: (+perc / 100) * +vol, label: mode === 'wv' ? t('soluteMass', lang) : t('soluteVol', lang), unit: mode === 'wv' ? 'g' : 'mL' };
  } else if (solve === 'vol' && +solute && +perc) {
    result = { val: +solute / (+perc / 100), label: t('finalVol', lang), unit: 'mL' };
  } else if (solve === 'perc' && +solute && +vol) {
    result = { val: (+solute / +vol) * 100, label: t('percentConc', lang), unit: '%' };
  }

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="text-sm font-bold mb-1">{t('percentCalcTitle', lang)}</h3>
      <div className="flex gap-3 mb-4">
        <button onClick={() => setMode('wv')}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold"
          style={{background: mode === 'wv' ? 'var(--primary)' : 'var(--bg-2)', color: mode === 'wv' ? 'white' : 'var(--text-muted)'}}>
          {t('wv', lang)}
        </button>
        <button onClick={() => setMode('vv')}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold"
          style={{background: mode === 'vv' ? 'var(--primary)' : 'var(--bg-2)', color: mode === 'vv' ? 'white' : 'var(--text-muted)'}}>
          {t('vv', lang)}
        </button>
      </div>
      <div className="flex gap-2 mb-4 text-xs">
        <span style={S_MUTED}>{t('solveFor', lang)}:</span>
        {[{ id: 'solute', l: mode === 'wv' ? t('soluteG', lang) : t('soluteML', lang) }, { id: 'vol', l: t('volML', lang) }, { id: 'perc', l: t('pctLabel', lang) }].map(s => (
          <button key={s.id} onClick={() => setSolve(s.id)}
            className="px-2.5 py-1 rounded-md font-bold"
            style={{background: solve === s.id ? 'var(--primary)' : 'var(--bg-2)', color: solve === s.id ? 'white' : 'var(--text-muted)'}}>
            {s.l}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        <div className="p-3 rounded-lg" style={{background: solve === 'perc' ? 'var(--primary-light)' : 'var(--bg-2)', border: solve === 'perc' ? '2px solid var(--primary)' : 'none'}}>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('percentConc', lang)}</label>
          <p className="text-xs mb-1" style={S_MUTED_DIM}>{t('pctPercDesc', lang)}</p>
          {solve === 'perc' ? (
            result && <p className="text-2xl font-bold mono text-center" style={S_PRIMARY}>{result.val.toFixed(4)} %</p>
          ) : (
            <input type="number" value={perc} onChange={e => setPerc(e.target.value)} placeholder="e.g. 10" step="any" />
          )}
        </div>
        <div className="p-3 rounded-lg" style={{background: solve === 'solute' ? 'var(--primary-light)' : 'var(--bg-2)', border: solve === 'solute' ? '2px solid var(--primary)' : 'none'}}>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>
            {mode === 'wv' ? t('soluteMass', lang) : t('soluteVol', lang)}
          </label>
          <p className="text-xs mb-1" style={S_MUTED_DIM}>{mode === 'wv' ? t('pctSoluteDescWV', lang) : t('pctSoluteDescVV', lang)}</p>
          {solve === 'solute' ? (
            result && <p className="text-2xl font-bold mono text-center" style={S_PRIMARY}>{result.val.toFixed(4)} {result.unit}</p>
          ) : (
            <input type="number" value={solute} onChange={e => setSolute(e.target.value)} placeholder="0" step="any" />
          )}
        </div>
        <div className="p-3 rounded-lg" style={{background: solve === 'vol' ? 'var(--primary-light)' : 'var(--bg-2)', border: solve === 'vol' ? '2px solid var(--primary)' : 'none'}}>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('finalVol', lang)}</label>
          <p className="text-xs mb-1" style={S_MUTED_DIM}>{t('pctVolDesc', lang)}</p>
          {solve === 'vol' ? (
            result && <p className="text-2xl font-bold mono text-center" style={S_PRIMARY}>{result.val.toFixed(4)} mL</p>
          ) : (
            <input type="number" value={vol} onChange={e => setVol(e.target.value)} placeholder="0" step="any" />
          )}
        </div>
      </div>
    </div>
  );
}
