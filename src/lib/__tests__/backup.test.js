import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom has no IndexedDB — mock the Dexie surface backup.js touches (same
// pattern as experiments.test.js).
vi.mock('../db.js', () => {
  const mk = () => {
    const m = new Map();
    return {
      async put(r) { m.set(r.id ?? r.key ?? r.name, r); },
      async get(k) { return m.get(k); },
      async toArray() { return [...m.values()]; },
      async bulkPut(rs) { rs.forEach((r) => m.set(r.id ?? r.key ?? r.name, r)); },
      async clear() { m.clear(); },
      async delete(k) { m.delete(k); },
      _m: m,
    };
  };
  return {
    default: {
      experiments: mk(), settings: mk(), customRecipes: mk(), customProtocols: mk(),
      inventory: mk(), stepProgress: mk(), favorites: mk(), credentials: mk(), evidenceMaps: mk(),
    },
  };
});

// A minimal, self-contained localStorage (the jsdom one isn't reliably clearable here).
function installLocalStorage() {
  const m = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => { m.clear(); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  });
}

const { collectBackupData, importBackup } = await import('../backup.js');
const { default: db } = await import('../db.js');

beforeEach(() => { installLocalStorage(); });

describe('backup secret guard', () => {
  it('collectBackupData keeps normal keys but excludes secret-shaped ones', () => {
    localStorage.setItem('labmate_theme', 'dark');
    localStorage.setItem('labmate_onboardingDone', 'true');
    localStorage.setItem('labmate_openrouter_key', 'sk-SECRET');   // BYO key
    localStorage.setItem('labmate_notion_token', 'tok-SECRET');    // OAuth token
    localStorage.setItem('labmate_api_secret', 'shh');

    const data = collectBackupData();

    expect(data).toHaveProperty('labmate_theme');
    expect(data).toHaveProperty('labmate_onboardingDone');
    expect(data).not.toHaveProperty('labmate_openrouter_key');
    expect(data).not.toHaveProperty('labmate_notion_token');
    expect(data).not.toHaveProperty('labmate_api_secret');
  });

  it('importBackup never restores a secret-shaped key', async () => {
    const backup = JSON.stringify({
      exportedAt: new Date().toISOString(),
      schemaVersion: 2,
      data: { labmate_theme: 'dark', labmate_openrouter_key: 'sk-SECRET', labmate_notion_token: 'tok' },
    });

    await importBackup(backup);

    expect(localStorage.getItem('labmate_theme')).toBe('dark');
    expect(localStorage.getItem('labmate_openrouter_key')).toBeNull();
    expect(localStorage.getItem('labmate_notion_token')).toBeNull();
  });

  it('does not false-positive on ordinary keys containing "key"/"monkey"', () => {
    localStorage.setItem('labmate_keyboard_hint', '1'); // "keyboard" — not a secret
    localStorage.setItem('labmate_monkey', '1');        // substring, not a segment
    const data = collectBackupData();
    expect(data).toHaveProperty('labmate_keyboard_hint');
    expect(data).toHaveProperty('labmate_monkey');
  });
});

describe('backup device-local state', () => {
  it('leaves running timers out of exports and ignores them on import', async () => {
    localStorage.setItem('labmate_timers', JSON.stringify([{ id: 1, label: 'Blocking', totalSeconds: 60, running: true, endsAt: 1 }]));
    localStorage.setItem('labmate_theme', 'dark');
    expect(collectBackupData()).not.toHaveProperty('labmate_timers');

    localStorage.removeItem('labmate_timers');
    await importBackup(JSON.stringify({
      exportedAt: new Date().toISOString(),
      schemaVersion: 2,
      data: { labmate_theme: 'light', labmate_timers: [{ id: 2, label: 'Old', totalSeconds: 60, running: true, endsAt: 1 }] },
    }));
    expect(localStorage.getItem('labmate_theme')).toBe('light');
    expect(localStorage.getItem('labmate_timers')).toBeNull();
  });
});

describe('backup: evidence maps', () => {
  it('restores evidence maps from a schemaVersion 3 file and skips malformed ones', async () => {
    const good = { id: 'emap_1', title: 'X', nodes: [{ id: 'n1', kind: 'claim', text: 'c' }], edges: [] };
    const messy = { id: 'emap_2', title: 'Y', nodes: [null, { id: 'n2', kind: 'claim', text: 'd' }], edges: [{ from: 'n2' }, null] };
    const backup = JSON.stringify({
      exportedAt: new Date().toISOString(),
      schemaVersion: 3,
      data: {},
      evidenceMaps: [good, messy, { id: 'emap_bad', title: 'no nodes' }, null],
    });
    const count = await importBackup(backup);
    expect(count).toBe(2);
    expect(await db.evidenceMaps.get('emap_1')).toEqual(good);
    const cleaned = await db.evidenceMaps.get('emap_2');
    expect(cleaned.nodes.map((n) => n.id)).toEqual(['n2']);
    expect(cleaned.edges).toEqual([]);
    expect(await db.evidenceMaps.get('emap_bad')).toBeUndefined();
  });
});
