import { describe, it, expect } from 'vitest';
import { extractQuantities, findUngroundedQuantities } from '../grounding.js';

const norms = (arr) => arr.map((x) => x.toLowerCase().replace(/[\s,]/g, ''));

describe('grounding check', () => {
  it('extracts unit-bearing quantities, ratios and temps but ignores bare numbers', () => {
    const q = extractQuantities('Add 50 µL, spin 5 min at 37°C, dilute 1:1000, use 3 tubes.').map((x) => x.norm);
    expect(q).toContain('50µl');
    expect(q).toContain('5min');
    expect(q).toContain('37°c');
    expect(q).toContain('1:1000');
    expect(q).not.toContain('3'); // bare count ignored
  });

  it('does not let a single-char unit swallow a longer one (5min ≠ 5m)', () => {
    const q = extractQuantities('incubate 5 min').map((x) => x.norm);
    expect(q).toContain('5min');
    expect(q).not.toContain('5m');
  });

  it('flags quantities the model invented that no tool or user provided', () => {
    const source = 'user: extract RNA\ntool: {"steps":["Add TRIzol","Incubate 5 min at room temperature"]}';
    const assistant = 'Centrifuge at 12,000 rpm for 15 min, then incubate 5 min.';
    const ung = norms(findUngroundedQuantities(assistant, source));
    expect(ung).toContain('12000rpm'); // invented
    expect(ung).toContain('15min');    // invented
    expect(ung).not.toContain('5min'); // present in the tool result → grounded
  });

  it('treats formatting differences as grounded (50 µL vs 50µL)', () => {
    expect(findUngroundedQuantities('use 50µL', 'pipette 50 µL')).toEqual([]);
  });

  it('returns nothing for purely conversational text', () => {
    expect(findUngroundedQuantities('Sure, I can help you plan that with 3 timepoints.', 'anything')).toEqual([]);
  });
});
