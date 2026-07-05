// PlateReaderImport — paste/upload plate-reader CSV, auto-detect plate format,
// pivot to long format, optionally merge sample labels from the designer.
import { useState, useMemo, useRef } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED, S_PRIMARY } from '../../lib/styleConstants.js';
import { useToast } from '../../components/Toast.jsx';
import { ROW_LABELS } from '../../data/plateConfigs.js';
import { downloadFile } from '../../lib/utils.js';
import {
  parsePlateReaderCSV,
  toLongFormat,
  longFormatToCSV,
  summarizeBySample,
} from './plateReaderParser.js';

const SAMPLE_TSV = '\t1\t2\t3\t4\t5\t6\t7\t8\t9\t10\t11\t12\n' +
  'A\t0.123\t0.234\t0.345\t0.456\t0.567\t0.678\t0.789\t0.890\t0.987\t0.876\t0.765\t0.654\n' +
  'B\t0.124\t0.235\t0.346\t0.457\t0.568\t0.679\t0.790\t0.891\t0.988\t0.877\t0.766\t0.655\n' +
  'C\t0.125\t0.236\t0.347\t0.458\t0.569\t0.680\t0.791\t0.892\t0.989\t0.878\t0.767\t0.656\n' +
  'D\t0.126\t0.237\t0.348\t0.459\t0.570\t0.681\t0.792\t0.893\t0.990\t0.879\t0.768\t0.657\n' +
  'E\t0.127\t0.238\t0.349\t0.460\t0.571\t0.682\t0.793\t0.894\t0.991\t0.880\t0.769\t0.658\n' +
  'F\t0.128\t0.239\t0.350\t0.461\t0.572\t0.683\t0.794\t0.895\t0.992\t0.881\t0.770\t0.659\n' +
  'G\t0.129\t0.240\t0.351\t0.462\t0.573\t0.684\t0.795\t0.896\t0.993\t0.882\t0.771\t0.660\n' +
  'H\t0.130\t0.241\t0.352\t0.463\t0.574\t0.685\t0.796\t0.897\t0.994\t0.883\t0.772\t0.661\n';

function Heatmap({ parsed, wellData }) {
  const values = Object.values(parsed.values);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  const cellSize = parsed.cols > 16 ? 14 : parsed.cols > 12 ? 18 : 26;
  const fontSize = cellSize > 20 ? 9 : 7;

  return (
    <div className="overflow-x-auto">
      <div style={{ display: 'inline-block' }}>
        <div className="flex gap-0.5 mb-1 ml-6">
          {Array.from({ length: parsed.cols }, (_, c) => (
            <div key={c} className="text-center mono"
              style={{ width: cellSize, fontSize: 9, color: 'var(--text-muted)' }}>{c + 1}</div>
          ))}
        </div>
        {Array.from({ length: parsed.rows }, (_, r) => (
          <div key={r} className="flex gap-0.5 mb-0.5 items-center">
            <div className="mono text-right pr-1.5"
              style={{ width: 18, fontSize: 9, color: 'var(--text-muted)' }}>{ROW_LABELS[r]}</div>
            {Array.from({ length: parsed.cols }, (_, c) => {
              const key = ROW_LABELS[r] + (c + 1);
              const v = parsed.values[key];
              const layout = wellData ? wellData[key] : null;
              const intensity = v != null ? (v - min) / range : null;
              // Teal-family gradient: low = light/pale, high = primary
              const bg = intensity == null
                ? 'transparent'
                : `hsl(170, 50%, ${95 - intensity * 55}%)`;
              const title = key + (v != null ? `: ${v.toFixed(3)}` : ' (no value)') +
                (layout ? ` — ${layout.label}` : '');
              return (
                <div key={c}
                  title={title}
                  style={{
                    width: cellSize, height: cellSize,
                    background: bg,
                    border: layout
                      ? `2px solid ${layout.color}`
                      : '1px solid var(--border)',
                    borderRadius: '50%',
                    fontSize,
                    color: intensity != null && intensity > 0.55 ? 'white' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                  }}>
                  {cellSize >= 20 && v != null ? v.toFixed(v >= 100 ? 0 : 2).slice(0, 4) : ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlateReaderImport({ wellData, plateConfig, designerPlateSize }) {
  const lang = useLang();
  const toast = useToast();
  const [text, setText] = useState('');
  const [merge, setMerge] = useState(true);
  const fileRef = useRef(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    return parsePlateReaderCSV(text);
  }, [text]);

  const longFormat = useMemo(() => {
    if (!parsed || parsed.error) return [];
    return toLongFormat(parsed, merge ? wellData : null);
  }, [parsed, merge, wellData]);

  const summary = useMemo(() => {
    if (!longFormat.length) return [];
    return summarizeBySample(longFormat);
  }, [longFormat]);

  // True only if the user has actually labelled some wells in the designer
  const layoutAvailable = wellData && Object.keys(wellData).length > 0;
  const layoutMismatch = layoutAvailable && parsed && !parsed.error &&
    designerPlateSize && designerPlateSize !== parsed.plateSize;

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(String(ev.target.result || ''));
    reader.readAsText(f);
    e.target.value = '';
  }

  function downloadCSV() {
    if (!longFormat.length) return;
    const csv = longFormatToCSV(longFormat, { includeSample: merge && layoutAvailable });
    downloadFile(`plate_${parsed.plateSize}well_long.csv`, csv, 'text/csv');
    toast.show(t('downloaded', lang));
  }

  function copyCSV() {
    if (!longFormat.length) return;
    navigator.clipboard.writeText(longFormatToCSV(longFormat, { includeSample: merge && layoutAvailable }));
    toast.show(t('copied', lang));
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold">{t('readerInputTitle', lang)}</h3>
            <p className="text-xs mt-0.5" style={S_MUTED}>{t('readerInputDesc', lang)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt"
              onChange={handleFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current && fileRef.current.click()}
              className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
              {t('readerLoadFile', lang)}
            </button>
            <button onClick={() => setText(SAMPLE_TSV)}
              className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
              {t('readerLoadDemo', lang)}
            </button>
            {text && (
              <button onClick={() => setText('')}
                className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
                {t('readerClear', lang)}
              </button>
            )}
          </div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={t('readerPaste', lang)}
          rows={text ? 5 : 7} spellCheck={false}
          style={{
            width: '100%', fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem', lineHeight: 1.4,
          }} />
        <p className="text-[11px] mt-2" style={S_MUTED}>{t('readerSupportedFormats', lang)}</p>
      </div>

      {parsed && parsed.error && (
        <div className="card p-4 text-sm" style={{
          borderLeft: '3px solid var(--danger-border)',
          background: 'var(--bg-2)',
        }}>
          <p style={{ color: 'var(--danger-text)' }}>
            <strong>{t('readerErr', lang)}:</strong>{' '}
            {t('readerErr_' + parsed.error, lang) || t('readerErrUnknown', lang)}
          </p>
        </div>
      )}

      {parsed && !parsed.error && (
        <>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-bold">
                {t('readerDetected', lang)}:{' '}
                <span style={S_PRIMARY}>{parsed.plateSize}-well</span>
                <span className="font-normal text-xs ml-2" style={S_MUTED}>
                  · {parsed.parsed} {t('readerParsedValues', lang)}
                  {parsed.unparsed > 0 && (
                    <span> · {parsed.unparsed} {t('readerSkipped', lang)}</span>
                  )}
                </span>
              </h3>
              {layoutAvailable && !layoutMismatch && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={merge} onChange={e => setMerge(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }} />
                  {t('readerMergeLabels', lang)}
                </label>
              )}
            </div>
            {layoutMismatch && (
              <p className="text-[11px] mb-3 p-2 rounded" style={{
                background: 'var(--warning-bg)',
                color: 'var(--warning-text)',
                border: '1px solid var(--warning-border)',
              }}>
                {t('readerLayoutMismatch', lang)
                  .replace('{designer}', String(designerPlateSize))
                  .replace('{parsed}', String(parsed.plateSize))}
              </p>
            )}
            <Heatmap parsed={parsed} wellData={merge && layoutAvailable ? wellData : null} />
          </div>

          {summary.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-bold mb-3">{t('readerSummary', lang)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-1.5 pr-3 font-semibold">{t('readerSample', lang)}</th>
                      <th className="text-right py-1.5 px-2 font-semibold mono">n</th>
                      <th className="text-right py-1.5 px-2 font-semibold mono">{t('readerMean', lang)}</th>
                      <th className="text-right py-1.5 px-2 font-semibold mono">{t('readerSD', lang)}</th>
                      <th className="text-right py-1.5 px-2 font-semibold mono">{t('readerCV', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map(s => (
                      <tr key={s.sample} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-1.5 pr-3 flex items-center gap-2">
                          {s.color && <span style={{
                            display: 'inline-block', width: 10, height: 10,
                            borderRadius: '50%', background: s.color, flexShrink: 0,
                          }} />}
                          <span className="font-medium">{s.sample}</span>
                        </td>
                        <td className="py-1.5 px-2 mono text-right" style={S_MUTED}>{s.n}</td>
                        <td className="py-1.5 px-2 mono text-right" style={S_PRIMARY}>{s.mean.toFixed(3)}</td>
                        <td className="py-1.5 px-2 mono text-right" style={S_MUTED}>{s.sd.toFixed(3)}</td>
                        <td className="py-1.5 px-2 mono text-right" style={S_MUTED}>
                          {s.mean !== 0 ? ((s.sd / s.mean) * 100).toFixed(1) + '%' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-bold">
                {t('readerLongFormat', lang)}
                <span className="font-normal text-xs ml-2" style={S_MUTED}>
                  ({longFormat.length} {t('readerRows', lang)})
                </span>
              </h3>
              <div className="flex gap-2">
                <button onClick={copyCSV}
                  className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
                  {t('copyClipboard', lang)}
                </button>
                <button onClick={downloadCSV}
                  className="btn-primary" style={{ fontSize: '0.75rem', padding: '5px 12px' }}>
                  {t('readerDownloadCSV', lang)}
                </button>
              </div>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table className="w-full text-xs">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card)' }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-1.5 pr-3 font-semibold">{t('readerWell', lang)}</th>
                    <th className="text-right py-1.5 px-2 font-semibold mono">{t('readerValue', lang)}</th>
                    {merge && layoutAvailable && (
                      <th className="text-left py-1.5 pl-3 font-semibold">{t('readerSample', lang)}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {longFormat.slice(0, 60).map(r => (
                    <tr key={r.well} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-1 pr-3 mono font-medium">{r.well}</td>
                      <td className="py-1 px-2 mono text-right" style={S_PRIMARY}>{r.value.toFixed(3)}</td>
                      {merge && layoutAvailable && (
                        <td className="py-1 pl-3"
                          style={{ color: r.sample ? 'var(--text)' : 'var(--text-muted)' }}>
                          {r.sample || '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {longFormat.length > 60 && (
                <p className="text-xs mt-2 text-center" style={S_MUTED}>
                  … {longFormat.length - 60} {t('readerMoreRows', lang)}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
