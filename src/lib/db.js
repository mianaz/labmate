import Dexie from 'dexie';

const db = new Dexie('labmate');

db.version(1).stores({
  // Key-value store for simple settings (lang, theme, onboardingDone, etc.)
  settings: 'key',
  // Custom recipes created by the user
  customRecipes: 'id, category',
  // Custom protocols created by the user
  customProtocols: 'id',
  // Inventory data (locations, boxes, samples)
  inventory: 'key',
  // Favorites and recent items
  favorites: 'key',
  // Step progress per recipe
  stepProgress: 'recipeId',
});

db.version(2).stores({
  settings: 'key',
  customRecipes: 'id, category',
  customProtocols: 'id',
  inventory: 'key',
  favorites: 'key',
  stepProgress: 'recipeId',
  // Experiment notebook & calendar entries
  experiments: 'id, date, status, protocolRef',
});

db.version(3).stores({
  settings: 'key',
  customRecipes: 'id, category',
  customProtocols: 'id',
  inventory: 'key',
  favorites: 'key',
  stepProgress: 'recipeId',
  experiments: 'id, date, status, protocolRef',
  // BYO provider keys / OAuth tokens. A DEDICATED table on purpose: the backup
  // code (backup.js) reads only localStorage + the experiments table, never this
  // one, so a shared/emailed backup file can never contain a secret. Never store
  // credentials in localStorage or `settings`, which DO ride the backup.
  credentials: 'name',
});

export default db;

// ─── Persistent storage: ask the browser not to evict IndexedDB/localStorage ───
// Without this, Safari/iOS can silently wipe all local data after ~7 days of
// site inactivity — fatal for a local-only notebook. Best-effort: Chromium
// decides silently from engagement, Firefox may prompt, unsupported → null.
export async function ensurePersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

// ─── Migration: import existing localStorage data on first run ───
export async function migrateFromLocalStorage() {
  const migrated = await db.settings.get('_migrated_from_ls');
  if (migrated) return; // Already migrated

  try {
    // Migrate settings
    const settingsKeys = [
      'biolab_lang', 'biolab_theme', 'labmate_onboardingDone',
      'labmate_lastExport', 'labmate_buffers_sidebar_hidden',
      'labmate_protocols_sidebar_hidden', 'labmate_inv_dashboard_dismissed'
    ];
    for (const fullKey of settingsKeys) {
      const val = localStorage.getItem(fullKey);
      if (val !== null) {
        await db.settings.put({ key: fullKey, value: val });
      }
    }

    // Migrate custom recipes
    try {
      const recipes = JSON.parse(localStorage.getItem('labmate_customRecipes') || '[]');
      if (recipes.length) await db.customRecipes.bulkPut(recipes);
    } catch { /* ignore parse errors */ }

    // Migrate custom protocols
    try {
      const protocols = JSON.parse(localStorage.getItem('labmate_customProtocols') || '[]');
      if (protocols.length) await db.customProtocols.bulkPut(protocols);
    } catch { /* ignore parse errors */ }

    // Migrate inventory
    try {
      const inv = localStorage.getItem('labmate_inventory');
      if (inv) await db.inventory.put({ key: 'data', value: JSON.parse(inv) });
    } catch { /* ignore parse errors */ }

    // Migrate favorites
    try {
      const favs = localStorage.getItem('biolab_favorites');
      if (favs) await db.favorites.put({ key: 'list', value: JSON.parse(favs) });
      const recent = localStorage.getItem('biolab_recent');
      if (recent) await db.favorites.put({ key: 'recent', value: JSON.parse(recent) });
    } catch { /* ignore parse errors */ }

    // Migrate step progress
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('stepTracker_')) {
        try {
          const recipeId = key.replace('stepTracker_', '');
          const steps = JSON.parse(localStorage.getItem(key));
          await db.stepProgress.put({ recipeId, completedSteps: steps });
        } catch { /* ignore parse errors */ }
      }
    }

    await db.settings.put({ key: '_migrated_from_ls', value: 'true' });
    console.log('✅ Migrated localStorage → IndexedDB');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}
