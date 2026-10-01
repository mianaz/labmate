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
  it('createExperiment derives steps + reagents from the library, ignoring model-supplied content', async () => {
    const ctx = makeCtx();
    const lib = await executeTool('getProtocol', { id: 'trizol_extraction' }, ctx);
    const r = await executeTool('createExperiment', {
      title: 'RNA prep', protocolRef: 'trizol_extraction', date: '2026-07-06',
      // The model tries to smuggle fabricated protocol content — it MUST be ignored.
      steps: ['ZZZ fabricated step', 'ZZZ another'], reagents: [{ name: 'ZZZ fake reagent', amount: '1', unit: 'mL' }],
    }, ctx);
    expect(r.id).toBeTruthy();
    expect(r.source).toBe('library');
    const saved = ctx._store.get(r.id);
    expect(saved.procedure.mode).toBe('template');
    // Steps come from the curated library, never from the model's arguments.
    const stepTexts = saved.procedure.protocolSteps.map((s) => s.stepText);
    expect(stepTexts).toEqual(lib.steps);
    expect(stepTexts.some((s) => s.startsWith('ZZZ'))).toBe(false);
    // Reagents come from the library's materials, not the model's fake reagent.
    const reagentNames = saved.materials.reagents.map((x) => x.name);
    expect(reagentNames.length).toBeGreaterThan(0);
    expect(reagentNames).not.toContain('ZZZ fake reagent');
    expect(saved.provenance).toMatchObject({ source: 'library', verified: true });
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

  it('previews describe write actions with real library content', () => {
    const ctx = makeCtx();
    const p = previewTool('createExperiment', { title: 'T', protocolRef: 'trizol_extraction' }, ctx);
    expect(p).toContain('Create notebook entry');
    expect(p).toContain('step(s) from the library');
    expect(previewTool('searchProtocols', { query: 'x' })).toBe(''); // reads have no preview
  });
});

describe('splitIntoEvidenceMap (grounded split)', () => {
  const draft = 'X is upregulated in breast tumours (Smith et al., 2020). We think X promotes metastasis. Does X act through Y?';
  const ctxWith = (userText) => {
    const maps = [];
    return { ...makeCtx(), userText, async saveEvidenceMap(m) { maps.push(m); return m; }, _maps: maps };
  };

  it('is a write tool with a preview', () => {
    expect(isWriteTool('splitIntoEvidenceMap')).toBe(true);
    const p = previewTool('splitIntoEvidenceMap', { title: 'X', nodes: [{ kind: 'claim' }, { kind: 'claim' }, { kind: 'question' }] });
    expect(p).toContain('3 node(s)');
    expect(p).toContain('2 claims');
  });

  it('keeps nodes that quote the user and drops the rest, including invented references', async () => {
    const ctx = ctxWith(`Please split this:\n${draft}`);
    const r = await executeTool('splitIntoEvidenceMap', {
      title: 'X and metastasis',
      nodes: [
        { kind: 'evidence', text: 'X is upregulated in breast tumours.', quote: 'X is upregulated in breast tumours (Smith et al., 2020).', citation: 'Smith et al., 2020' },
        { kind: 'claim', text: 'X promotes metastasis.', quote: 'We think X  promotes metastasis.' }, // whitespace differs — still a match
        { kind: 'question', text: 'Does X act through Y?', quote: 'Does X act through Y?' },
        { kind: 'evidence', text: 'X knockout mice live longer.', quote: 'X knockout mice live longer.' }, // not in the user's text
        { kind: 'evidence', text: 'X binds Y.', quote: 'Does X act through Y?', citation: 'Jones 2019' }, // reference the user never gave
        { kind: 'experiment', text: 'Knock down X.', quote: 'We think X promotes metastasis.' }, // experiments are the user's call
      ],
    }, ctx);
    expect(r.created).toBe(4);
    expect(r.rejected).toBe(2);
    const map = ctx._maps[0];
    expect(map.edges).toEqual([]); // no links — the user connects them
    expect(map.nodes.map((n) => n.kind)).toEqual(['evidence', 'claim', 'question', 'evidence']);
    expect(map.nodes.every((n) => n.origin === 'ai' && n.reviewed === false)).toBe(true);
    expect(map.nodes[0]).toMatchObject({ citation: 'Smith et al., 2020', source: 'literature' });
    expect(map.nodes[3].citation).toBe('');
  });

  it('refuses when nothing is grounded or there is no user text', async () => {
    const none = await executeTool('splitIntoEvidenceMap', { title: 'T', nodes: [{ kind: 'claim', text: 'a', quote: 'made up' }] }, ctxWith(draft));
    expect(none.error).toBe('nothing_grounded');
    const empty = await executeTool('splitIntoEvidenceMap', { title: 'T', nodes: [{ kind: 'claim', text: 'a', quote: 'a' }] }, ctxWith(''));
    expect(empty.error).toBe('no_source');
  });
});
