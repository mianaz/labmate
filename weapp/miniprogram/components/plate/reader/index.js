// Plate-reader import (the web's PlateReaderImport.jsx): paste or pick a
// CSV/TSV/TXT from a chat, auto-detect the plate, show a heatmap, the tidy
// long-format table and per-sample stats, and export the tidy CSV.
//   01 input → 02 detected plate (heatmap) → 03 tidy data
const langBehavior = require('../../../behaviors/lang');
const ui = require('../../../lib/ui');
const i18n = require('../../../shared/i18n.js');
const {
  parsePlateReaderCSV, toLongFormat, longFormatToCSV, summarizeBySample,
} = require('../../../shared/plateReaderParser.js');
const { ROW_LABELS, safeColor } = require('../util');

const SAMPLE_TSV = '\t1\t2\t3\t4\t5\t6\t7\t8\t9\t10\t11\t12\n' +
  'A\t0.123\t0.234\t0.345\t0.456\t0.567\t0.678\t0.789\t0.890\t0.987\t0.876\t0.765\t0.654\n' +
  'B\t0.124\t0.235\t0.346\t0.457\t0.568\t0.679\t0.790\t0.891\t0.988\t0.877\t0.766\t0.655\n' +
  'C\t0.125\t0.236\t0.347\t0.458\t0.569\t0.680\t0.791\t0.892\t0.989\t0.878\t0.767\t0.656\n' +
  'D\t0.126\t0.237\t0.348\t0.459\t0.570\t0.681\t0.792\t0.893\t0.990\t0.879\t0.768\t0.657\n' +
  'E\t0.127\t0.238\t0.349\t0.460\t0.571\t0.682\t0.793\t0.894\t0.991\t0.880\t0.769\t0.658\n' +
  'F\t0.128\t0.239\t0.350\t0.461\t0.572\t0.683\t0.794\t0.895\t0.992\t0.881\t0.770\t0.659\n' +
  'G\t0.129\t0.240\t0.351\t0.462\t0.573\t0.684\t0.795\t0.896\t0.993\t0.882\t0.771\t0.660\n' +
  'H\t0.130\t0.241\t0.352\t0.463\t0.574\t0.685\t0.796\t0.897\t0.994\t0.883\t0.772\t0.661\n';

// Past this the textarea only shows the start (setData is capped at 1 MB).
const VIEW_LIMIT = 20000;
const TIDY_ROWS = 60;
const CELL_MAX = { 6: 96, 12: 80, 24: 64, 48: 54, 96: 48, 384: 26 };
const CELL_MIN = { 6: 40, 12: 34, 24: 28, 48: 22, 96: 18, 384: 12 };
const HEAD = 20;
const SCALE_STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1];

function formatCell(v, wide) {
  const a = Math.abs(v);
  if (a >= 1e5) return Math.round(v / 1e3) + 'k';
  if (a >= 1e4) return (v / 1e3).toFixed(wide ? 1 : 0) + 'k';
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(wide ? 3 : 2);
}
function fmtScale(v) { return Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(3); }
// Sequential ramp: signal green over the panel surface (the web's color-mix).
// --pr-heat holds the theme's primary as "r, g, b".
function heatFill(x) { return 'rgba(var(--pr-heat), ' + (0.06 + x * 0.94).toFixed(3) + ')'; }

function contentWidth() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return (info.windowWidth || 375) - 32 - 2 - 28; // page gutters, panel frame, panel-body padding
  } catch (err) {
    return 313;
  }
}

function buildHeatmap(parsed, layout) {
  const keys = Object.keys(parsed.values);
  const values = keys.map((k) => parsed.values[k]);
  let min = values.length ? Infinity : 0;
  let max = values.length ? -Infinity : 1;
  values.forEach((v) => { if (v < min) min = v; if (v > max) max = v; });
  const range = max - min || 1;
  const pitch = Math.max(0, contentWidth() - HEAD) / parsed.cols;
  const gap = Math.round(Math.min(8, Math.max(2, pitch * 0.1)));
  const cell = Math.min(CELL_MAX[parsed.plateSize] || 48, Math.max(CELL_MIN[parsed.plateSize] || 14, Math.floor(pitch - gap)));
  const wide = cell >= 40;
  const rows = [];
  for (let r = 0; r < parsed.rows; r++) {
    const row = { l: ROW_LABELS[r], c: [] };
    for (let c = 0; c < parsed.cols; c++) {
      const k = ROW_LABELS[r] + (c + 1);
      const v = parsed.values[k];
      const ring = layout && layout[k] ? safeColor(layout[k].color) : '';
      const x = v != null ? (v - min) / range : null;
      let st = x == null ? '' : 'background:' + heatFill(x) + ';';
      if (ring) st += 'border:2px solid ' + ring + ';';
      row.c.push({
        k,
        cls: (x == null ? 'is-empty' : x > 0.55 ? 'is-hot' : '') + (ring ? ' has-ring' : ''),
        st,
        txt: cell >= 30 && v != null ? formatCell(v, wide) : '',
      });
    }
    rows.push(row);
  }
  const cols = [];
  for (let c = 1; c <= parsed.cols; c++) cols.push(c);
  return {
    hm: { rows, cols, cell, gap, fs: wide ? 10 : 9, w: HEAD + parsed.cols * (cell + gap) },
    scale: {
      min: fmtScale(min),
      max: fmtScale(max),
      steps: SCALE_STEPS.map((x) => ({ id: x, st: 'background:' + heatFill(x) })),
    },
  };
}

function isCancel(err) {
  return /cancel/i.test(String((err && (err.errMsg || err.message)) || ''));
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    layout: { type: Object, value: {} },        // designer wellData
    designerSize: { type: Number, value: 96 },  // designer plate size
  },
  data: {
    text: '',
    bigFile: false,
    fileName: '',
    merge: true,
    state: 'empty', // empty | error | ok
    errText: '',
    detected: '',
    parsedCount: 0,
    skipped: 0,
    layoutAvailable: false,
    mismatch: false,
    mismatchText: '',
    mergeActive: false,
    hm: null,
    scale: null,
    tidy: [],
    longCount: 0,
    more: 0,
    tidyH: 0,
    summary: [],
    summaryHint: '',
  },
  observers: {
    'layout, designerSize'() { if (this._parsed) this.derive(); },
  },
  lifetimes: {
    attached() { this._text = ''; this._parsed = null; this._long = []; },
    detached() { clearTimeout(this._timer); },
  },
  methods: {
    onLangChange() { if (this._parsed) this.derive(); },

    setText(text, fileName) {
      const s = String(text || '');
      this._text = s;
      const big = s.length > VIEW_LIMIT;
      this.setData({ text: big ? s.slice(0, VIEW_LIMIT) + '\n…' : s, bigFile: big, fileName: fileName || '' });
      this.parse();
    },

    onInput(e) {
      if (this.data.bigFile) return;
      this._text = e.detail.value;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.parse(), 250);
    },

    loadDemo() { this.setText(SAMPLE_TSV, ''); },
    clear() { this.setText('', ''); },

    loadFile() {
      return ui.pickTextFile(['csv', 'tsv', 'txt'])
        .then((file) => this.setText(file.content, file.name))
        .catch((err) => { if (!isCancel(err)) ui.toast(this.t('readerFileFailed')); });
    },

    toggleMerge() {
      this.setData({ merge: !this.data.merge });
      this.derive();
    },

    parse() {
      this._parsed = this._text.trim() ? parsePlateReaderCSV(this._text) : null;
      this.derive();
    },

    derive() {
      const parsed = this._parsed;
      const lang = this.data.lang;
      const layout = this.data.layout || {};
      const layoutAvailable = Object.keys(layout).length > 0;
      const ok = !!parsed && !parsed.error;
      const mismatch = !!(layoutAvailable && ok && this.data.designerSize && this.data.designerSize !== parsed.plateSize);
      const mergeActive = !!(this.data.merge && layoutAvailable && !mismatch);
      const long = ok ? toLongFormat(parsed, mergeActive ? layout : null) : [];
      const summary = long.length ? summarizeBySample(long) : [];
      this._long = long;
      this._mergeActive = mergeActive;

      const next = {
        state: !parsed ? 'empty' : parsed.error ? 'error' : 'ok',
        layoutAvailable, mismatch, mergeActive,
        hm: null, scale: null, tidy: [], summary: [], longCount: long.length, more: 0, tidyH: 0,
      };
      if (parsed && parsed.error) {
        const key = 'readerErr_' + parsed.error;
        next.errText = i18n.has(key) ? i18n.t(key, lang) : i18n.t('readerErrUnknown', lang);
      }
      if (ok) {
        Object.assign(next, buildHeatmap(parsed, mergeActive ? layout : null));
        next.detected = lang === 'zh' ? parsed.plateSize + ' 孔板' : parsed.plateSize + '-well';
        next.parsedCount = parsed.parsed;
        next.skipped = parsed.unparsed;
        next.mismatchText = mismatch
          ? i18n.tf('readerLayoutMismatch', lang, { designer: this.data.designerSize, parsed: parsed.plateSize })
          : '';
        next.tidy = long.slice(0, TIDY_ROWS).map((r) => ({ well: r.well, value: r.value.toFixed(3), sample: r.sample }));
        next.more = Math.max(0, long.length - TIDY_ROWS);
        next.tidyH = Math.min(340, 34 * (next.tidy.length + 1) + (next.more ? 36 : 0));
        next.summary = summary.map((s) => ({
          sample: s.sample,
          color: s.color ? safeColor(s.color) : '',
          n: s.n,
          mean: s.mean.toFixed(3),
          sd: s.sd.toFixed(3),
          cv: s.mean !== 0 ? ((s.sd / s.mean) * 100).toFixed(1) + '%' : '—',
        }));
        next.summaryHint = i18n.t(!layoutAvailable ? 'readerHintNoLayout'
          : mismatch ? 'readerHintMismatch'
            : !this.data.merge ? 'readerHintMergeOff' : 'readerHintNoValues', lang);
      }
      this.setData(next);
    },

    tidyCSV() {
      return longFormatToCSV(this._long, { includeSample: this._mergeActive });
    },

    copyCSV() {
      if (!this._long.length) return undefined;
      return ui.copy(this.tidyCSV());
    },

    sendCSV() {
      if (!this._long.length || !this._parsed) return undefined;
      const csv = this.tidyCSV();
      return ui.shareTextFile('plate_' + this._parsed.plateSize + 'well_long.csv', csv).catch((err) => {
        if (isCancel(err)) return;
        ui.copy(csv, this.t('plateCopiedInstead'));
      });
    },
  },
});
