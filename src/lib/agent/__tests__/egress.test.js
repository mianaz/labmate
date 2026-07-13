import { describe, it, expect } from 'vitest';
import { redactMessagesForEgress } from '../egress.js';

const inventoryResult = {
  count: 1,
  results: [{
    id: 100, name: 'TRIzol', sampleType: 'reagent',
    position: 'A1', box: 'Box1', location: '-80 A',
    quantity: '5 mL', concentration: '', tags: ['rna'],
  }],
};

describe('egress redaction', () => {
  it('redacts local (inventory) tool results before they leave the device', () => {
    const convo = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'where is my trizol' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', function: { name: 'queryInventory', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', name: 'queryInventory', content: JSON.stringify(inventoryResult) },
    ];
    const out = redactMessagesForEgress(convo);
    const s = out[3].content;
    // exact locations / quantities are stripped from the wire payload
    expect(s).not.toContain('Box1');
    expect(s).not.toContain('-80 A');
    expect(s).not.toContain('A1');
    expect(s).not.toContain('5 mL');
    // name + presence survive so the model can still reason
    const parsed = JSON.parse(s);
    expect(parsed.results[0].name).toBe('TRIzol');
    expect(parsed.results[0].inStock).toBe(true);
    expect(parsed._egress).toBe('redacted');
    // non-tool messages are passed through by reference (untouched)
    expect(out[0]).toBe(convo[0]);
    expect(out[1]).toBe(convo[1]);
  });

  it('passes shareable (library) tool results through unchanged', () => {
    const convo = [{ role: 'tool', tool_call_id: 'c2', name: 'getProtocol', content: JSON.stringify({ id: 'x', steps: ['a', 'b'] }) }];
    const out = redactMessagesForEgress(convo);
    expect(out[0]).toBe(convo[0]); // same reference — untouched
    expect(JSON.parse(out[0].content).steps).toEqual(['a', 'b']);
  });

  it('never mutates the input', () => {
    const original = JSON.stringify(inventoryResult);
    const orig = { role: 'tool', name: 'queryInventory', content: original };
    redactMessagesForEgress([orig]);
    expect(orig.content).toBe(original);
  });

  it('withholds a local tool result whose content is unparseable (fail-closed)', () => {
    const out = redactMessagesForEgress([{ role: 'tool', name: 'queryInventory', content: 'not json' }]);
    expect(JSON.parse(out[0].content)._egress).toBe('withheld');
  });
});
