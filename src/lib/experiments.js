import { useState, useEffect, useCallback } from 'react';
import db from './db.js';

// ── Migration: import from old raw IndexedDB (labmate_experiments) ──

async function migrateFromOldExperimentsDB() {
  const migrated = await db.settings.get('_migrated_experiments');
  if (migrated) return;

  try {
    const oldReq = indexedDB.open('labmate_experiments', 1);
    oldReq.onsuccess = async () => {
      const oldDb = oldReq.result;
      if (!oldDb.objectStoreNames.contains('entries')) { oldDb.close(); return; }
      const tx = oldDb.transaction('entries', 'readonly');
      const store = tx.objectStore('entries');
      const getAll = store.getAll();
      getAll.onsuccess = async () => {
        const entries = getAll.result || [];
        if (entries.length > 0) {
          await db.experiments.bulkPut(entries);
          console.log(`Migrated ${entries.length} experiments from old DB`);
        }
        oldDb.close();
        await db.settings.put({ key: '_migrated_experiments', value: 'true' });
      };
    };
    oldReq.onerror = () => {};
  } catch { /* old DB doesn't exist, nothing to migrate */ }
}

// Run migration on import
migrateFromOldExperimentsDB();

// ── CRUD helpers (Dexie) ──

export function createEmptyExperiment(date, startTime) {
  const now = Date.now();
  return {
    id: 'exp_' + now + '_' + Math.random().toString(36).substr(2, 6),
    date: date || new Date().toISOString().slice(0, 10),
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

export async function exportExperimentsJSON() {
  const entries = await db.experiments.toArray();
  return JSON.stringify({ exportedAt: new Date().toISOString(), type: 'experiments', data: entries }, null, 2);
}

export async function importExperimentsJSON(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  const entries = parsed.data || parsed;
  if (!Array.isArray(entries)) throw new Error('Invalid format');
  await db.experiments.bulkPut(entries);
  return entries.length;
}

// ── React hook ──

const sortEntries = (arr) =>
  arr.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

export function useExperiments() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const all = await db.experiments.toArray();
      setEntries(sortEntries(all));
    } catch (e) { console.error('Failed to load experiments:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const save = useCallback(async (entry) => {
    const updated = { ...entry, updatedAt: Date.now() };
    await db.experiments.put(updated);
    setEntries(prev => {
      const idx = prev.findIndex(e => e.id === updated.id);
      const next = idx >= 0 ? [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)] : [updated, ...prev];
      return sortEntries(next);
    });
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await db.experiments.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  return { entries, loading, save, remove, reload: loadAll };
}
