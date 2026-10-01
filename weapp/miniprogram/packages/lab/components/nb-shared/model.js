// Shared model for the Notebook and Calendar pages — the helpers the web app
// keeps in src/features/notebook/NotebookTab.jsx, src/features/calendar/CalendarTab.jsx,
// src/features/notebook/ProtocolSelector.jsx, src/lib/experiments.js (JSON
// export/import) and src/lib/agent/exportProtocol.js (Markdown export).
const experiments = require('../../../../lib/experiments');
const recipes = require('../../../../lib/recipes');
const { t, tf } = require('../../../../shared/i18n.js');
const { isoDate } = require('../../../../lib/format');
const { toProcedureSteps, toReagents, recipeTitle, normalizeProtocolSteps } = require('../../../../shared/protocolImport.js');

// Status → label key (tones live in nb.wxss as .nb-st-<id>).
const STATUSES = [
  { id: 'planned', key: 'nbStatusPlanned' },
  { id: 'in-progress', key: 'nbStatusInProgress' },
  { id: 'completed', key: 'nbStatusCompleted' },
  { id: 'cancelled', key: 'nbStatusCancelled' },
];
const STATUS_IDS = STATUSES.map((s) => s.id);
const STATUS_KEY = {};
STATUSES.forEach((s) => { STATUS_KEY[s.id] = s.key; });
const PRIORITIES = [
  { id: 'high', key: 'nbPriorityHigh' },
  { id: 'medium', key: 'nbPriorityMedium' },
  { id: 'low', key: 'nbPriorityLow' },
];

// Optional label colour. createEmptyExperiment() stamps DEFAULT_COLOR on every
// record, so that value means "none chosen" (calendar chips go by status).
const DEFAULT_COLOR = '#1D9E75';
const LABEL_COLORS = [
  { value: '#16B364', en: 'Green', zh: '绿色' },
  { value: '#6366f1', en: 'Indigo', zh: '靛蓝' },
  { value: '#f59e0b', en: 'Amber', zh: '琥珀' },
  { value: '#ef4444', en: 'Red', zh: '红色' },
  { value: '#ec4899', en: 'Pink', zh: '粉色' },
  { value: '#8b5cf6', en: 'Violet', zh: '紫色' },
  { value: '#06b6d4', en: 'Cyan', zh: '青色' },
];
function hasLabelColor(c) { return !!c && String(c).toLowerCase() !== DEFAULT_COLOR.toLowerCase(); }

const MONTH_KEYS = ['calJan', 'calFeb', 'calMar', 'calApr', 'calMay', 'calJun', 'calJul', 'calAug', 'calSep', 'calOct', 'calNov', 'calDec'];
const DAY_KEYS = ['calSun', 'calMon', 'calTue', 'calWed', 'calThu', 'calFri', 'calSat'];

const clone = (o) => JSON.parse(JSON.stringify(o));
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return isoDate(d); }
function isDateStr(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
function isTimeStr(s) { return /^\d{2}:\d{2}$/.test(s || ''); }
// 'YYYY-MM-DD' → local Date (a UTC parse would shift the day).
function parseDate(s) {
  const p = String(s).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function dec(v) {
  try { return decodeURIComponent(v); } catch (err) { return v; }
}

function statusOf(e) { return e && STATUS_KEY[e.status] ? e.status : 'planned'; }

function addMinutes(time, minutes) {
  const p = String(time || '').split(':').map(Number);
  if (p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return '';
  const total = p[0] * 60 + p[1] + (Number(minutes) || 0);
  return pad2(Math.floor(total / 60) % 24) + ':' + pad2(total % 60);
}

function formatStamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return isoDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function displayTitle(e, lang) {
  return (lang === 'zh' ? (e.titleZh || e.title) : (e.title || e.titleZh)) || '';
}

function protocolName(ref, lang) {
  if (!ref) return '';
  const r = recipes.getById(ref);
  if (!r) return String(ref);
  return lang === 'zh' ? (r.nameCn || r.name) : r.name;
}

function monthShort(d, lang) {
  return lang === 'zh' ? (d.getMonth() + 1) + '月' : t(MONTH_KEYS[d.getMonth()], 'en').slice(0, 3);
}
// "Mon, Jul 7" / "7月7日 周一"
function shortDate(d, lang) {
  return lang === 'zh'
    ? (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + t(DAY_KEYS[d.getDay()], 'zh')
    : t(DAY_KEYS[d.getDay()], 'en') + ', ' + t(MONTH_KEYS[d.getMonth()], 'en') + ' ' + d.getDate();
}

// ── Records ─────────────────────────────────────────────────────────────────
const ITEM_FROM_STRING = {
  reagents: (s) => ({ name: s, amount: '', unit: '', location: '', inventoryRef: null }),
  equipment: (s) => ({ name: s, status: 'pending' }),
  checklist: (s) => ({ item: s, checked: false }),
  protocolSteps: (s) => ({ stepText: s, completed: false, deviation: '', actualParams: '' }),
  figures: (s) => ({ description: s, notes: '' }),
};
function items(list, kind) {
  if (!Array.isArray(list)) return [];
  return list.filter((x) => x != null).map((x) => (typeof x === 'object' ? x : ITEM_FROM_STRING[kind](String(x))));
}

// Fill whatever sections a partial or older record lacks (agent-made or
// imported entries), so the editor can bind doc.plan.objectives etc. safely.
function normalize(entry) {
  const e = clone(entry || {});
  const base = experiments.createEmptyExperiment(e.date, e.startTime);
  const out = Object.assign({}, base, e);
  out.plan = Object.assign({}, base.plan, e.plan || {});
  out.materials = Object.assign({}, base.materials, e.materials || {});
  ['reagents', 'equipment', 'checklist'].forEach((k) => { out.materials[k] = items(out.materials[k], k); });
  out.procedure = Object.assign({}, base.procedure, e.procedure || {});
  out.procedure.protocolSteps = items(out.procedure.protocolSteps, 'protocolSteps');
  out.results = Object.assign({}, base.results, e.results || {});
  out.results.figures = items(out.results.figures, 'figures');
  return out;
}

// Duration in minutes, or 0 when the value isn't a positive number.
function minutes(v) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(v) ? parseFloat(v) : NaN);
  return n > 0 ? n : 0;
}

// Import a protocol's steps and materials into an entry (NotebookTab.handleImportProtocol).
function applyProtocol(doc, recipe, lang) {
  const next = clone(doc);
  next.protocolRef = recipe.id;
  next.title = doc.title || recipeTitle(recipe, lang);
  next.titleZh = doc.titleZh || recipe.nameCn || '';
  // A few library protocols carry duration as an object; only minutes count.
  next.duration = minutes(recipe.duration) || doc.duration;
  next.procedure = {
    mode: 'template',
    protocolSteps: toProcedureSteps(recipe, lang),
    freeText: (doc.procedure && doc.procedure.freeText) || '',
  };
  if (recipe.materials) next.materials = Object.assign({}, next.materials, { reagents: toReagents(recipe) });
  return next;
}

// Section meta lines ("2 reagents · checklist 1/3", "3/12 done", …).
function docMeta(doc, lang) {
  const zh = lang === 'zh';
  const m = doc.materials || {};
  const nr = (m.reagents || []).length;
  const ne = (m.equipment || []).length;
  const cl = m.checklist || [];
  const checked = cl.filter((c) => c && c.checked).length;
  const materials = [
    nr ? (zh ? '试剂 ' + nr : nr + ' reagent' + (nr === 1 ? '' : 's')) : '',
    ne ? (zh ? '设备 ' + ne : ne + ' equipment') : '',
    cl.length ? (zh ? '清单 ' : 'checklist ') + checked + '/' + cl.length : '',
  ].filter(Boolean).join(' · ');

  const proc = doc.procedure || {};
  const steps = proc.protocolSteps || [];
  const done = steps.filter((s) => s && s.completed).length;
  const isTemplate = proc.mode === 'template';
  let procedure = '';
  if (isTemplate && steps.length) procedure = zh ? '已完成 ' + done + '/' + steps.length : done + '/' + steps.length + ' done';
  else if (!isTemplate && proc.freeText) procedure = t('nbFreetextMode', lang);

  const nf = ((doc.results || {}).figures || []).length;
  const results = nf ? (zh ? '图表 ' + nf : nf + ' figure' + (nf === 1 ? '' : 's')) : '';

  return {
    materials,
    procedure,
    results,
    done,
    steps: steps.length,
    pct: steps.length ? Math.round((done / steps.length) * 100) : 0,
  };
}

function entriesCount(n, lang) {
  return n === 1 ? t('nbEntriesOne', lang) : tf('nbEntriesN', lang, { n });
}

// Notebook list row.
function listRow(e, lang) {
  const title = displayTitle(e, lang);
  const status = statusOf(e);
  return {
    id: e.id,
    title: title || t('nbUntitled', lang),
    untitled: !title,
    status,
    statusKey: STATUS_KEY[status],
    date: e.date || '—',
    high: e.priority === 'high',
    proto: protocolName(e.protocolRef, lang),
  };
}

// Calendar agenda row.
function calendarRow(e, lang, highlightId) {
  const title = displayTitle(e, lang);
  const status = statusOf(e);
  return {
    id: e.id,
    time: e.startTime || '--:--',
    title: title || t('calUntitled', lang),
    untitled: !title,
    dur: (minutes(e.duration) || 0) + ' min',
    proto: protocolName(e.protocolRef, lang),
    status,
    statusLabel: t(STATUS_KEY[status], lang),
    cancelled: e.status === 'cancelled',
    swatch: hasLabelColor(e.color) ? e.color : '',
    hl: !!highlightId && e.id === highlightId,
  };
}

// Notebook search: title, Chinese title, objectives, date.
function matchesSearch(e, q) {
  if (!q) return true;
  return String(e.title || '').toLowerCase().includes(q)
    || String(e.titleZh || '').toLowerCase().includes(q)
    || String((e.plan && e.plan.objectives) || '').toLowerCase().includes(q)
    || String(e.date || '').includes(q);
}

// ── Protocol picker rows (ProtocolSelector.jsx) ─────────────────────────────
// Library rows are cached per language; the user's custom protocols are read
// fresh each time (they can change on the custom-form page).
const libraryRowCache = {};
function protocolRow(r, lang) {
  const zh = lang === 'zh';
  return {
    id: r.id,
    primary: zh ? (r.nameCn || r.name) : r.name,
    secondary: zh ? (r.nameCn ? r.name : '') : (r.nameCn || ''),
    steps: normalizeProtocolSteps(r, lang).length,
    materials: Array.isArray(r.materials) ? r.materials.length : 0,
    duration: minutes(r.duration) || 0,
    custom: !!r._isCustom,
    q: [r.name || '', r.nameCn || ''].concat(r.tags || []).join('\n').toLowerCase(),
  };
}
function protocolRows(lang) {
  if (!libraryRowCache[lang]) libraryRowCache[lang] = recipes.PROTOCOLS.map((r) => protocolRow(r, lang));
  return libraryRowCache[lang].concat(recipes.customProtocols().map((r) => protocolRow(r, lang)));
}

// ── Export / import ─────────────────────────────────────────────────────────
// Same file as the web's exportExperimentsJSON().
function exportJSON(entries) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), type: 'experiments', data: entries }, null, 2);
}
function exportFileName() { return 'labmate_experiments_' + isoDate() + '.json'; }

// importExperimentsJSON(): `{ data: [...] }` or a bare array. Also takes a full
// LabMate backup (entries in its top-level `experiments`).
function parseImportJSON(text) {
  const parsed = JSON.parse(text);
  let list = null;
  if (Array.isArray(parsed)) list = parsed;
  else if (parsed && Array.isArray(parsed.data)) list = parsed.data;
  else if (parsed && Array.isArray(parsed.experiments)) list = parsed.experiments;
  if (!list) throw new Error('Invalid format');
  const valid = list.filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && e.id);
  if (list.length && !valid.length) throw new Error('Invalid format');
  return valid;
}

// Markdown of one entry (exportProtocol.experimentToMarkdown).
function experimentToMarkdown(entry) {
  const e = entry || {};
  const plan = e.plan || {};
  const m = e.materials || {};
  const proc = e.procedure || {};
  const res = e.results || {};
  let md = '# ' + (e.title || 'Untitled Experiment') + '\n';
  if (e.titleZh) md += '**' + e.titleZh + '**\n';
  md += '\n**Date:** ' + (e.date || 'N/A') + '  \n';
  md += '**Status:** ' + (e.status || '') + '  \n**Priority:** ' + (e.priority || '') + '\n';
  if (e.protocolRef) md += '**Protocol:** ' + e.protocolRef + '\n';
  md += '\n## Plan\n\n### Objectives\n' + (plan.objectives || '_None_') + '\n\n### Notes\n' + (plan.notes || '_None_') + '\n';
  md += '\n## Materials\n\n### Reagents\n';
  (m.reagents || []).forEach((r) => {
    md += '- ' + r.name + (r.amount ? ': ' + r.amount + ' ' + (r.unit || '') : '') + (r.location ? ' (' + r.location + ')' : '') + '\n';
  });
  if ((m.equipment || []).length) {
    md += '\n### Equipment\n';
    m.equipment.forEach((eq) => { md += '- [' + (eq.status === 'ready' ? 'x' : ' ') + '] ' + eq.name + '\n'; });
  }
  if ((m.checklist || []).length) {
    md += '\n### Checklist\n';
    m.checklist.forEach((c) => { md += '- [' + (c.checked ? 'x' : ' ') + '] ' + c.item + '\n'; });
  }
  md += '\n## Procedure\n\n';
  if (proc.mode === 'template' && (proc.protocolSteps || []).length) {
    proc.protocolSteps.forEach((s, i) => {
      md += (i + 1) + '. [' + (s.completed ? 'x' : ' ') + '] ' + s.stepText + '\n';
      if (s.deviation) md += '   - **Deviation:** ' + s.deviation + '\n';
      if (s.actualParams) md += '   - **Actual:** ' + s.actualParams + '\n';
    });
  } else {
    md += proc.freeText || '_None_';
  }
  md += '\n\n## Results\n\n### Summary\n' + (res.summary || '_None_') + '\n';
  if (res.dataProcessing) md += '\n### Data Processing\n' + res.dataProcessing + '\n';
  if ((res.figures || []).length) {
    md += '\n### Figures\n';
    res.figures.forEach((f, i) => { md += (i + 1) + '. ' + f.description + (f.notes ? ' — ' + f.notes : '') + '\n'; });
  }
  return md;
}
function experimentFilename(entry) {
  const e = entry || {};
  return 'experiment_' + (e.date || 'entry') + '_' + String(e.id || 'entry').slice(-6) + '.md';
}

// ── .ics — shared with the web's CalendarTab (src/lib/ics.js) ──────────────
const { icsEntries, buildICS } = require('../../../../shared/ics.js');

// A cancelled share / file pick is not an error worth a toast.
function isCancelError(err) {
  return /cancel/i.test(String((err && (err.errMsg || err.message)) || ''));
}

module.exports = {
  STATUSES, STATUS_IDS, STATUS_KEY, PRIORITIES, DEFAULT_COLOR, LABEL_COLORS, MONTH_KEYS, DAY_KEYS,
  hasLabelColor, clone, pad2, ymd, isDateStr, isTimeStr, parseDate, dec, statusOf, addMinutes,
  formatStamp, displayTitle, protocolName, monthShort, shortDate,
  normalize, applyProtocol, docMeta, entriesCount, listRow, calendarRow, matchesSearch, protocolRows,
  exportJSON, exportFileName, parseImportJSON, experimentToMarkdown, experimentFilename,
  icsEntries, buildICS, isCancelError,
};
