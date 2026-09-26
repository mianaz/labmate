// PlateReaderImport — paste/upload plate-reader CSV, auto-detect plate format,
// pivot to long format, optionally merge sample labels from the designer.
// Laid out as three steps: 01 input → 02 detected plate (heatmap) → 03 tidy data.
import { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED } from '../../lib/styleConstants.js';
import { useToast } from '../../components/Toast.jsx';
import { ROW_LABELS } from '../../data/plateConfigs.js';
import { downloadFile } from '../../lib/utils.js';
import { IconUpload, IconDownload, IconCopy, IconClose, IconAlert, IconCheck, IconInfo, IconPlate } from '../../components/icons.jsx';
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

// Width of an element, kept current with a ResizeObserver.
function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const RO = window.ResizeObserver;
    if (!RO) {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new RO(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Sequential ramp: one hue (signal green) mixed into the panel surface —
// light → dark on paper, and (anchor flipped) dark → bright on the dark theme.
const heatFill = (i) => `color-mix(in oklab, var(--primary) ${Math.round(6 + i * 94)}%, var(--card))`;
// --on-primary is dark ink in both themes; above ~55% green it out-contrasts --text.
const heatInk = (i) => (i > 0.55 ? 'var(--on-primary)' : 'var(--text)');

function formatCell(v, wide) {
  const a = Math.abs(v);
  if (a >= 1e5) return `${Math.round(v / 1e3)}k`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(wide ? 1 : 0)}k`;
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(wide ? 3 : 2);
}
const fmtScale = (v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(3));

// Cell diameter bounds per plate size (px): grows with the panel, then scrolls.
const CELL_MAX = { 6: 96, 12: 80, 24: 64, 48: 54, 96: 48, 384: 26 };
const CELL_MIN = { 6: 40, 12: 34, 24: 28, 48: 22, 96: 18, 384: 12 };

function Heatmap({ parsed, wellData, lang }) {
  const [ref, width] = useElementWidth();
  const values = Object.values(parsed.values);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  const head = 20;
  const pitch = Math.max(0, width - head) / parsed.cols;
  const gap = Math.round(Math.min(8, Math.max(2, pitch * 0.1)));
  const cell = Math.min(CELL_MAX[parsed.plateSize] || 48, Math.max(CELL_MIN[parsed.plateSize] || 14, Math.floor(pitch - gap)));
  const wide = cell >= 40;
  const axis = { fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div>
      <div ref={ref} className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
        <div className="mono" style={{
          display: 'grid',
          gridTemplateColumns: `${head}px repeat(${parsed.cols}, ${cell}px)`,
          gridTemplateRows: `18px repeat(${parsed.rows}, ${cell}px)`,
          gap,
          width: 'max-content',
          margin: '0 auto',
        }}>
          <span aria-hidden="true" />
          {Array.from({ length: parsed.cols }, (_, c) => (
            <span key={`c${c}`} style={axis}>{c + 1}</span>
          ))}
          {Array.from({ length: parsed.rows }, (_, r) => [
            <span key={`r${r}`} style={axis}>{ROW_LABELS[r]}</span>,
            ...Array.from({ length: parsed.cols }, (_, c) => {
              const key = ROW_LABELS[r] + (c + 1);
              const v = parsed.values[key];
              const layout = wellData ? wellData[key] : null;
              const intensity = v != null ? (v - min) / range : null;
              const title = key + (v != null ? `: ${v.toFixed(3)}` : ' (no value)') +
                (layout ? ` — ${layout.label}` : '');
              return (
                <div key={key} title={title}
                  style={{
                    width: cell, height: cell,
                    background: intensity == null ? 'var(--bg-2)' : heatFill(intensity),
                    border: layout
                      ? `2px solid ${layout.color}`
                      : intensity == null ? '1px dashed var(--border)' : '1px solid var(--border)',
                    borderRadius: '50%',
                    fontSize: wide ? 10 : 9,
                    color: intensity == null ? 'var(--text-muted)' : heatInk(intensity),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                  {cell >= 30 && v != null ? formatCell(v, wide) : ''}
                </div>
              );
            }),
          ])}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2" style={{ marginTop: '0.875rem' }}>
        <div className="flex items-center gap-2 mono tabular text-[11px]" style={S_MUTED}
          aria-label={`${lang === 'zh' ? '色阶' : 'Scale'}: ${fmtScale(min)} – ${fmtScale(max)}`}>
          <span>{fmtScale(min)}</span>
          <span className="flex" aria-hidden="true" style={{ border: '1px solid var(--border)' }}>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map(i => (
              <span key={i} style={{ width: 16, height: 10, background: heatFill(i) }} />
            ))}
          </span>
          <span>{fmtScale(max)}</span>
        </div>
        {wellData && (
          <span className="text-[11px]" style={S_MUTED}>
            {lang === 'zh' ? '外圈颜色 = 设计器中的样品标签' : 'Ring colour = sample label from the designer'}
          </span>
        )}
      </div>
    </div>
  );
}

// Step marker: "01" in a small ink-framed box; filled green once the step is done.
function StepNo({ n, done }) {
  return (
    <span aria-hidden="true" className="mono" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 22, height: 18, padding: '0 4px', fontSize: 10, fontWeight: 700, letterSpacing: 0,
      border: '1px solid var(--border-strong)',
      background: done ? 'var(--primary)' : 'transparent',
      color: done ? 'var(--on-primary)' : 'var(--text)',
    }}>
      {String(n).padStart(2, '0')}
    </span>
  );
}

// Inline checkbox label: the global <label> style is mono/uppercase with
// !important, so the body-font override has to live on an inner span.
const CHECK_TEXT = { textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-body)', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' };

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

  // True only if the user has actually labelled some wells in the designer
  const layoutAvailable = wellData && Object.keys(wellData).length > 0;
  const layoutMismatch = layoutAvailable && parsed && !parsed.error &&
    designerPlateSize && designerPlateSize !== parsed.plateSize;
  // Labels are merged only when the plate sizes agree — the mismatch notice
  // below tells the user they can't be (and hides the merge toggle).
  const mergeActive = !!(merge && layoutAvailable && !layoutMismatch);

  const longFormat = useMemo(() => {
    if (!parsed || parsed.error) return [];
    return toLongFormat(parsed, mergeActive ? wellData : null);
  }, [parsed, mergeActive, wellData]);

  const summary = useMemo(() => {
    if (!longFormat.length) return [];
    return summarizeBySample(longFormat);
  }, [longFormat]);

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
    const csv = longFormatToCSV(longFormat, { includeSample: mergeActive });
    downloadFile(`plate_${parsed.plateSize}well_long.csv`, csv, 'text/csv');
    toast.show(t('downloaded', lang));
  }

  function copyCSV() {
    if (!longFormat.length) return;
    navigator.clipboard.writeText(longFormatToCSV(longFormat, { includeSample: mergeActive }));
    toast.show(t('copied', lang));
  }

  const ok = !!parsed && !parsed.error;
  const showSample = mergeActive;
  const zh = lang === 'zh';
  const summaryHint = !layoutAvailable
    ? (zh ? '先在「布板设计」中标记孔位——样品标签会合并到这里，并按样品汇总 n、均值、标准差和变异系数。'
      : 'Label wells in the Designer first — sample labels are merged here and summarised per sample as n, mean, SD and CV%.')
    : layoutMismatch
      ? (zh ? '孔板尺寸不一致，无法按样品汇总。' : 'The plate sizes differ, so there is nothing to summarise by sample.')
      : !merge
        ? (zh ? '勾选「合并设计器中的样品标签」即可按样品汇总。' : 'Turn on “Merge sample labels from designer” to summarise by sample.')
        : (zh ? '已标记的孔位在这组数据中没有数值。' : 'None of the labelled wells have values in this data.');

  return (
    <div className="space-y-4 fade-in">
      <div className="grid grid-cols-1 gap-4 xl:gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 01 — input */}
        <section className="panel flex flex-col" aria-labelledby="reader-step-input">
          <div className="panel-head">
            <h2 id="reader-step-input" className="panel-title flex items-center gap-2">
              <StepNo n={1} done={ok} />{t('readerInputTitle', lang)}
            </h2>
          </div>
          <div className="panel-body flex flex-col gap-3 flex-1">
            <p className="text-[13px]" style={{ ...S_MUTED, lineHeight: 1.5 }}>{t('readerInputDesc', lang)}</p>
            <div className="toolbar">
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt"
                onChange={handleFile} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileRef.current && fileRef.current.click()} className="btn btn-sm">
                <IconUpload size={14} />{t('readerLoadFile', lang)}
              </button>
              <button type="button" onClick={() => setText(SAMPLE_TSV)} className="btn btn-sm">
                {t('readerLoadDemo', lang)}
              </button>
              {text && (
                <button type="button" onClick={() => setText('')} className="btn-ghost btn-sm">
                  <IconClose size={14} />{t('readerClear', lang)}
                </button>
              )}
            </div>
            <textarea value={text} onChange={e => setText(e.target.value)}
              aria-label={t('readerInputTitle', lang)}
              placeholder={t('readerPaste', lang)}
              rows={9} spellCheck={false} wrap={text ? 'off' : 'soft'}
              className="w-full flex-1"
              style={{ fontSize: '0.78rem', lineHeight: 1.45, minHeight: '11rem', resize: 'vertical' }} />
            <p className="text-[11px]" style={S_MUTED}>{t('readerSupportedFormats', lang)}</p>
          </div>
        </section>

        {/* 02 — detected plate */}
        <section className="panel flex flex-col" aria-labelledby="reader-step-grid">
          <div className="panel-head flex-wrap">
            <h2 id="reader-step-grid" className="panel-title flex items-center gap-2">
              <StepNo n={2} done={ok} />{lang === 'zh' ? '识别结果' : 'Detected plate'}
            </h2>
            {ok && layoutAvailable && !layoutMismatch && (
              <label className="flex items-center gap-2 cursor-pointer" style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={merge} onChange={e => setMerge(e.target.checked)} />
                <span style={CHECK_TEXT}>{t('readerMergeLabels', lang)}</span>
              </label>
            )}
          </div>
          <div className="panel-body flex flex-col gap-3 flex-1">
            {!parsed && (
              <div className="empty flex-1">
                <div className="empty-icon"><IconPlate size={22} /></div>
                <p className="empty-title">{lang === 'zh' ? '暂无数据' : 'No data yet'}</p>
                <p className="empty-desc">
                  {lang === 'zh'
                    ? '粘贴数据或选择文件后，这里会显示识别出的孔板热图，下方生成长格式（tidy）数据表。'
                    : 'Paste values or load a file — the detected plate appears here as a heatmap, with a tidy long-format table below.'}
                </p>
              </div>
            )}

            {parsed && parsed.error && (
              <div className="notice notice-danger" role="alert">
                <IconAlert size={16} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 1 }} />
                <p>
                  <span className="notice-title">{t('readerErr', lang)}:</span>{' '}
                  {t('readerErr_' + parsed.error, lang) || t('readerErrUnknown', lang)}
                </p>
              </div>
            )}

            {ok && (
              <div className="notice notice-info" role="status">
                <IconCheck size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                <p>
                  <span className="notice-title">{t('readerDetected', lang)}: {lang === 'zh' ? `${parsed.plateSize} 孔板` : `${parsed.plateSize}-well`}</span>
                  <span className="mono tabular text-xs" style={S_MUTED}>
                    {' '}· {parsed.parsed} {t('readerParsedValues', lang)}
                    {parsed.unparsed > 0 && <span> · {parsed.unparsed} {t('readerSkipped', lang)}</span>}
                  </span>
                </p>
              </div>
            )}

            {layoutMismatch && (
              <div className="notice notice-warn">
                <IconAlert size={16} style={{ color: 'var(--warning-text)', flexShrink: 0, marginTop: 1 }} />
                <p>
                  {t('readerLayoutMismatch', lang)
                    .replace('{designer}', String(designerPlateSize))
                    .replace('{parsed}', String(parsed.plateSize))}
                </p>
              </div>
            )}

            {ok && <Heatmap parsed={parsed} wellData={showSample ? wellData : null} lang={lang} />}
          </div>
        </section>
      </div>

      {/* 03 — tidy data */}
      {ok && (
        <section className="panel" aria-labelledby="reader-step-tidy">
          <div className="panel-head flex-wrap">
            <h2 id="reader-step-tidy" className="panel-title flex items-center gap-2">
              <StepNo n={3} done={longFormat.length > 0} />{t('readerLongFormat', lang)}
              <span className="mono tabular" style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>
                · {longFormat.length} {t('readerRows', lang)}
              </span>
            </h2>
            <div className="toolbar">
              <button type="button" onClick={copyCSV} className="btn btn-sm">
                <IconCopy size={14} />{t('copyClipboard', lang)}
              </button>
              <button type="button" onClick={downloadCSV} className="btn-primary btn-sm">
                <IconDownload size={14} />{t('readerDownloadCSV', lang)}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* ≥lg the table scrolls inside the full row height (so it lines up with a
                long summary); below that it's a 340px scroll box. */}
            <div className="relative lg:min-h-[360px]">
              <div className="overflow-auto max-h-[340px] lg:max-h-none lg:absolute lg:inset-0">
                <table className="w-full">
                  <thead className="sticky top-0" style={{ background: 'var(--card)', zIndex: 1 }}>
                    <tr>
                      <th style={{ boxShadow: 'inset 0 -1px 0 var(--border-strong)' }}>{t('readerWell', lang)}</th>
                      <th className="text-right" style={{ boxShadow: 'inset 0 -1px 0 var(--border-strong)' }}>{t('readerValue', lang)}</th>
                      {showSample && (
                        <th style={{ boxShadow: 'inset 0 -1px 0 var(--border-strong)' }}>{t('readerSample', lang)}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {longFormat.slice(0, 60).map(r => (
                      <tr key={r.well}>
                        <td className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{r.well}</td>
                        <td className="text-right tabular">{r.value.toFixed(3)}</td>
                        {showSample && (
                          <td style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: r.sample ? 'var(--text)' : 'var(--text-muted)' }}>
                            {r.sample || '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {longFormat.length > 60 && (
                  <p className="mono text-[11px] text-center py-2.5" style={{ ...S_MUTED, borderTop: '1px solid var(--rule)' }}>
                    … {longFormat.length - 60} {t('readerMoreRows', lang)}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t lg:border-t-0 lg:border-l border-[var(--rule)] min-w-0">
              <div className="flex items-center px-3 lg:px-4" style={{ minHeight: '2.5rem', borderBottom: summary.length ? 0 : '1px solid var(--rule)' }}>
                <h3 className="eyebrow">{t('readerSummary', lang)}</h3>
              </div>
              {summary.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>{t('readerSample', lang)}</th>
                        <th className="text-right">n</th>
                        <th className="text-right">{t('readerMean', lang)}</th>
                        <th className="text-right">{t('readerSD', lang)}</th>
                        <th className="text-right">{t('readerCV', lang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(s => (
                        <tr key={s.sample}>
                          <td>
                            <span className="inline-flex items-center gap-2">
                              {s.color && <span className="rounded-full flex-shrink-0" style={{ width: 10, height: 10, background: s.color }} />}
                              <span className="font-medium">{s.sample}</span>
                            </span>
                          </td>
                          <td className="text-right tabular" style={S_MUTED}>{s.n}</td>
                          <td className="text-right tabular" style={{ fontWeight: 700 }}>{s.mean.toFixed(3)}</td>
                          <td className="text-right tabular" style={S_MUTED}>{s.sd.toFixed(3)}</td>
                          <td className="text-right tabular" style={S_MUTED}>
                            {s.mean !== 0 ? ((s.sd / s.mean) * 100).toFixed(1) + '%' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 lg:p-4">
                  <div className="notice">
                    <IconInfo size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
                    <p style={S_MUTED}>{summaryHint}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
