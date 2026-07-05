import { describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../db.js', () => {
  const settings = new Map();
  const table = (m) => ({
    async put(rec) { m.set(rec.key, rec); return rec.key; },
    async get(key) { return m.get(key); },
  });
  return { default: { settings: table(settings), _settings: settings } };
});

const { DEFAULT_PERMISSIONS, WRITE_TOOLS, loadPermissions, savePermissions, setPermission } = await import('../permissions.js');
const { default: db } = await import('../../db.js');

describe('permissions', () => {
  beforeEach(() => { db._settings.clear(); });

  it('defaults every write tool to ask', async () => {
    const p = await loadPermissions();
    for (const t of WRITE_TOOLS) expect(p[t]).toBe('ask');
    expect(DEFAULT_PERMISSIONS.createExperiment).toBe('ask');
  });

  it('persists and reloads a change', async () => {
    await setPermission('createExperiment', 'auto');
    expect((await loadPermissions()).createExperiment).toBe('auto');
  });

  it('ignores unknown tools and invalid modes', async () => {
    await setPermission('notATool', 'auto');
    await setPermission('createExperiment', 'bogus');
    const p = await loadPermissions();
    expect(p.notATool).toBeUndefined();
    expect(p.createExperiment).toBe('ask'); // unchanged
  });

  it('sanitizes a partially-corrupt stored value', async () => {
    await db.settings.put({ key: 'agent_permissions', value: { createExperiment: 'auto', junk: 'x', exportProtocol: 'nope' } });
    const p = await loadPermissions();
    expect(p.createExperiment).toBe('auto');
    expect(p.exportProtocol).toBe('ask'); // invalid → default
    expect(p.junk).toBeUndefined();
  });

  it('savePermissions strips unknown keys', async () => {
    const saved = await savePermissions({ createExperiment: 'off', hacker: 'auto' });
    expect(saved.hacker).toBeUndefined();
    expect(saved.createExperiment).toBe('off');
  });
});
