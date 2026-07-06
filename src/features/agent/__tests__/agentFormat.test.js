import { describe, it, expect } from 'vitest';
import { parseInline, summarizeToolResult, toolLabel } from '../agentFormat.js';

describe('parseInline', () => {
  it('returns a single text token for plain text', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
  });
  it('parses **bold**', () => {
    expect(parseInline('a **b** c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', value: 'b' },
      { type: 'text', value: ' c' },
    ]);
  });
  it('parses `code`', () => {
    expect(parseInline('run `npm test`')).toEqual([
      { type: 'text', value: 'run ' },
      { type: 'code', value: 'npm test' },
    ]);
  });
  it('leaves an unmatched marker as literal text', () => {
    expect(parseInline('2 ** 3 = 8')).toEqual([{ type: 'text', value: '2 ** 3 = 8' }]);
  });
  it('handles empty input', () => {
    expect(parseInline('')).toEqual([]);
    expect(parseInline(null)).toEqual([]);
  });
});

describe('toolLabel', () => {
  it('localizes known tools', () => {
    expect(toolLabel('searchProtocols', 'en')).toBe('Searched library');
    expect(toolLabel('searchProtocols', 'zh')).toBe('检索方案库');
  });
  it('falls back to the raw name for unknown tools', () => {
    expect(toolLabel('mysteryTool', 'en')).toBe('mysteryTool');
  });
});

describe('summarizeToolResult', () => {
  it('summarizes a search hit with query + names (tone ok)', () => {
    const s = summarizeToolResult('searchProtocols', { query: 'trizol' },
      { count: 2, results: [{ name: 'TRIzol RNA Extraction' }, { name: 'RNA cleanup' }] }, 'en');
    expect(s.tone).toBe('ok');
    expect(s.title).toBe('Searched library');
    expect(s.lines[0]).toContain('trizol');
    expect(s.lines[0]).toContain('2');
    expect(s.lines[1]).toContain('TRIzol RNA Extraction');
  });

  it('marks a zero-result search as muted', () => {
    const s = summarizeToolResult('searchProtocols', { query: 'zzz' }, { count: 0, results: [] }, 'en');
    expect(s.tone).toBe('muted');
  });

  it('treats permission_denied as a muted non-failure', () => {
    const s = summarizeToolResult('createExperiment', {}, { error: 'permission_denied' }, 'en');
    expect(s.tone).toBe('muted');
    expect(s.lines[0].toLowerCase()).toContain('permission');
  });

  it('flags an invented protocol id as an error', () => {
    const s = summarizeToolResult('createExperiment', { protocolRef: 'made_up' },
      { error: 'unknown_protocolRef', protocolRef: 'made_up' }, 'en');
    expect(s.tone).toBe('error');
  });

  it('treats not_found (no fabrication) as muted', () => {
    const s = summarizeToolResult('getProtocol', { id: 'nope' }, { error: 'not_found' }, 'en');
    expect(s.tone).toBe('muted');
  });

  it('summarizes a created experiment with its title', () => {
    const s = summarizeToolResult('createExperiment', { title: 'My Prep' },
      { id: 'exp_1', title: 'My Prep', date: '2026-07-09', status: 'planned' }, 'en');
    expect(s.tone).toBe('ok');
    expect(s.lines[0]).toContain('My Prep');
    expect(s.lines[0]).toContain('2026-07-09');
  });

  it('summarizes a calculator run compactly', () => {
    const s = summarizeToolResult('runCalculator', { kind: 'dilution' },
      { kind: 'dilution', result: { stockVolume: 5, diluentVolume: 45 } }, 'en');
    expect(s.title.toLowerCase()).toContain('dilution');
    expect(s.lines[0]).toContain('stockVolume: 5');
  });

  it('summarizes scheduled timepoints with dates', () => {
    const s = summarizeToolResult('scheduleCalendarEvent', { title: 'X' },
      { created: 2, events: [{ id: 'a', date: '2026-07-09' }, { id: 'b', date: '2026-07-11' }] }, 'en');
    expect(s.tone).toBe('ok');
    expect(s.lines[0]).toContain('2');
    expect(s.lines[1]).toContain('2026-07-09');
  });
});
