import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { IconInfo } from '../../components/icons.jsx';

// Variable symbol inside a (globally uppercased) field label.
const SYM_STYLE = { textTransform: 'none', letterSpacing: 0, color: 'var(--text)', fontSize: '0.8125rem', marginRight: '0.45rem' };
const TICKS = [0, 10, 20, 30, 40, 50];

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

  const deadLabel = t('deadVolPercent', lang).replace(/\s*[(（]%[)）]\s*$/, '');

  return (
    <section className="panel" aria-labelledby="calc-deadvol-title">
      <div className="panel-head">
        <h2 id="calc-deadvol-title" className="section-title min-w-0">{t('calcTaskDeadVol', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>V × N × (1 + dead%)</span>
      </div>
      <div className="panel-body space-y-4 @container">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>{t('deadVolDesc', lang)}</p>

        <div role="group" aria-labelledby="dv-presets-label">
          <div className="eyebrow mb-1.5" id="dv-presets-label">{t('presets', lang)}</div>
          <div className="chip-row">
            {presets.map(p => (
              <button key={p.id} type="button" className="chip" aria-pressed={preset === p.id} onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @md:items-end">
          <div className="min-w-0">
            <label htmlFor="dv-n"><span style={SYM_STYLE}>N</span>{t('numSamples', lang)}</label>
            <input id="dv-n" type="number" value={nSamples} onChange={e => { setNSamples(e.target.value); setPreset('custom'); }}
              placeholder="e.g. 24" min="1" step="1" className="w-full" />
          </div>
          <div className="min-w-0">
            <label htmlFor="dv-vol"><span style={SYM_STYLE}>V</span>{t('volPerSample', lang)}</label>
            <div className="flex gap-2">
              <input id="dv-vol" type="number" value={volPer} onChange={e => { setVolPer(e.target.value); setPreset('custom'); }}
                placeholder="e.g. 200" min="0" step="any" className="flex-1 min-w-0" />
              <select value={volUnit} onChange={e => setVolUnit(e.target.value)} aria-label={`V ${lang === 'zh' ? '单位' : 'unit'}`}
                className="shrink-0" style={{ width: '5.5rem' }}>
                <option value="µL">µL</option>
                <option value="mL">mL</option>
                <option value="L">L</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="dv-dead" style={{ marginBottom: 0 }}>{deadLabel}</label>
            <output htmlFor="dv-dead" className="mono tabular" style={{ fontSize: '0.875rem', fontWeight: 700 }}>{deadPct}%</output>
          </div>
          <input id="dv-dead" type="range" min="0" max="50" step="1" value={deadPct}
            onChange={e => { setDeadPct(e.target.value); setPreset('custom'); }}
            className="w-full mt-1.5" />
          <div className="flex justify-between mono" aria-hidden="true" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {TICKS.map(p => <span key={p}>{p}%</span>)}
          </div>
        </div>

        <div className={hasResult ? 'readout' : 'readout is-empty'} aria-live="polite" aria-atomic="true">
          <div className="readout-label">{t('totalNeeded', lang)}</div>
          {hasResult ? (
            <>
              <div className="readout-value">{displayTotal.val}<span className="unit">{displayTotal.unit}</span></div>
              <div className="readout-sub">
                {t('withoutDead', lang)} {base.toFixed(1)} {volUnit} · {t('deadVolAmount', lang)} +{deadAmt.toFixed(1)} {volUnit}
              </div>
              <div className="readout-sub" style={{ marginTop: '0.1rem' }}>= {n} × {v} {volUnit} × (1 + {d}%)</div>
            </>
          ) : (
            <div className="readout-value">{lang === 'zh' ? '输入样品数和每份用量' : 'Enter the number of samples and volume per sample'}</div>
          )}
        </div>

        <div className="notice">
          <IconInfo size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
          <p>{t('deadVolTip', lang)}</p>
        </div>
      </div>
    </section>
  );
}
