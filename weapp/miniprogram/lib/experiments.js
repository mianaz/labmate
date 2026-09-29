// Notebook / calendar entries (web: the Dexie `experiments` table, see
// src/lib/experiments.js). One storage key per entry ("nb:<id>") — wx storage
// caps a single key at 1 MB, which one shared array would hit at a few hundred
// entries. Backups carry them in the top-level `experiments` field exactly like
// the web app's schemaVersion 2 files.
const storage = require('./storage');
const bus = require('./bus');
const { isoDate } = require('./format');

const PREFIX = 'nb:';
// Earlier builds kept every entry in one array under this key.
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

function migrate() {
  const legacy = storage.get(KEY, null);
  if (!Array.isArray(legacy)) return;
  let ok = true;
  legacy.forEach((e) => { if (e && e.id && !storage.set(PREFIX + e.id, e)) ok = false; });
  if (ok) storage.remove(KEY);
}

function all() {
  migrate();
  const list = storage.keys()
    .filter((k) => k.indexOf(PREFIX) === 0)
    .map((k) => storage.get(k, null))
    .filter((e) => e && typeof e === 'object' && e.id);
  return sortEntries(list);
}

function get(id) {
  migrate();
  const e = storage.get(PREFIX + id, null);
  return e && typeof e === 'object' ? e : null;
}

// Upsert; fills id/timestamps for partial records. Returns the saved record.
// Throws Error('storage_full') when the phone's storage for the app is full.
function save(entry) {
  const base = createEmptyExperiment(entry && entry.date, entry && entry.startTime);
  const now = Date.now();
  const record = Object.assign({}, base, entry, {
    id: (entry && entry.id) || base.id,
    createdAt: (entry && entry.createdAt) || now,
    updatedAt: now,
  });
  migrate();
  if (!storage.set(PREFIX + record.id, record)) throw new Error('storage_full');
  bus.emit('experiments');
  return record;
}

function remove(id) {
  migrate();
  storage.remove(PREFIX + id);
  bus.emit('experiments');
}

// Merge by id (backup import). Returns how many entries were written; fewer
// than entries.length means storage ran out.
function bulkPut(entries) {
  migrate();
  let written = 0;
  (entries || []).forEach((e) => {
    if (e && e.id && storage.set(PREFIX + e.id, e)) written++;
  });
  bus.emit('experiments');
  return written;
}

module.exports = { KEY, PREFIX, createEmptyExperiment, all, get, save, remove, bulkPut };
