// Inventory store: the web's InventoryTab handlers (CRUD, move, duplicate, bulk,
// CSV / JSON import, undo) over lib/storage.js. Same key and data shape as the
// web app (`labmate_inventory`), so backups move freely between the two.
//
// Every mutation returns { ok: true, ... } or { ok: false, reason }. reason
// 'storage' means the write failed (wx storage allows 1 MB per key); the stored
// data is then unchanged. Successful writes emit bus 'inventory'.
const storage = require('../../../../lib/storage');
const bus = require('../../../../lib/bus');
const U = require('./utils');

const KEY = 'labmate_inventory';
const DASH_KEY = 'labmate_inv_dashboard_dismissed';
const UNDO_MAX = 10;

// In-memory undo stack shared by the inventory pages (the web's undoStackRef).
let undoStack = [];
// A write from elsewhere (a backup restore in lib/backup.js) makes the stack
// stale: undoing would throw the restored data away, so forget it.
let ownEmit = false;
bus.on('inventory', () => { if (!ownEmit) undoStack = []; });

function emit() {
  ownEmit = true;
  try { bus.emit('inventory'); } finally { ownEmit = false; }
}

function load() {
  let raw = storage.get(KEY, null);
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (err) { raw = null; }
  }
  return U.normalize(raw);
}

function clone(d) { return JSON.parse(JSON.stringify(d)); }

function write(data) {
  if (!storage.set(KEY, data)) return false;
  emit();
  return true;
}

// Run fn on a working copy; persist it and push the previous state for undo.
// fn may return { ok: false, reason } to abort without writing.
function mutate(fn) {
  const data = load();
  const before = clone(data);
  const res = fn(data) || {};
  if (res.ok === false) return res;
  if (!write(data)) return { ok: false, reason: 'storage' };
  undoStack.push(before);
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  return Object.assign({ ok: true }, res);
}

function canUndo() { return undoStack.length > 0; }

function undo() {
  if (!undoStack.length) return { ok: false, reason: 'empty' };
  const prev = undoStack[undoStack.length - 1];
  if (!write(prev)) return { ok: false, reason: 'storage' };
  undoStack.pop();
  return { ok: true };
}

// ── Locations ──────────────────────────────────────────────────────────────

function locationFields(form) {
  return {
    name: String(form.name || '').trim(),
    nameZh: String(form.nameZh || '').trim(),
    type: U.STORAGE_TYPE_LABELS[form.type] ? form.type : 'freezer',
    temperature: form.temperature || '',
  };
}

function saveLocation(form, id) {
  const f = locationFields(form);
  if (!f.name) return { ok: false, reason: 'name' };
  return mutate((d) => {
    if (id != null) {
      d.locations = d.locations.map((l) => (l.id === id ? Object.assign({}, l, f) : l));
      return { id };
    }
    const newId = U.nextInvId(d, 'locations');
    d.locations.push(Object.assign({ id: newId }, f, { parentId: null, order: d.locations.length }));
    return { id: newId };
  });
}

function deleteLocation(id) {
  return mutate((d) => {
    const boxIds = d.boxes.filter((b) => b.locationId === id).map((b) => b.id);
    d.locations = d.locations.filter((l) => l.id !== id);
    d.boxes = d.boxes.filter((b) => b.locationId !== id);
    d.samples = d.samples.filter((s) => boxIds.indexOf(s.boxId) < 0);
  });
}

// ── Boxes ──────────────────────────────────────────────────────────────────

// Like the web's BoxForm: the form carries rows/cols (a preset fills them in
// when the type changes), so a box keeps its stored size when it is renamed.
function boxFields(form) {
  const cfg = U.BOX_CONFIGS.find((c) => c.type === form.boxType) || U.BOX_CONFIGS[U.BOX_CONFIGS.length - 1];
  const rows = Math.max(1, Math.min(26, parseInt(form.rows, 10) || cfg.rows));
  const cols = Math.max(1, Math.min(50, parseInt(form.cols, 10) || cfg.cols));
  return {
    name: String(form.name || '').trim(),
    nameZh: String(form.nameZh || '').trim(),
    boxType: cfg.type, rows, cols,
    color: form.color || '',
  };
}

function saveBox(form, locationId, id) {
  const f = boxFields(form);
  if (!f.name) return { ok: false, reason: 'name' };
  return mutate((d) => {
    if (id != null) {
      d.boxes = d.boxes.map((b) => (b.id === id ? Object.assign({}, b, f) : b));
      return { id };
    }
    if (!d.locations.some((l) => l.id === locationId)) return { ok: false, reason: 'location' };
    const newId = U.nextInvId(d, 'boxes');
    d.boxes.push(Object.assign({ id: newId }, f, { locationId }));
    return { id: newId };
  });
}

function deleteBox(id) {
  return mutate((d) => {
    d.boxes = d.boxes.filter((b) => b.id !== id);
    d.samples = d.samples.filter((s) => s.boxId !== id);
  });
}

// ── Samples ────────────────────────────────────────────────────────────────

// SampleForm's submit: date inputs → ms, tags string → array.
function sampleFields(form) {
  return {
    name: String(form.name || '').trim(),
    sampleType: U.normalizeSampleType(form.sampleType),
    quantity: form.quantity || '',
    concentration: form.concentration || '',
    passage: form.passage || '',
    dateStored: U.parseDate(form.dateStored) || Date.now(),
    expiryDate: U.parseDate(form.expiryDate),
    owner: form.owner || '',
    tags: Array.isArray(form.tags) ? form.tags : U.parseTags(form.tags),
    description: form.description || '',
    notes: form.notes || '',
  };
}

// New sample at { boxId, position }, or an edit of `id`.
function saveSample(form, target) {
  const f = sampleFields(form);
  if (!f.name) return { ok: false, reason: 'name' };
  const t = target || {};
  return mutate((d) => {
    if (t.id != null) {
      d.samples = d.samples.map((s) => (s.id === t.id ? Object.assign({}, s, f) : s));
      return { id: t.id };
    }
    if (!d.boxes.some((b) => b.id === t.boxId)) return { ok: false, reason: 'box' };
    if (t.position && d.samples.some((s) => s.boxId === t.boxId && s.position === t.position)) {
      return { ok: false, reason: 'occupied' };
    }
    const id = U.nextInvId(d, 'samples');
    d.samples.push(Object.assign({ id }, f, { boxId: t.boxId, position: t.position || '' }));
    return { id };
  });
}

function deleteSamples(ids) {
  let n = 0;
  const res = mutate((d) => {
    const before = d.samples.length;
    d.samples = d.samples.filter((s) => ids.indexOf(s.id) < 0);
    n = before - d.samples.length;
    if (!n) return { ok: false, reason: 'none' };
  });
  return res.ok ? { ok: true, count: n } : res;
}

function deleteSample(id) { return deleteSamples([id]); }

function moveSample(id, boxId, position) {
  return mutate((d) => {
    if (d.samples.some((s) => s.boxId === boxId && s.position === position && s.id !== id)) {
      return { ok: false, reason: 'occupied' };
    }
    if (!d.boxes.some((b) => b.id === boxId)) return { ok: false, reason: 'box' };
    d.samples = d.samples.map((s) => (s.id === id ? Object.assign({}, s, { boxId, position }) : s));
  });
}

function duplicateSample(id) {
  return mutate((d) => {
    const src = d.samples.find((s) => s.id === id);
    if (!src) return { ok: false, reason: 'missing' };
    const box = d.boxes.find((b) => b.id === src.boxId);
    const pos = U.findNextEmpty(box, U.boxSamples(d, src.boxId));
    if (!pos) return { ok: false, reason: 'full' };
    const newId = U.nextInvId(d, 'samples');
    d.samples.push(Object.assign({}, src, { id: newId, position: pos, dateStored: Date.now() }));
    return { id: newId, position: pos };
  });
}

// Same sample in every listed (empty) position.
function bulkAdd(boxId, positions, form) {
  const f = sampleFields(form);
  if (!f.name) return { ok: false, reason: 'name' };
  return mutate((d) => {
    const taken = {};
    U.boxSamples(d, boxId).forEach((s) => { taken[s.position] = true; });
    let count = 0;
    positions.forEach((pos) => {
      if (taken[pos]) return;
      const id = U.nextInvId(d, 'samples');
      d.samples.push(Object.assign({ id, boxId, position: pos }, f, { nameZh: form.nameZh || '', dateStored: Date.now() }));
      count++;
    });
    if (!count) return { ok: false, reason: 'none' };
    return { count };
  });
}

// Only the fields that were filled in change.
function bulkEdit(ids, form) {
  return mutate((d) => {
    let count = 0;
    d.samples = d.samples.map((s) => {
      if (ids.indexOf(s.id) < 0) return s;
      count++;
      const u = Object.assign({}, s);
      if (form.owner) u.owner = form.owner;
      if (form.sampleType) u.sampleType = U.normalizeSampleType(form.sampleType);
      if (form.expiryDate) u.expiryDate = U.parseDate(form.expiryDate);
      if (form.tags) u.tags = U.parseTags(form.tags);
      return u;
    });
    if (!count) return { ok: false, reason: 'none' };
    return { count };
  });
}

// ── Import ─────────────────────────────────────────────────────────────────

// CSV rows become samples in one box; rows whose position is taken are skipped.
function importCsv(boxId, text) {
  let rows;
  try { rows = U.parseCsvImport(text); } catch (err) { rows = []; }
  if (!rows.length) return { ok: false, reason: 'format' };
  return mutate((d) => {
    if (!d.boxes.some((b) => b.id === boxId)) return { ok: false, reason: 'box' };
    const occupied = {};
    U.boxSamples(d, boxId).forEach((s) => { occupied[s.position] = true; });
    let count = 0;
    let skipped = 0;
    rows.forEach((r) => {
      if (!r.name) return;
      const pos = String(r.position || '').trim().toUpperCase();
      if (pos && occupied[pos]) { skipped++; return; }
      const id = U.nextInvId(d, 'samples');
      d.samples.push({
        id, boxId, position: pos, name: r.name,
        sampleType: U.normalizeSampleType(r.type || 'other'),
        quantity: r.quantity || '', concentration: r.concentration || '',
        passage: r.passage || '',
        dateStored: U.parseDate(r.datestored) || Date.now(),
        expiryDate: U.parseDate(r.expiry),
        owner: r.owner || '',
        tags: U.parseTags(r.tags, ';'),
        description: r.description || '', notes: r.notes || '',
      });
      if (pos) occupied[pos] = true;
      count++;
    });
    if (!count && !skipped) return { ok: false, reason: 'format' };
    return { count, skipped };
  });
}

// An inventory backup ({ type: 'inventory', data } or the bare data) merged
// into what is here, with fresh ids (the web's handleImportJson).
function importJson(text) {
  let imported;
  try {
    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
    imported = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
  } catch (err) { return { ok: false, reason: 'format' }; }
  if (!imported || typeof imported !== 'object' || (!imported.locations && !imported.boxes && !imported.samples)) {
    return { ok: false, reason: 'format' };
  }
  const locs = Array.isArray(imported.locations) ? imported.locations : [];
  const boxes = Array.isArray(imported.boxes) ? imported.boxes : [];
  const samples = Array.isArray(imported.samples) ? imported.samples : [];
  return mutate((d) => {
    const locIdMap = {};
    const boxIdMap = {};
    locs.forEach((l) => {
      const newId = U.nextInvId(d, 'locations');
      locIdMap[l.id] = newId;
      d.locations.push(Object.assign({}, l, { id: newId }));
    });
    boxes.forEach((b) => {
      const newId = U.nextInvId(d, 'boxes');
      boxIdMap[b.id] = newId;
      const locId = locIdMap[b.locationId] || b.locationId;
      if (!d.locations.some((l) => l.id === locId)) return;
      d.boxes.push(Object.assign({}, b, { id: newId, locationId: locId }));
    });
    samples.forEach((s) => {
      const newId = U.nextInvId(d, 'samples');
      d.samples.push(Object.assign({}, s, { id: newId, boxId: boxIdMap[s.boxId] || s.boxId }));
    });
    return { count: locs.length + boxes.length + samples.length };
  });
}

function exportJson(data) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), type: 'inventory', data: data || load() }, null, 2);
}

// ── Overview strip visibility (web: localStorage 'true' when dismissed) ────

function dashboardShown() { return storage.get(DASH_KEY, '') !== 'true'; }
function setDashboardShown(on) {
  if (on) storage.remove(DASH_KEY); else storage.set(DASH_KEY, 'true');
  emit();
}

// Tests: forget the undo history.
function _reset() { undoStack = []; }

module.exports = {
  KEY, DASH_KEY, load, canUndo, undo,
  saveLocation, deleteLocation, saveBox, deleteBox,
  saveSample, deleteSample, deleteSamples, moveSample, duplicateSample, bulkAdd, bulkEdit,
  importCsv, importJson, exportJson, dashboardShown, setDashboardShown, _reset,
};
