import { useState, useEffect, useRef } from 'react';
import db from '../lib/db.js';

// Drop-in replacement for useLocalStorage, backed by IndexedDB
export function useIndexedStorage(key, defaultVal) {
  const [val, setVal] = useState(() => {
    // Synchronous initial read from localStorage for instant first render
    try {
      const s = localStorage.getItem('biolab_' + key);
      return s ? JSON.parse(s) : defaultVal;
    } catch { return defaultVal; }
  });
  const keyRef = useRef(key);
  keyRef.current = key;
  const loaded = useRef(false);

  // Async load from IndexedDB (overrides localStorage value if found)
  useEffect(() => {
    let cancelled = false;
    db.settings.get('biolab_' + key).then(row => {
      if (cancelled) return;
      if (row) {
        try { setVal(JSON.parse(row.value)); }
        catch { setVal(row.value); }
      }
      loaded.current = true;
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [key]);

  function update(newVal) {
    const next = typeof newVal === 'function' ? newVal(val) : newVal;
    setVal(next);
    // Write to IndexedDB
    db.settings.put({ key: 'biolab_' + keyRef.current, value: JSON.stringify(next) }).catch(() => {});
    // Also write to localStorage as fallback
    try { localStorage.setItem('biolab_' + keyRef.current, JSON.stringify(next)); } catch {}
    return next;
  }

  return [val, update];
}

// ─── Custom recipes — async versions ─────────────────────────────

export async function loadCustomRecipesAsync() {
  try {
    const all = await db.customRecipes.toArray();
    return all.length ? all : loadCustomRecipesSync();
  } catch {
    return loadCustomRecipesSync();
  }
}

export function loadCustomRecipesSync() {
  try { return JSON.parse(localStorage.getItem('labmate_customRecipes') || '[]'); }
  catch { return []; }
}

export async function saveCustomRecipesAsync(arr) {
  try {
    await db.customRecipes.clear();
    if (arr.length) await db.customRecipes.bulkPut(arr);
  } catch { /* IndexedDB write failed, localStorage fallback below */ }
  // Also sync to localStorage as backup
  try { localStorage.setItem('labmate_customRecipes', JSON.stringify(arr)); } catch {}
}

// ─── Custom protocols — async versions ───────────────────────────

export async function loadCustomProtocolsAsync() {
  try {
    const all = await db.customProtocols.toArray();
    return all.length ? all : loadCustomProtocolsSync();
  } catch {
    return loadCustomProtocolsSync();
  }
}

export function loadCustomProtocolsSync() {
  try { return JSON.parse(localStorage.getItem('labmate_customProtocols') || '[]'); }
  catch { return []; }
}

export async function saveCustomProtocolsAsync(arr) {
  try {
    await db.customProtocols.clear();
    if (arr.length) await db.customProtocols.bulkPut(arr);
  } catch { /* IndexedDB write failed, localStorage fallback below */ }
  try { localStorage.setItem('labmate_customProtocols', JSON.stringify(arr)); } catch {}
}
