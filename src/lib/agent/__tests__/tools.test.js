import { describe, it, expect } from 'vitest';
import recipes from '../../../../recipes.json';
import {
  TOOLS, getToolSchemas, isWriteTool, previewTool, executeTool,
} from '../tools.js';

// Fake ctx: in-memory experiment store + inventory fixture + download capture.
function makeCtx(overrides = {}) {
  const store = new Map();
  const downloads = [];
  return {
    recipes,
    lang: 'en',
    async loadInventory() {
      return {
        locations: [{ id: 1, name: '-80 A' }],
        boxes: [{ id: 10, name: 'Box1', locationId: 1 }],
        samples: [{ id: 100, name: 'TRIzol', sampleType: 'reagent', boxId: 10, position: 'A1', tags: [] }],
      };
    },
    async saveExperiment(entry) {
      const id = entry.id || `exp_${store.size + 1}`;
      const rec = { ...entry, id, status: entry.status || 'planned' };
      store.set(id, rec);
      return rec;
    },
    async getExperiment(id) { return store.get(id); },
    download(text, filename, mime) { downloads.push({ text, filename, mime }); },
    _store: store,
    _downloads: downloads,
    ...overrides,
  };
}

describe('registry surface', () => {
  it('exposes function schemas for every tool', () => {
    const schemas = getToolSchemas();
    expect(schemas).toHaveLength(Object.keys(TOOLS).length);
    expect(schemas.every((s) => s.type === 'function' && s.function?.name && s.function?.parameters)).toBe(true);
  });

  it('marks only mutating tools as writes', () => {
    expect(isWriteTool('createExperiment')).toBe(true);
    expect(isWriteTool('scheduleCalendarEvent')).toBe(true);
    expect(isWriteTool('exportProtocol')).toBe(true);
    expect(isWriteTool('searchProtocols')).toBe(false);
    expect(isWriteTool('runCalculator')).toBe(false);
  });

  it('unknown tool → structured error, never throws', async () => {
    await expect(executeTool('nope', {}, makeCtx())).resolves.toEqual({ error: 'unknown_tool', name: 'nope' });
  });
});

describe('read tools', () => {
  it('searchProtocols finds trizol', async () => {
    const r = await executeTool('searchProtocols', { query: 'trizol' }, makeCtx());
    expect(r.results.some((h) => h.id === 'trizol_extraction')).toBe(true);
  });

  it('getProtocol returns normalized steps and strips the raw recipe', async () => {
    const r = await executeTool('getProtocol', { id: 'trizol_extraction' }, makeCtx());
    expect(r.error).toBeUndefined();
    expect(r.recipe).toBeUndefined();
    expect(r.steps.length).toBeGreaterThan(1);
  });

  it('getProtocol unknown id → not_found', async () => {
    const r = await executeTool('getProtocol', { id: 'ghost' }, makeCtx());
    expect(r.error).toBe('not_found');
  });

  it('queryInventory resolves box + location', async () => {
    const r = await executeTool('queryInventory', { name: 'TRIzol' }, makeCtx());
    expect(r.count).toBe(1);
    expect(r.results[0]).toMatchObject({ box: 'Box1', location: '-80 A', position: 'A1' });
  });
});

describe('runCalculator', () => {
  it('dispatches dilution (object args)', async () => {
    const r = await executeTool('runCalculator', { kind: 'dilution', args: { c1: 10, c2: 1, v2: 100, solveFor: 'v1' } }, makeCtx());
    expect(r.result.val).toBeCloseTo(10, 4);
  });

  it('dispatches gel (positional args)', async () => {
    const r = await executeTool('runCalculator', { kind: 'gel', args: { percentage: 10, totalVolume: 10, type: 'resolving' } }, makeCtx());
    expect(r.kind).toBe('gel');
    expect(r.result).toBeTruthy();
  });

  it('unknown kind → error', async () => {
    const r = await executeTool('runCalculator', { kind: 'bogus', args: {} }, makeCtx());
    expect(r.error).toBe('unknown_calculator');
  });
});

describe('write tools', () => {
  it('createExperiment persists a record with verbatim steps', async () => {
    const ctx = makeCtx();
    const r = await executeTool('createExperiment', {
      title: 'RNA prep', protocolRef: 'trizol_extraction', date: '2026-07-06',
      steps: ['Add TRIzol', 'Incubate 5 min'], reagents: [{ name: 'TRIzol', amount: '1', unit: 'mL' }],
    }, ctx);
    expect(r.id).toBeTruthy();
    const saved = ctx._store.get(r.id);
    expect(saved.procedure.mode).toBe('template');
    expect(saved.procedure.protocolSteps.map((s) => s.stepText)).toEqual(['Add TRIzol', 'Incubate 5 min']);
    expect(saved.materials.reagents[0].name).toBe('TRIzol');
  });

  it('createExperiment rejects an unknown protocolRef (retrieve-first)', async () => {
    const r = await executeTool('createExperiment', { title: 'x', protocolRef: 'made_up_id' }, makeCtx());
    expect(r.error).toBe('unknown_protocolRef');
  });

  it('scheduleCalendarEvent creates one record per occurrence', async () => {
    const ctx = makeCtx();
    const r = await executeTool('scheduleCalendarEvent', {
      title: 'qPCR timepoints', protocolRef: 'trizol_extraction',
      occurrences: [
        { date: '2026-07-06', startTime: '09:00', label: '24h' },
        { date: '2026-07-07', label: '48h' },
        { date: '', label: 'skip-me' },
      ],
    }, ctx);
    expect(r.created).toBe(2); // blank date skipped
    expect(ctx._store.size).toBe(2);
  });

  it('exportProtocol renders markdown and triggers a download', async () => {
    const ctx = makeCtx();
    const { id } = await executeTool('createExperiment', { title: 'Exp', protocolRef: 'trizol_extraction' }, ctx);
    const r = await executeTool('exportProtocol', { experimentId: id }, ctx);
    expect(r.downloaded).toBe(true);
    expect(ctx._downloads).toHaveLength(1);
    expect(ctx._downloads[0].text).toContain('# Exp');
  });

  it('exportProtocol on a missing id → not_found', async () => {
    const r = await executeTool('exportProtocol', { experimentId: 'nope' }, makeCtx());
    expect(r.error).toBe('not_found');
  });

  it('previews describe write actions', () => {
    expect(previewTool('createExperiment', { title: 'T', steps: ['a', 'b'] })).toContain('Create notebook entry');
    expect(previewTool('searchProtocols', { query: 'x' })).toBe(''); // reads have no preview
  });
});
