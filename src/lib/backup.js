import db from './db.js';

const LS_PREFIXES = ['labmate_', 'biolab_', 'stepProgress_', 'stepTracker_'];
const LS_EXACT_KEYS = ['favs', 'lang', 'theme'];
const MERGE_ARRAY_KEYS = ['labmate_customRecipes', 'labmate_customProtocols'];

// Defense-in-depth: secrets are supposed to live in the dedicated `credentials`
// Dexie table (see credentials.js), which this file never reads. This guard is
// the belt-and-suspenders: refuse to export OR import anything key/token-shaped
// that might land in localStorage, so a backup file can never carry a secret.
const SECRET_KEY_RE = /(^|[_-])(api[_-]?key|secret|token|credential|bearer|password|passwd|key)([_-]|$)/i;

function isBackupKey(key) {
  if (SECRET_KEY_RE.test(key)) return false;
  return LS_PREFIXES.some(p => key.startsWith(p)) || LS_EXACT_KEYS.includes(key);
}

export function collectBackupData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (isBackupKey(key)) {
      try { data[key] = JSON.parse(localStorage.getItem(key)); }
      catch { data[key] = localStorage.getItem(key); }
    }
  }
  return data;
}

export async function exportBackup() {
  const data = collectBackupData();
  // Notebook/calendar experiments live only in Dexie (no localStorage mirror) —
  // pull them explicitly so one backup file truly contains everything.
  let experiments = [];
  try { experiments = await db.experiments.toArray(); }
  catch { /* still export the localStorage-mirrored data */ }
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), appVersion: __APP_VERSION__, schemaVersion: 2, data, experiments }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `labmate-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('labmate_lastExport', String(Date.now()));
  db.settings.put({ key: 'labmate_lastExport', value: String(Date.now()) }).catch(() => {});
}

export async function importBackup(fileContent) {
  const parsed = JSON.parse(fileContent);
  if (!parsed.exportedAt || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Invalid backup format');
  }
  let count = 0;
  // schemaVersion 2 backups carry notebook/calendar experiments; v1 files don't have the field.
  if (Array.isArray(parsed.experiments) && parsed.experiments.length > 0) {
    await db.experiments.bulkPut(parsed.experiments);
    count += parsed.experiments.length;
  }
  Object.entries(parsed.data).forEach(([key, value]) => {
    if (SECRET_KEY_RE.test(key)) return; // never restore a secret-shaped key from a backup file
    if (MERGE_ARRAY_KEYS.includes(key)) {
      let existing = [];
      try { existing = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
      const incoming = Array.isArray(value) ? value : [];
      const merged = [...existing];
      const existingIds = new Set(existing.map(item => item.id));
      for (const item of incoming) {
        if (existingIds.has(item.id)) {
          const idx = merged.findIndex(m => m.id === item.id);
          if (idx >= 0) merged[idx] = item;
        } else {
          merged.push(item);
        }
      }
      localStorage.setItem(key, JSON.stringify(merged));
      if (key === 'labmate_customRecipes') {
        db.customRecipes.clear().then(() => db.customRecipes.bulkPut(merged)).catch(() => {});
      } else if (key === 'labmate_customProtocols') {
        db.customProtocols.clear().then(() => db.customProtocols.bulkPut(merged)).catch(() => {});
      }
    } else {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      if (key.startsWith('labmate_') || key.startsWith('biolab_')) {
        db.settings.put({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }).catch(() => {});
      }
      if (key === 'labmate_inventory') {
        db.inventory.put({ key: 'data', value: typeof value === 'object' ? value : JSON.parse(value) }).catch(() => {});
      }
      if (key.startsWith('stepTracker_')) {
        const recipeId = key.replace('stepTracker_', '');
        const steps = Array.isArray(value) ? value : [];
        db.stepProgress.put({ recipeId, completedSteps: steps }).catch(() => {});
      }
    }
    count++;
  });
  return count;
}
