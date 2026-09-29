// Box position grid (the web's BoxGrid.jsx). Cells are sized to the available
// width (26–44px on a phone) and wider boxes scroll inside their own scroll-view.
// Occupied positions take the sample-type colours, the active sample is ringed in
// --primary, expired samples get a red corner. Select mode: tap toggles a cell,
// a row letter / column number toggles the whole line, long-press sets a range
// anchor and the next tap selects the rectangle between the two.
//
// Events: cell { pos, sampleId }, longcell { pos, sampleId }, line { positions }
const U = require('../../lib/utils');
const { t } = require('../../../../../shared/i18n.js');
const langBehavior = require('../../../../../behaviors/lang');

const LABEL = 18; // row-label column width / column-label row height
const GAP = 3;
const PAD = 4;

function windowWidth() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return info.windowWidth || 375;
  } catch (err) { return 375; }
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    box: { type: Object, value: null },
    samples: { type: Array, value: [] },
    selectMode: { type: Boolean, value: false },
    selected: { type: Array, value: [] },
    anchor: { type: String, value: '' },
    activePos: { type: String, value: '' },
    compact: { type: Boolean, value: false },
    minCell: { type: Number, value: 26 },
    maxCell: { type: Number, value: 44 },
    avail: { type: Number, value: 0 }, // px available; default: page width minus panel chrome
    hint: { type: String, value: '' },
  },
  data: {
    grid: [], colLabels: [], cell: 30, font: 9, gridWidth: 0,
    legend: [], emptyCount: 0, anyExpired: false,
  },
  observers: {
    'box, samples, selectMode, selected, anchor, activePos, avail, minCell, maxCell, lang': function () { this.build(); },
  },
  methods: {
    build() {
      const box = this.data.box;
      if (!box || !box.rows || !box.cols) { this.setData({ grid: [], colLabels: [] }); return; }
      const rows = box.rows;
      const cols = box.cols;
      const map = {};
      this._map = map;
      (this.data.samples || []).forEach((s) => { if (s.position) map[s.position] = s; });
      const avail = this.data.avail || (windowWidth() - 50);
      const fit = Math.floor((avail - 2 * PAD - LABEL - GAP * cols) / cols);
      const cell = Math.max(this.data.minCell, Math.min(this.data.maxCell, fit));
      const chars = cell >= 40 ? 5 : cell >= 32 ? 4 : cell >= 24 ? 3 : 0;
      const sel = {};
      (this.data.selectMode ? this.data.selected : []).forEach((p) => { sel[p] = true; });
      const now = Date.now();
      const anchor = this.data.selectMode ? this.data.anchor : '';
      const active = this.data.selectMode ? '' : this.data.activePos;
      const grid = [];
      for (let r = 0; r < rows; r++) {
        const cells = [];
        for (let c = 0; c < cols; c++) {
          const p = U.posLabel(r, c);
          const s = map[p];
          const du = s ? U.daysUntil(s.expiryDate, now) : null;
          cells.push({
            p,
            n: s && chars ? String(s.name || '').slice(0, chars) : '',
            t: s ? U.normalizeSampleType(s.sampleType) : '',
            x: du !== null && du < 0 ? 1 : 0,
            s: sel[p] ? 1 : 0,
            a: active === p ? 1 : 0,
            k: anchor === p ? 1 : 0,
          });
        }
        grid.push({ r, label: String.fromCharCode(65 + r), cells });
      }
      const colLabels = [];
      for (let c = 0; c < cols; c++) colLabels.push(c + 1);

      const update = {
        grid, colLabels, cell,
        font: cell >= 36 ? 10 : 9,
        gridWidth: 2 * PAD + LABEL + cols * (cell + GAP),
      };
      if (!this.data.compact) {
        const counts = {};
        const samples = this.data.samples || [];
        samples.forEach((s) => { const tp = U.normalizeSampleType(s.sampleType); counts[tp] = (counts[tp] || 0) + 1; });
        const lang = this.data.lang;
        update.legend = U.SAMPLE_TYPES.filter((tp) => counts[tp]).map((tp) => ({ type: tp, label: t(U.SAMPLE_TYPE_LABELS[tp], lang), n: counts[tp] }));
        const inGrid = Object.keys(map).filter((p) => { const q = U.parsePos(p); return q && q.r < rows && q.c < cols; }).length;
        update.emptyCount = rows * cols - inGrid;
        update.anyExpired = samples.some((s) => { const du = U.daysUntil(s.expiryDate, now); return du !== null && du < 0; });
      }
      this.setData(update);
    },

    sampleAt(pos) {
      const s = this._map && this._map[pos];
      return s ? s.id : null;
    },
    onTap(e) {
      const pos = e.currentTarget.dataset.pos;
      this.triggerEvent('cell', { pos, sampleId: this.sampleAt(pos) });
    },
    onLong(e) {
      const pos = e.currentTarget.dataset.pos;
      this.triggerEvent('longcell', { pos, sampleId: this.sampleAt(pos) });
    },
    onRow(e) {
      if (!this.data.selectMode) return;
      const r = Number(e.currentTarget.dataset.r);
      const positions = [];
      for (let c = 0; c < this.data.box.cols; c++) positions.push(U.posLabel(r, c));
      this.triggerEvent('line', { positions });
    },
    onCol(e) {
      if (!this.data.selectMode) return;
      const c = Number(e.currentTarget.dataset.c);
      const positions = [];
      for (let r = 0; r < this.data.box.rows; r++) positions.push(U.posLabel(r, c));
      this.triggerEvent('line', { positions });
    },
  },
});
