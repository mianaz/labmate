import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { calcGel } from '../../lib/calculators.js';
import { downloadFile } from '../../lib/utils.js';
import { IconDownload, IconAlert } from '../../components/icons.jsx';

// SDS-PAGE gel calculator. Rendered inside the recipe detail document for the
// sds_page_gel recipe (RecipeDetail wraps it in a .doc-section), so it uses the
// document idiom — section head with an ink rule, plain tables — not cards.

// Helper to format gel recipe as text for download
function gelToText(title, data) {
  let txt = title + '\n' + '─'.repeat(50) + '\n';
  txt += '试剂'.padEnd(35) + '用量'.padStart(10) + '  单位\n';
  txt += '─'.repeat(50) + '\n';
  data.forEach(row => {
    const val = row.unit === 'µL' ? row.vol.toFixed(1) : row.vol.toFixed(3);
    txt += row.name.padEnd(35) + val.padStart(10) + '  ' + row.unit + '\n';
  });
  const total = data.reduce((s, r) => s + (r.unit === 'µL' ? r.vol / 1000 : r.vol), 0);
  txt += '─'.repeat(50) + '\n';
  txt += 'Total'.padEnd(35) + total.toFixed(2).padStart(10) + '  mL\n';
  return txt;
}

// DownloadBtn — small secondary download button (props kept for callers: onClick, label, small).
function DownloadBtn({ onClick, label, small = false }) {
  return (
    <button type="button" onClick={onClick} className={small ? 'btn btn-sm' : 'btn'}>
      <IconDownload size={small ? 14 : 16} />
      {label}
    </button>
  );
}

// Keep units lower-case inside the uppercase eyebrow/label styles ("mL", not "ML").
function withUnit(text) {
  const m = /^(.*?)\s*([(（][^)）]+[)）])\s*$/.exec(text);
  return m ? <>{m[1]} <span className="nocase" style={{ letterSpacing: 0 }}>{m[2]}</span></> : text;
}

const NUM = { textAlign: 'right' };
const fmtVol = (v) => String(parseFloat(v.toFixed(3)));

function GelTable({ title, meta, data, color, lang }) {
  const total = data.reduce((sum, r) => sum + (r.unit === 'µL' ? r.vol / 1000 : r.vol), 0);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5 mb-1">
        <h4 className="eyebrow inline-flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
          <span className="dot" style={{ color }} aria-hidden="true" />{title}
        </h4>
        {meta && <span className="mono tabular" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{meta}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>{t('reagent', lang)}</th>
              <th style={NUM}>{t('amount', lang)}</th>
              <th>{t('unit', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{row.name}</td>
                <td className="tabular" style={{ ...NUM, fontWeight: 700, fontSize: '0.875rem' }}>
                  {row.unit === 'µL' ? row.vol.toFixed(1) : row.vol.toFixed(3)}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{row.unit}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 700, borderBottom: 0 }}>{t('gelTotal', lang)}</td>
              <td className="tabular" style={{ ...NUM, fontWeight: 700, fontSize: '0.875rem', borderBottom: 0 }}>{total.toFixed(2)}</td>
              <td style={{ color: 'var(--text-muted)', borderBottom: 0 }}>mL</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const RES_COLOR = 'var(--primary)';
const STACK_COLOR = 'var(--base-c)';

export default function GelTab() {
  const [resPerc, setResPerc] = useState(10);
  const [resVol, setResVol] = useState('');
  const [stackPerc, setStackPerc] = useState(4);
  const [stackVol, setStackVol] = useState('');
  const [numGels, setNumGels] = useState('');

  const rv = +resVol || 10;
  const sv = +stackVol || 5;
  const ng = +numGels || 2;
  const resGel = calcGel(resPerc, rv * ng, 'resolving');
  const stackGel = calcGel(stackPerc, sv * ng, 'stacking');

  const percOptions = [6, 7.5, 8, 10, 12, 15];

  // MW range guide
  const mwGuide = [
    { perc: '6%', range: '60–200 kDa' },
    { perc: '7.5%', range: '40–150 kDa' },
    { perc: '8%', range: '35–120 kDa' },
    { perc: '10%', range: '20–80 kDa' },
    { perc: '12%', range: '15–60 kDa' },
    { perc: '15%', range: '10–40 kDa' },
  ];

  const lang = useLang();
  const zh = lang === 'zh';

  function download() {
    let txt = 'SDS-PAGE Gel Recipe\n' + '═'.repeat(50) + '\n';
    txt += `Gels: ${ng}\n\n`;
    txt += gelToText(`Resolving Gel (${resPerc}%, ${rv*ng} mL)`, resGel);
    txt += '\n';
    txt += gelToText(`Stacking Gel (${stackPerc}%, ${sv*ng} mL)`, stackGel);
    txt += '\nRef: Laemmli (1970) Nature 227:680; Bio-Rad Mini-PROTEAN Manual\n';
    downloadFile(`SDS-PAGE_${resPerc}pct_x${ng}.txt`, txt);
  }

  const legendStyle = { color: 'var(--text)', marginBottom: '0.5rem' };
  const volLabel = (key) => withUnit(t(key, lang));

  return (
    <div className="@container">
      <div className="doc-section-head">
        <h3 className="eyebrow" style={{ color: 'var(--text)' }}>{zh ? '配胶计算器' : 'Gel calculator'}</h3>
        <DownloadBtn small label={t('downloadGel', lang)} onClick={download} />
      </div>

      {/* Inputs: one group per gel layer, then the number of gels */}
      <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
        <fieldset className="min-w-0">
          <legend className="eyebrow" style={legendStyle}>
            <span className="dot" style={{ color: RES_COLOR, marginRight: '0.4rem' }} aria-hidden="true" />{t('gelResolving', lang)}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label htmlFor="gel-res-pct">{t('gelConc', lang)}</label>
              <select id="gel-res-pct" value={resPerc} onChange={e => setResPerc(+e.target.value)} className="w-full">
                {percOptions.map(p => <option key={p} value={p}>{p}%</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="gel-res-vol">{volLabel('gelResolvingVol')}</label>
              <input id="gel-res-vol" type="number" value={resVol} min={1} step={0.5} placeholder="10"
                onChange={e => setResVol(e.target.value)} className="w-full" style={{ minWidth: 0 }} />
            </div>
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="eyebrow" style={legendStyle}>
            <span className="dot" style={{ color: STACK_COLOR, marginRight: '0.4rem' }} aria-hidden="true" />{t('gelStacking', lang)}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label htmlFor="gel-stack-pct">{t('gelConc', lang)}</label>
              <select id="gel-stack-pct" value={stackPerc} onChange={e => setStackPerc(+e.target.value)} className="w-full">
                <option value={4}>4%</option>
                <option value={5}>5%</option>
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="gel-stack-vol">{volLabel('gelStackingVol')}</label>
              <input id="gel-stack-vol" type="number" value={stackVol} min={1} step={0.5} placeholder="5"
                onChange={e => setStackVol(e.target.value)} className="w-full" style={{ minWidth: 0 }} />
            </div>
          </div>
        </fieldset>
        <div className="min-w-0 max-w-[calc(50%-0.25rem)] @xl:max-w-none @xl:self-end">
          <label htmlFor="gel-count">{t('gelCount', lang)}</label>
          <input id="gel-count" type="number" value={numGels} min={1} max={20} placeholder="2"
            onChange={e => setNumGels(e.target.value)} className="w-full" style={{ minWidth: 0 }} />
        </div>
      </div>

      {/* Results */}
      <div className="grid gap-6 @2xl:grid-cols-2 mt-6">
        <GelTable title={t('gelResolving', lang)} meta={`${resPerc}% · ${fmtVol(rv)} mL × ${ng} = ${fmtVol(rv * ng)} mL`}
          data={resGel} color={RES_COLOR} lang={lang} />
        <GelTable title={t('gelStacking', lang)} meta={`${stackPerc}% · ${fmtVol(sv)} mL × ${ng} = ${fmtVol(sv * ng)} mL`}
          data={stackGel} color={STACK_COLOR} lang={lang} />
      </div>

      {/* Reference: separation range + safety */}
      <div className="grid gap-6 @xl:grid-cols-2 mt-6">
        <div className="min-w-0">
          <h4 className="eyebrow mb-1" style={{ color: 'var(--text)' }}>{t('mwRange', lang)}</h4>
          <table className="w-full">
            <thead>
              <tr>
                <th>{t('gelConc', lang)}</th>
                <th>{withUnit(t('bestRange', lang))}</th>
              </tr>
            </thead>
            <tbody>
              {mwGuide.map(g => {
                const current = g.perc === resPerc + '%';
                return (
                  <tr key={g.perc} style={current ? { background: 'var(--primary-light)', boxShadow: 'inset 3px 0 0 var(--primary)' } : undefined}>
                    <td className="mono" style={{ fontWeight: 700 }}>{g.perc}</td>
                    <td style={{ color: current ? 'var(--text)' : 'var(--text-muted)' }}>
                      {g.range}
                      {current && <span className="badge badge-green ml-2" style={{ fontFamily: 'var(--font-mono)' }}>{zh ? '当前' : 'current'}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mono mt-2" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Ref: Gallagher (2012) Curr Protoc Mol Biol</p>
        </div>

        <div className="min-w-0">
          <h4 className="eyebrow mb-2" style={{ color: 'var(--text)' }}>{t('gelSafetyTitle', lang)}</h4>
          <div className="notice notice-warn mb-3">
            <IconAlert size={15} style={{ color: 'var(--warning-text)', flexShrink: 0, marginTop: 2 }} />
            <p><span className="notice-title">30% Acrylamide</span> — {t('gelSafety1', lang)}</p>
          </div>
          <ul className="space-y-1.5" style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
            {[
              <><strong>APS</strong> — {t('gelSafety2', lang)}</>,
              <><strong>TEMED</strong> — {t('gelSafety3', lang)}</>,
              t('gelSafety4', lang),
              t('gelSafety5', lang),
              'Mini-gel: resolving ~5–8 mL, stacking ~2–3 mL; RT polymerization ~30–45 min',
            ].map((item, i) => (
              <li key={i} className="flex gap-2.5" style={{ lineHeight: 1.5 }}>
                <span aria-hidden="true" className="shrink-0" style={{ width: 5, height: 5, marginTop: '0.55em', background: 'var(--text-muted)' }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mono mt-3" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Ref: Laemmli (1970) Nature 227:680; Bio-Rad Mini-PROTEAN Manual</p>
        </div>
      </div>
    </div>
  );
}

export { GelTable, DownloadBtn, gelToText };
