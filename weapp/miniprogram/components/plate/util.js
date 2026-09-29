// Plate designer logic shared by pages/plate and components/plate/* — the pure
// parts of the web's PlateTab.jsx (well keys, sizing, templates, layout text)
// plus the saved-state format.
const { PLATE_CONFIGS, WELL_COLORS, ROW_LABELS } = require('../../shared/data.js');
const { t } = require('../../shared/i18n.js');

// The web keeps the layout in component state only; the mini program keeps it
// under a labmate_* key so it survives restarts and travels in backups.
const STORE_KEY = 'labmate_plate';

const PLATE_SIZES = Object.keys(PLATE_CONFIGS).map(Number).sort((a, b) => a - b);

function wellKey(r, c) { return ROW_LABELS[r] + (c + 1); }

function parseKey(key) {
  const r = ROW_LABELS.indexOf(String(key).charAt(0));
  const c = parseInt(String(key).slice(1), 10) - 1;
  return r >= 0 && c >= 0 ? { r, c } : null;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Well diameter bounds (px), as in the web, but with a larger floor for 384
// wells so they stay tappable — that plate scrolls sideways instead.
const WELL_MAX = { 6: 132, 12: 108, 24: 84, 48: 68, 96: 60, 384: 32 };
const WELL_MIN = { 6: 44, 12: 36, 24: 30, 48: 24, 96: 20, 384: 16 };
// "Enlarge" (the web's enlarged overlay on phones) zooms the inline grid instead.
const ZOOM_WS = { 48: 44, 96: 40, 384: 30 };
const HEAD = 18; // row-label column width

function plateMetrics(width, plateType, zoom) {
  const cfg = PLATE_CONFIGS[plateType];
  const pitch = Math.max(0, width - HEAD) / cfg.cols;
  let gap = clamp(Math.floor(pitch * 0.1), 2, 12);
  let ws = clamp(Math.floor(pitch - gap), WELL_MIN[plateType] || 14, WELL_MAX[plateType] || 60);
  const zoomWs = ZOOM_WS[plateType] || 0;
  const canZoom = zoomWs > ws;
  if (zoom && canZoom) { ws = zoomWs; gap = 4; }
  const gridW = HEAD + cfg.cols * (ws + gap);
  return {
    ws, gap, head: HEAD,
    fs: clamp(Math.round(ws * 0.2), 7, 13),
    axisFs: ws >= 40 ? 11 : 10,
    showText: ws >= 22,
    showId: ws >= 44,
    big: ws >= 30,
    gridW,
    scroll: gridW > width + 1,
    canZoom,
  };
}

// Colours end up inside a style attribute: accept only plain CSS colour tokens.
function safeColor(color) {
  const s = String(color || '');
  return /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl)a?\([\d\s.,%]+\))$/i.test(s) ? s : WELL_COLORS[0];
}

// Per-well view model. Filled wells get the sample colour at 22% over the card
// (the web's color-mix) and a ring in the full colour.
function wellView(key, d, sel) {
  if (!d) return { k: key, has: false, st: '', lbl: '', sel: !!sel };
  const color = safeColor(d.color);
  const bg = /^#[0-9a-f]{6}$/i.test(color) ? color + '38' : 'var(--bg-2)';
  return {
    k: key,
    has: true,
    st: 'background:' + bg + ';border-color:' + color,
    lbl: d.label == null ? '' : String(d.label),
    sel: !!sel,
  };
}

function fmtConc(conc) { return conc >= 1 ? conc.toFixed(1) : conc.toExponential(1); }

function reps(p) { return Math.max(1, Math.min(4, +(p.replicates || 1))); }

const TEMPLATE_DEFAULTS = {
  serial: { startConc: '100', factor: '2', direction: 'row', replicates: '1' },
  checkerboard: { label1: 'Treatment', label2: 'Control', replicates: '1' },
  dose: { drugs: '3', startConc: '100', dilFactor: '3', replicates: '1' },
  control: {},
  antibody: { antibodies: '3', startConc: '100', dilFactor: '2' },
};

// Port of the web's apply* template functions. Returns { wellData, groups },
// or null when a required parameter is missing (the web then leaves the plate).
function applyTemplate(type, p, cfg, lang) {
  const wellData = {};
  const groups = [];
  const put = (key, color, label, wells) => { wellData[key] = { color, label }; if (wells) wells.push(key); };

  if (type === 'serial') {
    if (!p.startConc || !p.factor) return null;
    const n = reps(p);
    const f = +p.factor;
    let conc = +p.startConc;
    if (p.direction === 'row') {
      for (let c = 0; c < cfg.cols; c++) {
        const label = fmtConc(conc);
        const color = WELL_COLORS[c % WELL_COLORS.length];
        const wells = [];
        const rowsUsed = n === 1 ? cfg.rows : Math.min(n, cfg.rows);
        for (let r = 0; r < rowsUsed; r++) put(wellKey(r, c), color, label, wells);
        groups.push({ label, color, wells });
        conc /= f;
      }
    } else {
      for (let r = 0; r < cfg.rows; r++) {
        const label = fmtConc(conc);
        const color = WELL_COLORS[r % WELL_COLORS.length];
        const wells = [];
        const colCount = n === 1 ? cfg.cols : Math.min(n, cfg.cols);
        for (let c = 0; c < colCount; c++) put(wellKey(r, c), color, label, wells);
        groups.push({ label, color, wells });
        conc /= f;
      }
    }
  } else if (type === 'checkerboard') {
    if (!p.label1 || !p.label2) return null;
    const n = reps(p);
    const wells1 = [];
    const wells2 = [];
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        if ((Math.floor(r / n) + Math.floor(c / n)) % 2 === 0) put(wellKey(r, c), WELL_COLORS[0], p.label1, wells1);
        else put(wellKey(r, c), WELL_COLORS[1], p.label2, wells2);
      }
    }
    groups.push({ label: p.label1, color: WELL_COLORS[0], wells: wells1 });
    groups.push({ label: p.label2, color: WELL_COLORS[1], wells: wells2 });
  } else if (type === 'dose') {
    if (!p.drugs || !p.startConc || !p.dilFactor) return null;
    const n = reps(p);
    const nDrugs = Math.min(+p.drugs, Math.floor(cfg.rows / n));
    for (let d = 0; d < nDrugs; d++) {
      let conc = +p.startConc;
      const color = WELL_COLORS[d % WELL_COLORS.length];
      const wells = [];
      for (let c = 0; c < cfg.cols; c++) {
        const label = fmtConc(conc);
        for (let rep = 0; rep < n; rep++) {
          const r = d * n + rep;
          if (r >= cfg.rows) break;
          put(wellKey(r, c), color, label, wells);
        }
        conc /= +p.dilFactor;
      }
      groups.push({ label: 'Drug ' + (d + 1), color, wells });
    }
  } else if (type === 'control') {
    const pos = { label: t('platePosCtrl', lang), color: WELL_COLORS[2], wells: [] };
    const neg = { label: t('plateNegCtrl', lang), color: WELL_COLORS[1], wells: [] };
    const blank = { label: t('plateBlank', lang), color: WELL_COLORS[6], wells: [] };
    const lastCol = cfg.cols - 1;
    const midRow = Math.floor(cfg.rows / 2);
    for (let r = 0; r < cfg.rows; r++) {
      const g = r < midRow ? pos : neg;
      put(wellKey(r, lastCol), g.color, g.label, g.wells);
    }
    for (let r = 0; r < cfg.rows; r++) put(wellKey(r, 0), blank.color, blank.label, blank.wells);
    groups.push(pos, neg, blank);
  } else if (type === 'antibody') {
    const nAb = Math.min(+(p.antibodies || 3), cfg.rows);
    const start = +(p.startConc || 100);
    const dil = +(p.dilFactor || 2);
    for (let ab = 0; ab < nAb; ab++) {
      let conc = start;
      const color = WELL_COLORS[ab % WELL_COLORS.length];
      const wells = [];
      for (let c = 0; c < cfg.cols; c++) {
        put(wellKey(ab, c), color, fmtConc(conc), wells);
        conc /= dil;
      }
      groups.push({ label: 'Ab ' + (ab + 1), color, wells });
    }
  } else {
    return null;
  }
  return { wellData, groups };
}

// Plain-text layout for the clipboard (the web's copyLayout).
function layoutText(plateType, groups) {
  let txt = plateType + '-well Plate Layout\n' + '─'.repeat(40) + '\n';
  groups.forEach((g) => { txt += '■ ' + g.label + ': ' + g.wells.join(', ') + '\n'; });
  if (groups.length === 0) txt += '(empty)\n';
  return txt;
}

// Saved state → a clean in-memory state (tolerates hand-edited / older backups).
function loadState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const plateType = PLATE_CONFIGS[s.plateType] ? Number(s.plateType) : 96;
  const cfg = PLATE_CONFIGS[plateType];
  const wellData = {};
  if (s.wellData && typeof s.wellData === 'object') {
    Object.keys(s.wellData).forEach((key) => {
      const pos = parseKey(key);
      const d = s.wellData[key];
      if (!pos || pos.r >= cfg.rows || pos.c >= cfg.cols || !d || typeof d !== 'object') return;
      wellData[wellKey(pos.r, pos.c)] = { color: safeColor(d.color), label: d.label == null ? '' : String(d.label) };
    });
  }
  const groups = (Array.isArray(s.groups) ? s.groups : [])
    .filter((g) => g && Array.isArray(g.wells))
    .map((g) => ({
      label: g.label == null ? '' : String(g.label),
      color: safeColor(g.color),
      wells: g.wells.map(String).filter((w) => wellData[w]),
    }))
    .filter((g) => g.wells.length > 0);
  const hex = /^#[0-9a-f]{6}$/i.test(s.customColor) ? s.customColor : '#ff0000';
  return {
    plateType,
    wellData,
    groups,
    colorIdx: Number.isInteger(s.colorIdx) && s.colorIdx >= 0 ? s.colorIdx % WELL_COLORS.length : 0,
    useCustom: !!s.useCustom,
    customColor: hex,
  };
}

module.exports = {
  STORE_KEY, PLATE_SIZES, PLATE_CONFIGS, WELL_COLORS, ROW_LABELS, TEMPLATE_DEFAULTS,
  wellKey, parseKey, plateMetrics, safeColor, wellView, applyTemplate, layoutText, loadState,
};
