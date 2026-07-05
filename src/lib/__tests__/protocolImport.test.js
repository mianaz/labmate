import { describe, it, expect } from 'vitest';
import {
  normalizeProtocolSteps,
  toProcedureSteps,
  toReagents,
  recipeTitle,
} from '../protocolImport.js';

// Mirrors the real recipes.json shape: briefSteps is a single "→"-joined
// summary line; detailedSteps is the true per-step list with localized objects
// and section headers (isHeader:true).
const libraryProtocol = {
  id: 'demo_protocol',
  name: 'Demo Protocol',
  nameCn: '演示方案',
  category: 'protocol',
  briefSteps: [{ en: 'A → B → C', zh: '甲 → 乙 → 丙' }],
  detailedSteps: [
    { en: 'Prep Stage', zh: '准备阶段', isHeader: true },
    { en: 'Dissolve reagent in 10 mL buffer', zh: '将试剂溶于 10 mL 缓冲液', time: '5 min' },
    { en: 'Incubate at 37°C for 1 h', zh: '37°C 孵育 1 小时' },
    { en: 'Cleanup Stage', zh: '清理阶段', isHeader: true },
    { en: 'Wash twice with PBS', zh: '用 PBS 洗两次' },
  ],
  materials: [
    { name: 'Tris-HCl', amount: 10, unit: 'mL' },
    { name: 'NaCl', amount: 5, unit: 'g' },
  ],
};

// Custom recipes author briefSteps as plain strings and have no detailedSteps.
const customRecipe = {
  id: 'my_custom',
  name: 'My Custom',
  nameCn: '我的自定义',
  briefSteps: ['Mix everything', 'Vortex 30 s', 'Spin down'],
};

describe('normalizeProtocolSteps', () => {
  it('uses detailedSteps and drops section headers', () => {
    const steps = normalizeProtocolSteps(libraryProtocol, 'en');
    expect(steps).toEqual([
      'Dissolve reagent in 10 mL buffer',
      'Incubate at 37°C for 1 h',
      'Wash twice with PBS',
    ]);
    // headers excluded → 3 action steps, not 5
    expect(steps).toHaveLength(3);
  });

  it('localizes to Chinese', () => {
    const steps = normalizeProtocolSteps(libraryProtocol, 'zh');
    expect(steps[0]).toBe('将试剂溶于 10 mL 缓冲液');
    expect(steps).toHaveLength(3);
  });

  it('never yields blank steps (regression: {en,zh} read as s.text)', () => {
    const steps = normalizeProtocolSteps(libraryProtocol, 'en');
    expect(steps.every((s) => s.trim().length > 0)).toBe(true);
    // the old code produced a single '' step from briefSteps — guard against it
    expect(steps).not.toContain('');
  });

  it('falls back to briefSteps for custom recipes (plain strings)', () => {
    const steps = normalizeProtocolSteps(customRecipe, 'en');
    expect(steps).toEqual(['Mix everything', 'Vortex 30 s', 'Spin down']);
  });

  it('returns [] for null / empty recipes', () => {
    expect(normalizeProtocolSteps(null)).toEqual([]);
    expect(normalizeProtocolSteps({})).toEqual([]);
  });
});

describe('toProcedureSteps', () => {
  it('wraps steps in the experiment procedure shape', () => {
    const steps = toProcedureSteps(libraryProtocol, 'en');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({
      stepText: 'Dissolve reagent in 10 mL buffer',
      completed: false,
      deviation: '',
      actualParams: '',
    });
  });
});

describe('toReagents', () => {
  it('maps materials to reagent records', () => {
    const reagents = toReagents(libraryProtocol);
    expect(reagents).toHaveLength(2);
    expect(reagents[0]).toEqual({
      name: 'Tris-HCl', amount: 10, unit: 'mL', location: '', inventoryRef: null,
    });
  });

  it('tolerates missing materials', () => {
    expect(toReagents({})).toEqual([]);
    expect(toReagents(null)).toEqual([]);
  });
});

describe('recipeTitle', () => {
  it('returns nameCn in zh, name in en (regression: field is nameCn not nameZh)', () => {
    expect(recipeTitle(libraryProtocol, 'zh')).toBe('演示方案');
    expect(recipeTitle(libraryProtocol, 'en')).toBe('Demo Protocol');
  });

  it('falls back to English name when nameCn is absent', () => {
    expect(recipeTitle({ name: 'Only English' }, 'zh')).toBe('Only English');
  });
});
