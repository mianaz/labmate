import { describe, it, expect } from 'vitest';
import { experimentToMarkdown, experimentFilename } from '../exportProtocol.js';

const entry = {
  id: 'exp_1720000000000_abc123',
  title: 'Test Run',
  titleZh: '测试',
  date: '2026-07-05',
  status: 'planned',
  priority: 'high',
  protocolRef: 'trizol_extraction',
  plan: { objectives: 'Extract RNA', notes: 'be quick' },
  materials: {
    reagents: [{ name: 'TRIzol', amount: 1, unit: 'mL', location: 'Bench' }],
    equipment: [{ name: 'Centrifuge', status: 'ready' }],
    checklist: [{ item: 'RNase-free tips', checked: true }],
  },
  procedure: {
    mode: 'template',
    protocolSteps: [
      { stepText: 'Add TRIzol', completed: true, deviation: '', actualParams: '' },
      { stepText: 'Incubate 5 min', completed: false, deviation: 'used 6 min', actualParams: '6 min' },
    ],
  },
  results: { summary: 'Good yield', dataProcessing: '', figures: [] },
};

describe('experimentToMarkdown', () => {
  it('renders title, zh subtitle, and metadata', () => {
    const md = experimentToMarkdown(entry);
    expect(md).toMatch(/^# Test Run\n/);
    expect(md).toContain('**测试**');
    expect(md).toContain('**Date:** 2026-07-05');
    expect(md).toContain('**Protocol:** trizol_extraction');
  });

  it('renders template steps as a numbered task list with deviations', () => {
    const md = experimentToMarkdown(entry);
    expect(md).toContain('1. [x] Add TRIzol');
    expect(md).toContain('2. [ ] Incubate 5 min');
    expect(md).toContain('**Deviation:** used 6 min');
    expect(md).toContain('**Actual:** 6 min');
  });

  it('renders reagents / equipment / checklist', () => {
    const md = experimentToMarkdown(entry);
    expect(md).toContain('- TRIzol: 1 mL (Bench)');
    expect(md).toContain('- [x] Centrifuge');
    expect(md).toContain('- [x] RNase-free tips');
  });

  it('falls back gracefully on an empty entry', () => {
    const md = experimentToMarkdown({});
    expect(md).toContain('# Untitled Experiment');
    expect(md).toContain('_None_');
  });

  it('uses freeText when procedure mode is not template', () => {
    const md = experimentToMarkdown({ procedure: { mode: 'freetext', freeText: 'just wing it' } });
    expect(md).toContain('just wing it');
  });
});

describe('experimentFilename', () => {
  it('builds a dated filename from the last 6 id chars', () => {
    expect(experimentFilename(entry)).toBe('experiment_2026-07-05_abc123.md');
  });

  it('has sensible defaults', () => {
    expect(experimentFilename({})).toBe('experiment_entry_entry.md');
  });
});
