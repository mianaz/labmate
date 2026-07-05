import { describe, it, expect } from 'vitest';
import { searchRecipes, getProtocol, queryInventory } from '../retrieval.js';
// Real library data — the acceptance fixture (searchRecipes must find trizol).
import recipes from '../../../../recipes.json';

describe('searchRecipes (real library)', () => {
  it('finds trizol_extraction by name query', () => {
    const hits = searchRecipes(recipes, 'trizol');
    expect(hits.some((h) => h.id === 'trizol_extraction')).toBe(true);
  });

  it('ranks exact/prefix name matches above tag matches', () => {
    const hits = searchRecipes(recipes, 'TRIzol RNA Extraction');
    expect(hits[0].id).toBe('trizol_extraction');
  });

  it('filters by category', () => {
    const hits = searchRecipes(recipes, '', { category: 'buffer', limit: 500 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.category === 'buffer')).toBe(true);
  });

  it('respects the limit', () => {
    expect(searchRecipes(recipes, '', { limit: 3 })).toHaveLength(3);
  });

  it('returns [] for non-array input', () => {
    expect(searchRecipes(null, 'x')).toEqual([]);
  });
});

describe('getProtocol', () => {
  it('returns normalized (non-blank) steps for a real protocol', () => {
    const p = getProtocol(recipes, 'trizol_extraction', 'en');
    expect(p).not.toBeNull();
    expect(p.steps.length).toBeGreaterThan(1);
    expect(p.steps.every((s) => s.trim().length > 0)).toBe(true);
  });

  it('returns null for an unknown id (no fabrication)', () => {
    expect(getProtocol(recipes, 'does_not_exist')).toBeNull();
  });
});

// ── inventory fixture ──────────────────────────────────────────────────────────
const inv = {
  locations: [{ id: 1, name: '-80 Freezer A' }, { id: 2, name: 'LN2 Tank' }],
  boxes: [
    { id: 10, name: 'Cell Lines Box 1', locationId: 1 },
    { id: 11, name: 'Primers', locationId: 2 },
  ],
  samples: [
    { id: 100, name: 'HEK293T', sampleType: 'cell_line', boxId: 10, position: 'A1', quantity: '500 uL', tags: ['validated'] },
    { id: 101, name: 'GAPDH fwd', sampleType: 'primer', boxId: 11, position: 'B3', concentration: '100 uM', tags: [] },
    { id: 102, name: 'HeLa', sampleType: 'cell_line', boxId: 10, position: 'C4', tags: ['frozen'] },
  ],
};

describe('queryInventory', () => {
  it('resolves a sample to its box and location', () => {
    const hits = queryInventory(inv, 'HEK293T');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      name: 'HEK293T', box: 'Cell Lines Box 1', location: '-80 Freezer A', position: 'A1',
    });
  });

  it('matches by sample type', () => {
    const hits = queryInventory(inv, 'cell_line');
    expect(hits.map((h) => h.name).sort()).toEqual(['HEK293T', 'HeLa']);
  });

  it('matches by tag', () => {
    expect(queryInventory(inv, 'frozen').map((h) => h.name)).toEqual(['HeLa']);
  });

  it('empty query returns all (capped by limit)', () => {
    expect(queryInventory(inv, '')).toHaveLength(3);
    expect(queryInventory(inv, '', { limit: 1 })).toHaveLength(1);
  });

  it('tolerates missing inventory shape', () => {
    expect(queryInventory(null, 'x')).toEqual([]);
    expect(queryInventory({}, '')).toEqual([]);
  });
});
