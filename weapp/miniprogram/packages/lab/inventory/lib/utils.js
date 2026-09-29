// Inventory — pure helpers, constants and CSV logic, ported from
// src/features/inventory/inventoryUtils.js (+ the small helpers that live in
// InventoryTab.jsx / BoxGrid.jsx / InventoryForms.jsx). No wx, no storage.
//
// Data shape (identical to the web app, stored under `labmate_inventory`):
//   { locations: [{ id, name, nameZh, type, temperature, parentId, order }],
//     boxes:     [{ id, name, nameZh, boxType, rows, cols, color, locationId }],
//     samples:   [{ id, boxId, position, name, nameZh?, sampleType, quantity, concentration,
//                   passage, dateStored (ms), expiryDate (ms | null), owner, tags: [],
//                   description, notes }],
//     nextId:    { locations, boxes, samples } }

const DAY = 86400000;

const SAMPLE_TYPES = ['cell_line', 'plasmid', 'antibody', 'primer', 'protein', 'reagent', 'tissue', 'virus', 'other'];

const SAMPLE_TYPE_LABELS = {
  cell_line: 'invSampleCellLine',
  plasmid: 'invSamplePlasmid',
  antibody: 'invSampleAntibody',
  primer: 'invSamplePrimer',
  protein: 'invSampleProtein',
  reagent: 'invSampleReagent',
  tissue: 'invSampleTissue',
  virus: 'invSampleVirus',
  other: 'invSampleOther',
};

const BOX_CONFIGS = [
  { type: 'cryo_81', rows: 9, cols: 9 },
  { type: 'cryo_100', rows: 10, cols: 10 },
  { type: 'tip', rows: 8, cols: 12 },
  { type: 'slide', rows: 1, cols: 25 },
  { type: 'tube', rows: 4, cols: 6 },
  { type: 'custom', rows: 8, cols: 8 },
];

const BOX_TYPE_LABELS = {
  cryo_81: 'invBoxCryo81',
  cryo_100: 'invBoxCryo100',
  tip: 'invBoxTip',
  slide: 'invBoxSlide',
  tube: 'invBoxTube',
  custom: 'invBoxCustom',
};

const STORAGE_TYPES = ['freezer', 'fridge', 'shelf', 'tank', 'rack'];

const STORAGE_TYPE_LABELS = {
  freezer: 'invTypeFreezer',
  fridge: 'invTypeFridge',
  shelf: 'invTypeShelf',
  tank: 'invTypeTank',
  rack: 'invTypeRack',
};

// LocationForm's temperature options (value, label).
const TEMPERATURES = [
  ['', '—'],
  ['RT', 'RT (Room Temp)'],
  ['4°C', '4°C'],
  ['-20°C', '-20°C'],
  ['-80°C', '-80°C'],
  ['-196°C (LN₂)', '-196°C (LN₂)'],
  ['37°C', '37°C'],
  ['4°F (freezer)', '4°F (freezer)'],
  ['-4°F', '-4°F'],
  ['-112°F', '-112°F'],
];

// BoxForm's preset colour labels ('' = none).
const BOX_COLORS = ['#16B364', '#0B6E63', '#1D5FD6', '#5B3FA8', '#9D174D', '#C42B1C', '#C2410C', '#7A5E00', '#57534A'];

const CSV_COLUMNS = 'Position, Name, Type, Quantity, Concentration, Passage, Date Stored, Expiry, Owner, Tags, Description, Notes';

// ── Pure helpers ───────────────────────────────────────────────────────────

function parseTags(str, sep) {
  return str ? String(str).split(sep || ',').map((s) => s.trim()).filter(Boolean) : [];
}

function normalizeSampleType(t) {
  return SAMPLE_TYPE_LABELS[t] ? t : 'other';
}

function typeLabelKey(t) {
  return SAMPLE_TYPE_LABELS[t] || SAMPLE_TYPE_LABELS.other;
}

// Fill in missing collections (the web's getInvData).
function normalize(raw) {
  const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (!Array.isArray(d.locations)) d.locations = [];
  if (!Array.isArray(d.boxes)) d.boxes = [];
  if (!Array.isArray(d.samples)) d.samples = [];
  if (!d.nextId || typeof d.nextId !== 'object') d.nextId = { locations: 1, boxes: 1, samples: 1 };
  // Guard against a nextId behind the data (hand-edited or merged files).
  ['locations', 'boxes', 'samples'].forEach((k) => {
    const max = d[k].reduce((m, x) => (x && typeof x.id === 'number' && x.id > m ? x.id : m), 0);
    if (!(d.nextId[k] > max)) d.nextId[k] = max + 1;
  });
  return d;
}

function nextInvId(data, type) {
  const id = data.nextId[type] || 1;
  data.nextId[type] = id + 1;
  return id;
}

function posLabel(row, col) {
  return String.fromCharCode(65 + row) + (col + 1);
}

// 'C7' → { r: 2, c: 6 }; null when it is not a grid position.
function parsePos(pos) {
  const m = /^([A-Z])(\d+)$/.exec(String(pos || '').trim().toUpperCase());
  return m ? { r: m[1].charCodeAt(0) - 65, c: parseInt(m[2], 10) - 1 } : null;
}

// Natural order: A2 before A10.
function comparePos(a, b) {
  const pa = parsePos(a);
  const pb = parsePos(b);
  if (pa && pb) return pa.r - pb.r || pa.c - pb.c;
  if (pa) return -1;
  if (pb) return 1;
  return String(a || '').localeCompare(String(b || ''));
}

function nameOf(o, lang) {
  if (!o) return '';
  return lang === 'zh' ? (o.nameZh || o.name || '') : (o.name || '');
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

// Timestamp → 'YYYY-MM-DD' as the web shows it (UTC, toISOString).
function isoDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' (also YYYY/M/D, optionally followed by a time) → UTC-midnight
// ms, like the web's new Date('YYYY-MM-DD').getTime(); other strings fall back
// to Date parsing. The time part is matched here because iOS can't parse
// "YYYY-MM-DD HH:mm" with new Date() (Android and browsers can).
function parseDate(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

// Local calendar date (for form defaults). Stored as UTC midnight of that date.
function todayInput(now) {
  const d = new Date(now || Date.now());
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function daysUntil(ts, now) {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  return Number.isNaN(ms) ? null : Math.ceil((ms - (now || Date.now())) / DAY);
}

function boxSamples(data, boxId) {
  return data.samples.filter((s) => s.boxId === boxId);
}

function freePositions(box, samples) {
  if (!box) return [];
  const taken = {};
  samples.forEach((s) => { if (s.position) taken[s.position] = true; });
  const out = [];
  for (let r = 0; r < box.rows; r++) {
    for (let c = 0; c < box.cols; c++) {
      const p = posLabel(r, c);
      if (!taken[p]) out.push(p);
    }
  }
  return out;
}

function findNextEmpty(box, samples) {
  const free = freePositions(box, samples);
  return free.length ? free[0] : null;
}

function samplesOutside(box, rows, cols, samples) {
  return samples.filter((s) => {
    const p = parsePos(s.position);
    return p && (p.r >= rows || p.c >= cols);
  }).length;
}

function matchesSearch(s, q) {
  if (!q) return true;
  const has = (v) => String(v || '').toLowerCase().indexOf(q) >= 0;
  return has(s.name) || has(s.nameZh) || has(s.owner) || has(s.description) ||
    (s.tags || []).some((tag) => has(tag));
}

// A file name that survives every file system.
function safeFileName(name) {
  return String(name || 'box').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'box';
}

// ── Statistics (InventoryTab's invStats + locationOccupancy) ───────────────

function computeStats(data, now) {
  const t0 = now || Date.now();
  const totalPositions = data.boxes.reduce((sum, b) => sum + (b.rows || 0) * (b.cols || 0), 0);
  const occupiedPositions = data.samples.length;
  const utilPct = totalPositions > 0 ? Math.round(occupiedPositions / totalPositions * 100) : 0;
  const byType = {};
  data.samples.forEach((s) => { const tp = s.sampleType || 'other'; byType[tp] = (byType[tp] || 0) + 1; });
  const counts = Object.keys(byType).map((k) => byType[k]);
  const maxTypeCount = Math.max.apply(null, [1].concat(counts));
  const within = (days) => data.samples.filter((s) => s.expiryDate && s.expiryDate > t0 && s.expiryDate <= t0 + days * DAY).length;
  const addedIn = (days) => data.samples.filter((s) => s.dateStored && s.dateStored >= t0 - days * DAY).length;
  return {
    totalPositions, occupiedPositions, utilPct, byType, maxTypeCount,
    expiring7: within(7), expiring30: within(30), expiring90: within(90),
    added7: addedIn(7), added30: addedIn(30),
  };
}

function locationOccupancy(data) {
  const perBox = {};
  data.samples.forEach((s) => { perBox[s.boxId] = (perBox[s.boxId] || 0) + 1; });
  return data.locations.map((loc) => {
    const boxes = data.boxes.filter((b) => b.locationId === loc.id);
    const totalSlots = boxes.reduce((s, b) => s + b.rows * b.cols, 0);
    const usedSlots = boxes.reduce((s, b) => s + (perBox[b.id] || 0), 0);
    return { id: loc.id, name: loc.name, nameZh: loc.nameZh, totalSlots, usedSlots };
  });
}

// Meter colour by fill level (InventoryComponents.utilColor).
function utilTone(pct) {
  return pct < 60 ? 'ok' : pct < 85 ? 'warn' : 'full';
}

// ── CSV ────────────────────────────────────────────────────────────────────

function csvCell(c) {
  return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"';
}

function sampleCsvFields(s) {
  return [
    s.position || '', s.name || '', s.sampleType || '', s.quantity || '', s.concentration || '', s.passage || '',
    isoDate(s.dateStored), isoDate(s.expiryDate),
    s.owner || '', (s.tags || []).join('; '), s.description || '', s.notes || '',
  ];
}

function invExportAllCsv(data) {
  const rows = [['Location', 'Box', 'Position', 'Name', 'Type', 'Quantity', 'Concentration', 'Passage', 'Date Stored', 'Expiry', 'Owner', 'Tags', 'Description', 'Notes']];
  data.samples.forEach((s) => {
    const box = data.boxes.find((b) => b.id === s.boxId);
    const loc = box ? data.locations.find((l) => l.id === box.locationId) : null;
    rows.push([loc ? loc.name : '', box ? box.name : ''].concat(sampleCsvFields(s)));
  });
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

function invExportBoxCsv(data, boxId) {
  const box = data.boxes.find((b) => b.id === boxId);
  if (!box) return '';
  const rows = [['Position', 'Name', 'Type', 'Quantity', 'Concentration', 'Passage', 'Date Stored', 'Expiry', 'Owner', 'Tags', 'Description', 'Notes']];
  data.samples.filter((s) => s.boxId === boxId).forEach((s) => rows.push(sampleCsvFields(s)));
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

function invCsvTemplate() {
  return 'Position,Name,Type,Quantity,Concentration,Passage,Date Stored,Expiry,Owner,Tags,Description,Notes\nA1,HEK293T,cell_line,500 uL,,P5,2024-03-10,,John,frozen;validated,Human embryonic kidney cells,Passage 5 frozen stock\n';
}

// RFC 4180-ish: quoted fields may hold commas, "" and line breaks (the web's
// export writes notes with line breaks inside quotes). A UTF-8 BOM is dropped.
function parseCsv(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Header-keyed rows: 'Date Stored' → datestored (the web's parseCsvImport).
function parseCsvImport(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = String(cols[i] || '').trim(); });
    return obj;
  });
}

module.exports = {
  DAY, SAMPLE_TYPES, SAMPLE_TYPE_LABELS, BOX_CONFIGS, BOX_TYPE_LABELS, STORAGE_TYPES, STORAGE_TYPE_LABELS,
  TEMPERATURES, BOX_COLORS, CSV_COLUMNS,
  parseTags, normalizeSampleType, typeLabelKey, normalize, nextInvId, posLabel, parsePos, comparePos, nameOf,
  isoDate, parseDate, todayInput, daysUntil, boxSamples, freePositions, findNextEmpty, samplesOutside,
  matchesSearch, safeFileName, computeStats, locationOccupancy, utilTone,
  invExportAllCsv, invExportBoxCsv, invCsvTemplate, parseCsv, parseCsvImport,
};
