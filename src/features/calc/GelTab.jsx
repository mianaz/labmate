import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { calcGel } from '../../lib/calculators.js';
import { S_MUTED, S_BORDER } from '../../lib/styleConstants.js';
import { downloadFile } from '../../lib/utils.js';

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

// DownloadBtn — small inline download button
function DownloadBtn({ onClick, label, icon = '', small = false }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all hover:shadow-md ${
        small ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
      }`}
      style={{ background: 'var(--btn-download)', color: 'white' }}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
        <path d="M6 1v7M3 6l3 3 3-3"/><line x1="1" y1="11" x2="11" y2="11"/>
      </svg>
      {label}
    </button>
  );
}

function GelTable({ title, data, color, lang }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold mb-3" style={{color}}>{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2" style={S_BORDER}>
              <th className="text-left py-2">{t('reagent', lang)}</th>
              <th className="text-right py-2">{t('amount', lang)}</th>
              <th className="text-right py-2">{t('unit', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b" style={{borderColor:'var(--border)'}}>
                <td className="py-2 font-medium">{row.name}</td>
                <td className="py-2 text-right mono font-semibold" style={{color}}>
                  {row.unit === 'µL' ? row.vol.toFixed(1) : row.vol.toFixed(3)}
                </td>
                <td className="py-2 text-right text-gray-500 mono">{row.unit}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-bold" style={{borderColor: color}}>
              <td className="py-2">{t('gelTotal', lang)}</td>
              <td className="py-2 text-right mono" style={{color}}>
                {data.reduce((sum, r) => sum + (r.unit === 'µL' ? r.vol/1000 : r.vol), 0).toFixed(2)}
              </td>
              <td className="py-2 text-right text-gray-500 mono">mL</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

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

  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] font-semibold block mb-1" style={S_MUTED}>{t('gelResolvingPct', lang)}</label>
            <select value={resPerc} onChange={e => setResPerc(+e.target.value)} style={{width:'100%'}}>
              {percOptions.map(p => <option key={p} value={p}>{p}%</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold block mb-1" style={S_MUTED}>{t('gelResolvingVol', lang)}</label>
            <input type="number" value={resVol} min={1} step={0.5} placeholder="10"
              onChange={e => setResVol(e.target.value)} style={{width:'100%', minWidth:0}} />
          </div>
          <div>
            <label className="text-[10px] font-semibold block mb-1" style={S_MUTED}>{t('gelStackingPct', lang)}</label>
            <select value={stackPerc} onChange={e => setStackPerc(+e.target.value)} style={{width:'100%'}}>
              <option value={4}>4%</option>
              <option value={5}>5%</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold block mb-1" style={S_MUTED}>{t('gelStackingVol', lang)}</label>
            <input type="number" value={stackVol} min={1} step={0.5} placeholder="5"
              onChange={e => setStackVol(e.target.value)} style={{width:'100%', minWidth:0}} />
          </div>
          <div>
            <label className="text-[10px] font-semibold block mb-1" style={S_MUTED}>{t('gelCount', lang)}</label>
            <input type="number" value={numGels} min={1} max={20} placeholder="2"
              onChange={e => setNumGels(e.target.value)} style={{width:'100%', minWidth:0}} />
          </div>
        </div>
      </div>

      <div className="flex justify-end mb-3">
        <DownloadBtn small label={t('downloadGel', lang)} onClick={() => {
          let txt = 'SDS-PAGE Gel Recipe\n' + '═'.repeat(50) + '\n';
          txt += `Gels: ${ng}\n\n`;
          txt += gelToText(`Resolving Gel (${resPerc}%, ${rv*ng} mL)`, resGel);
          txt += '\n';
          txt += gelToText(`Stacking Gel (${stackPerc}%, ${sv*ng} mL)`, stackGel);
          txt += '\nRef: Laemmli (1970) Nature 227:680; Bio-Rad Mini-PROTEAN Manual\n';
          downloadFile(`SDS-PAGE_${resPerc}pct_x${ng}.txt`, txt);
        }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <GelTable title={`${t('gelResolving', lang)} (${resPerc}%, ${rv*ng} mL × ${ng})`} data={resGel} color="var(--primary)" lang={lang} />
        <GelTable title={`${t('gelStacking', lang)} (${stackPerc}%, ${sv*ng} mL × ${ng})`} data={stackGel} color="var(--accent)" lang={lang} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-3">{t('mwRange', lang)}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={S_BORDER}>
                <th className="text-left py-1.5 text-xs" style={S_MUTED}>{t('gelConc', lang)}</th>
                <th className="text-left py-1.5 text-xs" style={S_MUTED}>{t('bestRange', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {mwGuide.map(g => (
                <tr key={g.perc} className="border-b"
                  style={{borderColor:'var(--border)', background: g.perc === resPerc+'%' ? 'var(--primary-light)' : 'transparent'}}>
                  <td className="py-1.5 mono font-semibold">{g.perc}</td>
                  <td className="py-1.5" style={S_MUTED}>{g.range}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] mt-2 italic" style={S_MUTED}>Ref: Gallagher (2012) Curr Protoc Mol Biol</p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold mb-3">{t('gelSafetyTitle', lang)}</h3>
          <ul className="text-xs space-y-2" style={S_MUTED}>
            <li>• <strong>30% Acrylamide</strong> — <span style={{color:'var(--accent)', fontWeight:'bold'}}>{t('gelSafety1', lang)}</span></li>
            <li>• <strong>APS</strong> — {t('gelSafety2', lang)}</li>
            <li>• <strong>TEMED</strong> — {t('gelSafety3', lang)}</li>
            <li>• {t('gelSafety4', lang)}</li>
            <li>• {t('gelSafety5', lang)}</li>
            <li>• Mini-gel: resolving ~5–8 mL, stacking ~2–3 mL; RT polymerization ~30–45 min</li>
          </ul>
          <p className="text-[11px] mt-3 italic" style={S_MUTED}>Ref: Laemmli (1970) Nature 227:680; Bio-Rad Mini-PROTEAN Manual</p>
        </div>
      </div>
    </div>
  );
}

export { GelTable, DownloadBtn, gelToText };
