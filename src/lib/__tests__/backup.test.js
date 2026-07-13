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
      inventory: mk(), stepProgress: mk(), favorites: mk(), credentials: mk(),
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
