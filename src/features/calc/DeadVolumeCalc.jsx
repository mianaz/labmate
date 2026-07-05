import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED, S_PRIMARY, S_BG2 } from '../../lib/styleConstants.js';

export default function DeadVolumeCalc() {
  const lang = useLang();
  const [nSamples, setNSamples] = useState('');
  const [volPer, setVolPer] = useState('');
  const [volUnit, setVolUnit] = useState('µL');
  const [deadPct, setDeadPct] = useState('15');
  const [preset, setPreset] = useState('custom');

  const presets = [
    { id: 'pcr', label: 'PCR / qPCR', n: '24', vol: '20', unit: 'µL', dead: '15' },
    { id: 'wb', label: 'WB Loading', n: '10', vol: '25', unit: 'µL', dead: '20' },
    { id: '96well', label: '96-well plate', n: '96', vol: '200', unit: 'µL', dead: '10' },
    { id: 'transfection', label: lang === 'en' ? 'Transfection' : '转染', n: '6', vol: '500', unit: 'µL', dead: '20' },
    { id: 'mastermix', label: 'Master Mix', n: '48', vol: '50', unit: 'µL', dead: '25' },
    { id: 'custom', label: t('customPreset', lang), n: '', vol: '', unit: 'µL', dead: '15' },
  ];

  function applyPreset(p) {
    setPreset(p.id);
    if (p.id !== 'custom') {
      setNSamples(p.n); setVolPer(p.vol); setVolUnit(p.unit); setDeadPct(p.dead);
    }
  }

  const n = parseFloat(nSamples) || 0;
  const v = parseFloat(volPer) || 0;
  const d = parseFloat(deadPct) || 0;
  const base = n * v;
  const deadAmt = base * (d / 100);
  const total = base + deadAmt;
  const hasResult = n > 0 && v > 0;

  // Unit conversion for display
  const displayTotal = total >= 1000 && volUnit === 'µL'
    ? { val: (total / 1000).toFixed(2), unit: 'mL' }
    : { val: total.toFixed(1), unit: volUnit };

  return (
    <div className="card p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-1">{t('deadVolTitle', lang)}</h2>
      <p className="text-sm mb-4" style={S_MUTED}>{t('deadVolDesc', lang)}</p>

      <p className="text-xs font-semibold mb-2" style={S_MUTED}>{t('presets', lang)}</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {presets.map(p => (
          <button key={p.id} onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: preset === p.id ? 'var(--primary)' : 'var(--bg-2)',
              color: preset === p.id ? 'var(--on-primary)' : 'var(--text-muted)',
              border: `1px solid ${preset === p.id ? 'var(--primary)' : 'var(--border)'}`,
            }}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="p-3 rounded-lg" style={S_BG2}>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('numSamples', lang)}</label>
          <input type="number" value={nSamples} onChange={e => { setNSamples(e.target.value); setPreset('custom'); }}
            placeholder="e.g. 24" min="1" step="1"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)'}} />
        </div>

        <div className="p-3 rounded-lg" style={S_BG2}>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('volPerSample', lang)}</label>
          <div className="flex gap-2 items-center">
            <input type="number" value={volPer} onChange={e => { setVolPer(e.target.value); setPreset('custom'); }}
              placeholder="e.g. 200" min="0" step="any"
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', minWidth:0}} />
            <select value={volUnit} onChange={e => setVolUnit(e.target.value)}
              className="px-2 py-2 rounded-lg text-sm"
              style={{background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', width:'4.5rem', flexShrink:0}}>
              <option value="µL">µL</option>
              <option value="mL">mL</option>
              <option value="L">L</option>
            </select>
          </div>
        </div>

        <div className="p-3 rounded-lg" style={S_BG2}>
          <label className="text-xs font-semibold block mb-1" style={S_MUTED}>
            {t('deadVolPercent', lang)}: <span className="mono font-bold" style={S_PRIMARY}>{deadPct}%</span>
          </label>
          <input type="range" min="0" max="50" step="1" value={deadPct}
            onChange={e => { setDeadPct(e.target.value); setPreset('custom'); }}
            className="w-full accent-teal-600" />
          <div className="flex justify-between text-xs mt-1" style={S_MUTED}>
            <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>50%</span>
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
      {hasResult && (
        <div className="mt-5 p-4 rounded-xl" style={{background:'var(--primary-light)', border:'2px solid var(--primary)'}}>
          <p className="text-xs mb-2" style={S_MUTED}>{t('totalNeeded', lang)}</p>
          <p className="text-2xl font-bold mono" style={S_PRIMARY}>
            {displayTotal.val} {displayTotal.unit}
          </p>
          <div className="flex gap-4 mt-2 text-xs" style={S_MUTED}>
            <span>{t('withoutDead', lang)}: <span className="mono font-bold">{base.toFixed(1)} {volUnit}</span></span>
            <span>{t('deadVolAmount', lang)}: <span className="mono font-bold">+{deadAmt.toFixed(1)} {volUnit}</span></span>
          </div>
          <p className="text-xs mt-2 italic" style={S_MUTED}>
            = {n} × {v} {volUnit} × (1 + {d}%)
          </p>
        </div>
      )}
      </div>

      <div className="mt-4 p-3 rounded-lg text-xs" style={{background:'var(--accent-light)', color:'var(--accent)'}}>
        {t('deadVolTip', lang)}
      </div>
    </div>
  );
}
