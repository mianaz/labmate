// Plate tab — the web's PlateTab.jsx: layout designer (select wells, label and
// colour them, templates, table view, export) and plate-reader import.
//
// The plate is rendered from `rows[r].w[c]` view models; taps update single
// paths (rows[2].w[5].sel) instead of re-sending the whole plate. The layout
// itself (wellData / groups) lives on the instance and in storage.
const pageBehavior = require('../../behaviors/page');
const storage = require('../../lib/storage');
const ui = require('../../lib/ui');
const { tf } = require('../../shared/i18n.js');
const { plateToCSV, plateToSVG } = require('../../shared/plateExport.js');
const P = require('../../components/plate/util');

const { PLATE_CONFIGS, PLATE_SIZES, WELL_COLORS, ROW_LABELS, STORE_KEY } = P;

// Space for the grid: window − page gutters (2×16) − panel frame (2) − plate padding (2×6).
function plateWidth() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return (info.windowWidth || 375) - 46;
  } catch (err) {
    return 329;
  }
}

function isCancel(err) {
  return /cancel/i.test(String((err && (err.errMsg || err.message)) || ''));
}

Component({
  behaviors: [pageBehavior],
  data: {
    tabIndex: 3,
    titleKey: 'tabPlate',
    mode: 'designer', // designer | reader
    view: 'grid',     // grid | table
    plateType: 96,
    plateIdx: PLATE_SIZES.indexOf(96),
    plateOptions: [],
    rowCount: 8,
    colCount: 12,
    m: {},
    zoom: false,
    scrolled: false,
    rows: [],
    colHeads: [],
    selCount: 0,
    selPreview: '',
    selLabelled: false,
    label: '',
    swatches: WELL_COLORS,
    colorIdx: 0,
    useCustom: false,
    customColor: '#ff0000',
    customHex: 'FF0000',
    activeHex: WELL_COLORS[0].toUpperCase(),
    groups: [],
    labelled: 0,
    layout: {},
  },
  lifetimes: {
    attached() {
      this.setData({ plateOptions: this.plateOptions() });
      this.restore();
    },
  },
  methods: {
    onShareAppMessage() {
      return { title: this.data.lang === 'zh' ? 'LabMate 多孔板设计' : 'LabMate plate designer', path: '/pages/plate/index' };
    },

    // A restored backup may have replaced the saved layout while we were away.
    onPageShow() {
      if (JSON.stringify(storage.get(STORE_KEY, null)) !== this._savedRaw) this.restore();
    },

    onLangChange() { this.setData({ plateOptions: this.plateOptions() }); },

    plateOptions() {
      return PLATE_SIZES.map((n) => ({ n, label: tf('plateTypeOption', this.data.lang, { n }) }));
    },

    // ── State ────────────────────────────────────────────────────────────────
    restore() {
      const raw = storage.get(STORE_KEY, null);
      const s = P.loadState(raw);
      this._savedRaw = JSON.stringify(raw);
      this._wellData = s.wellData;
      this._groups = s.groups;
      this._sel = new Set();
      this._anchor = null;
      const cfg = PLATE_CONFIGS[s.plateType];
      this.setData({
        plateType: s.plateType,
        plateIdx: PLATE_SIZES.indexOf(s.plateType),
        rowCount: cfg.rows,
        colCount: cfg.cols,
        colorIdx: s.colorIdx,
        useCustom: s.useCustom,
        customColor: s.customColor,
        customHex: s.customColor.slice(1).toUpperCase(),
        zoom: false,
        scrolled: false,
      });
      this.rebuild();
    },

    persist() {
      const state = {
        plateType: this.data.plateType,
        wellData: this._wellData,
        groups: this._groups,
        colorIdx: this.data.colorIdx,
        useCustom: this.data.useCustom,
        customColor: this.data.customColor,
      };
      storage.set(STORE_KEY, state);
      this._savedRaw = JSON.stringify(state);
    },

    activeColor(d) {
      const s = Object.assign({}, this.data, d || {});
      return s.useCustom ? s.customColor : WELL_COLORS[s.colorIdx % WELL_COLORS.length];
    },

    selData() {
      const keys = Array.from(this._sel);
      return {
        selCount: keys.length,
        selPreview: keys.slice(0, 12).join(' ') + (keys.length > 12 ? ' +' + (keys.length - 12) : ''),
        selLabelled: keys.some((k) => !!this._wellData[k]),
      };
    },

    layoutData() {
      return {
        groups: this._groups.map((g, i) => ({ id: i, label: g.label, color: P.safeColor(g.color), n: g.wells.length })),
        labelled: Object.keys(this._wellData).length,
        layout: this._wellData,
      };
    },

    // Full redraw: plate type, zoom, template, restore.
    rebuild() {
      const type = this.data.plateType;
      const cfg = PLATE_CONFIGS[type];
      const m = P.plateMetrics(plateWidth(), type, this.data.zoom);
      const rows = [];
      for (let r = 0; r < cfg.rows; r++) {
        const w = [];
        for (let c = 0; c < cfg.cols; c++) {
          const key = P.wellKey(r, c);
          w.push(P.wellView(key, this._wellData[key], this._sel.has(key)));
        }
        rows.push({ l: ROW_LABELS[r], w });
      }
      const colHeads = [];
      for (let c = 1; c <= cfg.cols; c++) colHeads.push(c);
      this.setData(Object.assign({ m, rows, colHeads, activeHex: this.activeColor().toUpperCase() }, this.layoutData(), this.selData()));
    },

    // Targeted redraw of some wells (selection and/or content changed).
    redrawWells(keys, extra) {
      const patch = Object.assign({}, extra || {});
      keys.forEach((key) => {
        const pos = P.parseKey(key);
        if (!pos) return;
        patch['rows[' + pos.r + '].w[' + pos.c + ']'] = P.wellView(key, this._wellData[key], this._sel.has(key));
      });
      this.setData(Object.assign(patch, this.selData()));
    },

    setSelection(keys, on) {
      const changed = [];
      keys.forEach((key) => {
        if (this._sel.has(key) === on) return;
        if (on) this._sel.add(key); else this._sel.delete(key);
        changed.push(key);
      });
      const patch = this.selData();
      changed.forEach((key) => {
        const pos = P.parseKey(key);
        patch['rows[' + pos.r + '].w[' + pos.c + '].sel'] = on;
      });
      this.setData(patch);
    },

    // ── Header controls ─────────────────────────────────────────────────────
    setMode(e) {
      const mode = e.currentTarget.dataset.mode;
      if (mode !== this.data.mode) this.setData({ mode });
    },

    async onPlateType(e) {
      const idx = Number(e.detail.value);
      const type = PLATE_SIZES[idx];
      if (!type || type === this.data.plateType) return;
      if (this.data.labelled > 0) {
        const ok = await ui.confirm(this.t('plateTypeConfirm'), { danger: true });
        if (!ok) { this.setData({ plateIdx: this.data.plateIdx }); return; }
      }
      const cfg = PLATE_CONFIGS[type];
      this._wellData = {};
      this._groups = [];
      this._sel = new Set();
      this._anchor = null;
      this.setData({ plateType: type, plateIdx: idx, rowCount: cfg.rows, colCount: cfg.cols, zoom: false, scrolled: false });
      this.persist();
      this.rebuild();
    },

    setView(e) {
      const view = e.currentTarget.dataset.view;
      if (view !== this.data.view) this.setData({ view });
    },

    // Wells are sized through CSS variables, so zooming only re-sends the metrics.
    toggleZoom() {
      const zoom = !this.data.zoom;
      this.setData({ zoom, scrolled: false, m: P.plateMetrics(plateWidth(), this.data.plateType, zoom) });
    },

    onPlateScroll() {
      if (!this.data.scrolled) this.setData({ scrolled: true });
    },

    // ── Selection ───────────────────────────────────────────────────────────
    tapWell(e) {
      const r = Number(e.currentTarget.dataset.r);
      const c = Number(e.currentTarget.dataset.c);
      const key = P.wellKey(r, c);
      const on = !this._sel.has(key);
      this._anchor = on ? { r, c } : null;
      this.setSelection([key], on);
    },

    // Long-press: select the block between the last tapped well and this one.
    pressWell(e) {
      const r = Number(e.currentTarget.dataset.r);
      const c = Number(e.currentTarget.dataset.c);
      const a = this._anchor;
      const keys = [];
      if (a) {
        for (let rr = Math.min(a.r, r); rr <= Math.max(a.r, r); rr++) {
          for (let cc = Math.min(a.c, c); cc <= Math.max(a.c, c); cc++) keys.push(P.wellKey(rr, cc));
        }
      } else {
        keys.push(P.wellKey(r, c));
      }
      this._anchor = { r, c };
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      this.setSelection(keys, true);
    },

    // Row letter / column number: take the whole line (or drop it if it was all selected).
    selectLine(keys) {
      this._anchor = null;
      this.setSelection(keys, !keys.every((k) => this._sel.has(k)));
    },
    selectRow(e) {
      const r = Number(e.currentTarget.dataset.r);
      const keys = [];
      for (let c = 0; c < this.data.colCount; c++) keys.push(P.wellKey(r, c));
      this.selectLine(keys);
    },
    selectCol(e) {
      const c = Number(e.currentTarget.dataset.c);
      const keys = [];
      for (let r = 0; r < this.data.rowCount; r++) keys.push(P.wellKey(r, c));
      this.selectLine(keys);
    },
    toggleAll() {
      const keys = [];
      for (let r = 0; r < this.data.rowCount; r++) {
        for (let c = 0; c < this.data.colCount; c++) keys.push(P.wellKey(r, c));
      }
      this.selectLine(keys);
    },

    selectGroup(e) {
      const g = this._groups[Number(e.currentTarget.dataset.i)];
      if (!g) return;
      this.setSelection(Array.from(this._sel).filter((k) => g.wells.indexOf(k) < 0), false);
      this.setSelection(g.wells, true);
      this._anchor = null;
    },

    deselect() {
      this._anchor = null;
      this.setSelection(Array.from(this._sel), false);
    },

    // ── Label / colour ──────────────────────────────────────────────────────
    onLabel(e) { this.setData({ label: e.detail.value }); },

    pickColor(e) {
      const colorIdx = Number(e.currentTarget.dataset.i);
      this.setData({ colorIdx, useCustom: false, activeHex: this.activeColor({ colorIdx, useCustom: false }).toUpperCase() });
      this.persist();
    },

    pickCustom() {
      this.setData({ useCustom: true, activeHex: this.data.customColor.toUpperCase() });
      this.persist();
    },

    onCustomHex(e) {
      const hex = String(e.detail.value || '').replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase();
      const patch = { customHex: hex };
      if (hex.length === 6) {
        patch.customColor = '#' + hex.toLowerCase();
        patch.useCustom = true;
        patch.activeHex = '#' + hex;
      }
      this.setData(patch);
      if (hex.length === 6) this.persist();
      return hex;
    },

    // ── Assign / clear ──────────────────────────────────────────────────────
    assign() {
      const label = this.data.label.trim();
      if (this._sel.size === 0 || !label) return;
      const color = this.activeColor();
      const sel = this._sel;
      const keys = Array.from(sel);
      keys.forEach((key) => { this._wellData[key] = { color, label }; });
      // Relabelled wells leave their previous group; groups emptied that way drop out.
      const rest = this._groups
        .map((g) => (g.label === label ? g : Object.assign({}, g, { wells: g.wells.filter((w) => !sel.has(w)) })))
        .filter((g) => g.wells.length > 0);
      const idx = rest.findIndex((g) => g.label === label);
      if (idx === -1) rest.push({ label, color, wells: keys });
      else rest[idx] = Object.assign({}, rest[idx], { wells: rest[idx].wells.concat(keys.filter((k) => rest[idx].wells.indexOf(k) < 0)) });
      this._groups = rest;
      this._sel = new Set();
      this._anchor = null;
      const colorIdx = this.data.useCustom ? this.data.colorIdx : (this.data.colorIdx + 1) % WELL_COLORS.length;
      this.setData({ colorIdx, label: '', activeHex: this.activeColor({ colorIdx }).toUpperCase() });
      this.persist();
      this.redrawWells(keys, this.layoutData());
    },

    clearSelected() {
      const sel = this._sel;
      const keys = Array.from(sel);
      if (!keys.length) return;
      keys.forEach((key) => { delete this._wellData[key]; });
      this._groups = this._groups
        .map((g) => Object.assign({}, g, { wells: g.wells.filter((w) => !sel.has(w)) }))
        .filter((g) => g.wells.length > 0);
      this._sel = new Set();
      this._anchor = null;
      this.persist();
      this.redrawWells(keys, this.layoutData());
    },

    async clearAll() {
      if (this.data.labelled > 0 && !(await ui.confirm(this.t('plateClearConfirm'), { danger: true }))) return;
      this._wellData = {};
      this._groups = [];
      this._sel = new Set();
      this._anchor = null;
      this.setData({ colorIdx: 0, activeHex: this.activeColor({ colorIdx: 0 }).toUpperCase() });
      this.persist();
      this.rebuild();
    },

    applyTemplate(e) {
      const { type, params } = e.detail;
      const res = P.applyTemplate(type, params || {}, PLATE_CONFIGS[this.data.plateType], this.data.lang);
      if (!res) return;
      this._wellData = res.wellData;
      this._groups = res.groups;
      this._sel = new Set();
      this._anchor = null;
      this.persist();
      this.rebuild();
    },

    // ── Export ──────────────────────────────────────────────────────────────
    sendFile(name, content) {
      return ui.shareTextFile(name, content).catch((err) => {
        if (isCancel(err)) return;
        ui.copy(content, this.t('plateCopiedInstead'));
      });
    },
    exportCSV() {
      const type = this.data.plateType;
      return this.sendFile('plate_' + type + 'well.csv', plateToCSV(this._wellData, PLATE_CONFIGS[type]));
    },
    exportSVG() {
      const type = this.data.plateType;
      return this.sendFile('plate_' + type + 'well.svg', plateToSVG(this._wellData, PLATE_CONFIGS[type], this._groups));
    },
    copyLayout() {
      return ui.copy(P.layoutText(this.data.plateType, this._groups));
    },
  },
});
