import { describe, it, expect } from 'vitest';
import { buildICS, icsEntries, icsEscape, icsFold, experimentSpan } from '../ics.js';

const NOW = new Date(Date.UTC(2026, 9, 1, 8, 30, 0));
const base = { id: 'exp_1', date: '2026-10-02', startTime: '09:30', duration: 120, title: 'Western blot', status: 'planned' };
const lines = (ics) => ics.replace(/\r\n /g, '').split('\r\n'); // unfold

describe('icsEscape', () => {
  it('keeps line breaks as \\n instead of turning them into " n"', () => {
    expect(icsEscape('Confirm knockdown\nCompare with control')).toBe('Confirm knockdown\\nCompare with control');
  });

  it('escapes backslash, semicolon and comma per RFC 5545', () => {
    expect(icsEscape('a\\b; c, d')).toBe('a\\\\b\\; c\\, d');
    expect(icsEscape('x\r\ny\rz')).toBe('x\\ny\\nz');
  });
});

describe('icsFold', () => {
  it('folds lines over 75 octets without splitting multi-byte characters', () => {
    const line = 'DESCRIPTION:' + '蛋白质印迹检测'.repeat(10);
    const folded = icsFold(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((p, i) => {
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(' ')).toBe(true);
    });
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });

  it('leaves short lines alone', () => {
    expect(icsFold('SUMMARY:WB')).toBe('SUMMARY:WB');
  });
});

describe('experimentSpan', () => {
  it('rolls an experiment that runs past midnight into the next day', () => {
    const { start, end } = experimentSpan({ date: '2026-10-02', startTime: '23:00', duration: 120 });
    expect(start.getDate()).toBe(2);
    expect(end.getDate()).toBe(3);
    expect(end.getHours()).toBe(1);
  });

  it('falls back to 09:00 and 60 minutes', () => {
    const { start, end } = experimentSpan({ date: '2026-10-02', startTime: '', duration: { en: '2 days' } });
    expect(start.getHours()).toBe(9);
    expect((end - start) / 60000).toBe(60);
  });

  it('skips records without a usable date', () => {
    expect(experimentSpan({ date: 'someday' })).toBeNull();
  });
});

describe('buildICS', () => {
  it('writes a valid VEVENT', () => {
    const out = lines(buildICS([{ ...base, plan: { objectives: 'Confirm p53 knockdown\nCompare, contrast; repeat' } }], { now: NOW }));
    expect(out[0]).toBe('BEGIN:VCALENDAR');
    expect(out).toContain('UID:exp_1@labmate.bioinfospace.com');
    expect(out).toContain('DTSTAMP:20261001T083000Z');
    expect(out).toContain('DTSTART:20261002T093000');
    expect(out).toContain('DTEND:20261002T113000');
    expect(out).toContain('SUMMARY:Western blot');
    expect(out).toContain('DESCRIPTION:Confirm p53 knockdown\\nCompare\\, contrast\\; repeat');
    expect(out).toContain('STATUS:TENTATIVE');
    expect(out[out.length - 2]).toBe('END:VCALENDAR');
  });

  it('ends an overnight experiment on the next day (not at hour 25)', () => {
    const out = lines(buildICS([{ ...base, startTime: '23:30', duration: 120 }], { now: NOW }));
    expect(out).toContain('DTSTART:20261002T233000');
    expect(out).toContain('DTEND:20261003T013000');
  });

  it('uses the Chinese title when there is no English one and maps statuses', () => {
    const out = lines(buildICS([{ ...base, title: '', titleZh: '蛋白印迹', status: 'completed' }], { now: NOW }));
    expect(out).toContain('SUMMARY:蛋白印迹');
    expect(out).toContain('STATUS:CONFIRMED');
  });

  it('every physical line is at most 75 octets', () => {
    const ics = buildICS([{ ...base, plan: { objectives: '确认 p53 敲低效果并与对照组比较'.repeat(8) } }], { now: NOW });
    ics.split('\r\n').forEach((l) => expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75));
  });
});

describe('icsEntries', () => {
  it('filters by date range; an empty end date is open-ended', () => {
    const list = [{ id: 'a', date: '2026-09-30' }, { id: 'b', date: '2026-10-02' }, { id: 'c', date: '2027-01-01' }, { id: 'd' }];
    expect(icsEntries(list, '2026-10-01', '').map((e) => e.id)).toEqual(['b', 'c']);
    expect(icsEntries(list, '2026-10-01', '2026-12-31').map((e) => e.id)).toEqual(['b']);
  });
});
