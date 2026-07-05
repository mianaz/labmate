import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-in for the Dexie `db` (jsdom has no IndexedDB). Only the
// surface saveExperimentRecord touches is implemented.
vi.mock('../db.js', () => {
  const experiments = new Map();
  const settings = new Map();
  const table = (m) => ({
    async put(rec) { m.set(rec.id ?? rec.key, rec); return rec.id ?? rec.key; },
    async get(id) { return m.get(id); },
    async toArray() { return [...m.values()]; },
    async bulkPut(recs) { recs.forEach((r) => m.set(r.id ?? r.key, r)); },
    async delete(id) { m.delete(id); },
  });
  return { default: { experiments: table(experiments), settings: table(settings) } };
});

const { saveExperimentRecord } = await import('../experiments.js');
const { default: db } = await import('../db.js');

describe('saveExperimentRecord', () => {
  beforeEach(async () => {
    for (const e of await db.experiments.toArray()) await db.experiments.delete(e.id);
  });

  it('writes a record readable back via db.experiments.get', async () => {
    const saved = await saveExperimentRecord({ title: 'Agent-created', date: '2026-07-05' });
    expect(saved.id).toMatch(/^exp_/);
    const back = await db.experiments.get(saved.id);
    expect(back).toBeDefined();
    expect(back.title).toBe('Agent-created');
    expect(back.date).toBe('2026-07-05');
  });

  it('fills a valid default shape for a partial record', async () => {
    const saved = await saveExperimentRecord({ title: 'Sparse' });
    expect(saved.status).toBe('planned');
    expect(saved.materials).toBeDefined();
    expect(saved.procedure).toBeDefined();
    expect(saved.createdAt).toBeTypeOf('number');
    expect(saved.updatedAt).toBeTypeOf('number');
  });

  it('preserves a caller-supplied id (upsert) and bumps updatedAt', async () => {
    const first = await saveExperimentRecord({ id: 'exp_fixed', title: 'v1', createdAt: 111 });
    const second = await saveExperimentRecord({ id: 'exp_fixed', title: 'v2', createdAt: 111 });
    expect(second.id).toBe('exp_fixed');
    expect(second.createdAt).toBe(111);
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.createdAt);
    expect((await db.experiments.toArray()).filter((e) => e.id === 'exp_fixed')).toHaveLength(1);
    expect((await db.experiments.get('exp_fixed')).title).toBe('v2');
  });
});
