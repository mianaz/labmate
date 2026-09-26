import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';

// "Final Volume (mL)" → ['Final Volume', 'mL']: the unit is shown next to the
// value instead, so the uppercase field label never renders "ML" / "G".
function splitUnit(text) {
  const m = /^(.*?)\s*[(（]([^)）]+)[)）]\s*$/.exec(text);
  return m ? m[1] : text;
}

const SUFFIX_STYLE = { fontSize: '0.75rem', color: 'var(--text-muted)' };

// One quantity of the percent equation: an input with a fixed unit, or — when
// it is the unknown being solved for — a readout in the same slot.
function Field({ id, label, unit, value, setValue, placeholder, isTarget, result, lang }) {
  if (isTarget) {
    return (
      <div className={result ? 'readout' : 'readout is-empty'} aria-live="polite" aria-atomic="true"
        style={{ padding: '0.5rem 0.75rem 0.5rem 1rem' }}>
        <div className="readout-label">{label}</div>
        <div className="readout-value tabular" style={result ? { fontSize: '1.375rem', marginTop: '0.1rem' } : { marginTop: '0.1rem' }}>
          {result ? <>{result.val.toFixed(4)}<span className="unit">{unit}</span></> : (lang === 'zh' ? '输入其他两个值' : 'Enter the other 2 values')}
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} step="any"
          className="w-full" aria-describedby={`${id}-unit`} style={{ paddingRight: '3rem' }} />
        <span id={`${id}-unit`} className="mono absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={SUFFIX_STYLE}>{unit}</span>
      </div>
    </div>
  );
}

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

  const soluteUnit = mode === 'wv' ? 'g' : 'mL';
  const solveOpts = [
    { id: 'solute', l: splitUnit(mode === 'wv' ? t('soluteG', lang) : t('soluteML', lang)) },
    { id: 'vol', l: splitUnit(t('volML', lang)) },
    { id: 'perc', l: splitUnit(t('pctLabel', lang)) },
  ];
  const field = { result, lang };

  return (
    <section className="panel" aria-labelledby="calc-percent-title">
      <div className="panel-head">
        <h2 id="calc-percent-title" className="section-title min-w-0">{t('calcTaskPercent', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>
          {mode === 'wv' ? '% (w/v) = g / 100 mL' : '% (v/v) = mL / 100 mL'}
        </span>
      </div>
      <div className="panel-body space-y-4 @container">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>{t('percentCalcDesc', lang)}</p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="eyebrow" id="pct-type-label">{lang === 'zh' ? '类型' : 'Type'}</span>
            <div className="seg" role="group" aria-labelledby="pct-type-label">
              {[{ id: 'wv', short: 'w/v' }, { id: 'vv', short: 'v/v' }].map(o => (
                <button key={o.id} type="button" aria-pressed={mode === o.id} onClick={() => setMode(o.id)} title={t(o.id, lang)}
                  style={{ minHeight: '2.25rem' }}>
                  <span className="@lg:hidden">{o.short}</span>
                  <span className="hidden @lg:inline">{t(o.id, lang)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="eyebrow" id="pct-solve-label">{t('solveFor', lang)}</span>
            <div className="seg" role="group" aria-labelledby="pct-solve-label">
              {solveOpts.map(s => (
                <button key={s.id} type="button" aria-pressed={solve === s.id} onClick={() => setSolve(s.id)}
                  style={{ minHeight: '2.25rem' }}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-x-4 gap-y-3 @lg:grid-cols-3 @lg:items-end">
          <Field {...field} id="pct-perc" label={splitUnit(t('percentConc', lang))} unit="%" value={perc} setValue={setPerc}
            placeholder="e.g. 10" isTarget={solve === 'perc'} />
          <Field {...field} id="pct-solute" label={splitUnit(mode === 'wv' ? t('soluteMass', lang) : t('soluteVol', lang))} unit={soluteUnit}
            value={solute} setValue={setSolute} placeholder="0" isTarget={solve === 'solute'} />
          <Field {...field} id="pct-vol" label={splitUnit(t('finalVol', lang))} unit="mL" value={vol} setValue={setVol}
            placeholder="0" isTarget={solve === 'vol'} />
        </div>
      </div>
    </section>
  );
}
