// ──────────────────────────────────────────────────────────────────────────────
// Evidence maps — persistence (Dexie `evidenceMaps` table) and the React hook.
// The map logic itself is pure and lives in evidence.js.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import db from './db.js';

export const EVIDENCE_CHANGED_EVENT = 'labmate:evidence-changed';

/** Imperative write for non-React callers (the assistant's split tool). */
export async function saveEvidenceMapRecord(map) {
  const record = { ...map, updatedAt: Date.now() };
  await db.evidenceMaps.put(record);
  try { window.dispatchEvent(new window.CustomEvent(EVIDENCE_CHANGED_EVENT)); } catch { /* no window */ }
  return record;
}

const byRecent = (arr) => arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

export function useEvidenceMaps() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      setMaps(byRecent(await db.evidenceMaps.toArray()));
    } catch (e) { console.error('Failed to load evidence maps:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    window.addEventListener(EVIDENCE_CHANGED_EVENT, loadAll);
    return () => window.removeEventListener(EVIDENCE_CHANGED_EVENT, loadAll);
  }, [loadAll]);

  // The list keeps its order while a map is being edited (no jumping rows);
  // it re-sorts by last change on the next load.
  const save = useCallback(async (map) => {
    const updated = { ...map, updatedAt: Date.now() };
    setMaps((prev) => {
      const idx = prev.findIndex((m) => m.id === updated.id);
      return idx >= 0 ? [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)] : [updated, ...prev];
    });
    await db.evidenceMaps.put(updated);
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await db.evidenceMaps.delete(id);
    setMaps((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { maps, loading, save, remove, reload: loadAll };
}
