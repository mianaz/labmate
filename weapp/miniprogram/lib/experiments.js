// Notebook / calendar entries (web: the Dexie `experiments` table, see
// src/lib/experiments.js). Stored as one array; backups carry them in the
// top-level `experiments` field exactly like the web app's schemaVersion 2 files.
const storage = require('./storage');
const bus = require('./bus');
const { isoDate } = require('./format');

const KEY = 'labmate_experiments';

function createEmptyExperiment(date, startTime) {
  const now = Date.now();
  return {
    id: 'exp_' + now + '_' + Math.random().toString(36).slice(2, 8),
    date: date || isoDate(),
    title: '',
    titleZh: '',
    status: 'planned',
    priority: 'medium',
    color: '#1D9E75',
    startTime: startTime || '09:00',
    endTime: '',
    duration: 60,
    protocolRef: null,
    plan: { objectives: '', notes: '' },
    materials: { reagents: [], equipment: [], plateLayout: null, checklist: [] },
    procedure: { mode: 'freetext', protocolSteps: [], freeText: '' },
    results: { summary: '', dataProcessing: '', figures: [], backupStatus: '' },
    createdAt: now,
    updatedAt: now,
  };
}

function sortEntries(arr) {
  return arr.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
}

function all() {
  const v = storage.get(KEY, []);
  return sortEntries(Array.isArray(v) ? v.slice() : []);
}

function get(id) {
  return all().find((e) => e.id === id) || null;
}

function writeAll(list) {
  const ok = storage.set(KEY, list);
  bus.emit('experiments');
  return ok;
}

// Upsert; fills id/timestamps for partial records. Returns the saved record.
function save(entry) {
  const base = createEmptyExperiment(entry && entry.date, entry && entry.startTime);
  const now = Date.now();
  const record = Object.assign({}, base, entry, {
    id: (entry && entry.id) || base.id,
    createdAt: (entry && entry.createdAt) || now,
    updatedAt: now,
  });
  const list = all();
  const i = list.findIndex((e) => e.id === record.id);
  if (i >= 0) list[i] = record; else list.push(record);
  if (!writeAll(list)) throw new Error('storage_full');
  return record;
}

function remove(id) {
  writeAll(all().filter((e) => e.id !== id));
}

// Merge by id (backup import).
function bulkPut(entries) {
  const list = all();
  const index = {};
  list.forEach((e, i) => { index[e.id] = i; });
  entries.forEach((e) => {
    if (!e || !e.id) return;
    if (index[e.id] !== undefined) list[index[e.id]] = e;
    else { index[e.id] = list.length; list.push(e); }
  });
  writeAll(list);
  return entries.length;
}

module.exports = { KEY, createEmptyExperiment, all, get, save, remove, bulkPut };
