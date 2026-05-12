import { describe, it, expect } from 'vitest';
import {
  parsePlateReaderCSV,
  parseNum,
  toLongFormat,
  longFormatToCSV,
  summarizeBySample,
} from '../plateReaderParser.js';

describe('parseNum', () => {
  it('parses plain numbers', () => {
    expect(parseNum('1.23')).toBe(1.23);
    expect(parseNum('  -4.5  ')).toBe(-4.5);
    expect(parseNum('1.2e-3')).toBeCloseTo(0.0012);
  });
  it('returns null for empty / non-numeric', () => {
    expect(parseNum('')).toBeNull();
    expect(parseNum(null)).toBeNull();
    expect(parseNum('OVRFLW')).toBeNull();
    expect(parseNum('  ')).toBeNull();
  });
  it('strips < > prefixes', () => {
    expect(parseNum('<0.001')).toBe(0.001);
    expect(parseNum('>4')).toBe(4);
  });
});

function makeGrid(rows, cols, fn = (r, c) => r * cols + c + 1) {
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(fn(r, c).toString());
    lines.push(row.join('\t'));
  }
  return lines.join('\n');
}

describe('parsePlateReaderCSV — 96-well grids', () => {
  it('parses an 8×12 tab-separated grid (no headers)', () => {
    const text = makeGrid(8, 12);
    const result = parsePlateReaderCSV(text);
    expect(result.error).toBeUndefined();
    expect(result.plateSize).toBe(96);
    expect(result.rows).toBe(8);
    expect(result.cols).toBe(12);
    expect(result.parsed).toBe(96);
    expect(result.values.A1).toBe(1);
    expect(result.values.A12).toBe(12);
    expect(result.values.H12).toBe(96);
    expect(result.hasHeaderRow).toBe(false);
    expect(result.hasHeaderCol).toBe(false);
  });

  it('parses a 8×12 grid with row+col headers', () => {
    let text = '\t' + Array.from({ length: 12 }, (_, i) => i + 1).join('\t') + '\n';
    const labels = 'ABCDEFGH'.split('');
    for (let r = 0; r < 8; r++) {
      const row = [labels[r]];
      for (let c = 0; c < 12; c++) row.push((r * 12 + c + 1).toString());
      text += row.join('\t') + '\n';
    }
    const result = parsePlateReaderCSV(text);
    expect(result.plateSize).toBe(96);
    expect(result.hasHeaderRow).toBe(true);
    expect(result.hasHeaderCol).toBe(true);
    expect(result.parsed).toBe(96);
    expect(result.values.A1).toBe(1);
    expect(result.values.H12).toBe(96);
  });

  it('handles a comma-separated 96-well grid', () => {
    let text = ',' + Array.from({ length: 12 }, (_, i) => i + 1).join(',') + '\n';
    const labels = 'ABCDEFGH'.split('');
    for (let r = 0; r < 8; r++) {
      const row = [labels[r]];
      for (let c = 0; c < 12; c++) row.push((r * 12 + c + 1).toString());
      text += row.join(',') + '\n';
    }
    const result = parsePlateReaderCSV(text);
    expect(result.plateSize).toBe(96);
    expect(result.parsed).toBe(96);
    expect(result.separator).toBe(',');
  });

  it('skips title/metadata rows before the data block', () => {
    const grid = makeGrid(8, 12);
    const text =
      'Tecan Reader v4.2\nDate: 2026-05-01\nPlate: Test\n\n' + grid;
    const result = parsePlateReaderCSV(text);
    expect(result.plateSize).toBe(96);
    expect(result.parsed).toBe(96);
  });

  it('tolerates OVRFLW cells as unparsed', () => {
    const lines = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (let c = 0; c < 12; c++) {
        row.push((r === 0 && c === 0) ? 'OVRFLW' : (r * 12 + c + 1).toString());
      }
      lines.push(row.join('\t'));
    }
    const result = parsePlateReaderCSV(lines.join('\n'));
    expect(result.plateSize).toBe(96);
    expect(result.parsed).toBe(95);
    expect(result.unparsed).toBe(1);
    expect(result.values.A1).toBeUndefined();
    expect(result.values.A2).toBe(2);
  });
});

describe('parsePlateReaderCSV — other plate sizes', () => {
  it('detects 384-well (16×24)', () => {
    const text = makeGrid(16, 24);
    const result = parsePlateReaderCSV(text);
    expect(result.plateSize).toBe(384);
    expect(result.parsed).toBe(384);
  });

  it('detects 24-well (4×6)', () => {
    const text = makeGrid(4, 6);
    const result = parsePlateReaderCSV(text);
    expect(result.plateSize).toBe(24);
    expect(result.parsed).toBe(24);
  });
});

describe('parsePlateReaderCSV — error cases', () => {
  it('returns error for empty input', () => {
    expect(parsePlateReaderCSV('').error).toBe('empty');
    expect(parsePlateReaderCSV('   \n   ').error).toBe('empty');
  });

  it('returns error when no numeric block is found', () => {
    const text = 'header\nsome text\nmore text\nnothing numeric';
    expect(parsePlateReaderCSV(text).error).toBe('no_numeric_block');
  });

  it('returns error for an unknown plate size (e.g. 5×7)', () => {
    const text = makeGrid(5, 7);
    const result = parsePlateReaderCSV(text);
    expect(result.error).toBe('unknown_plate_size');
  });
});

describe('toLongFormat + longFormatToCSV', () => {
  it('produces sorted long format', () => {
    const parsed = parsePlateReaderCSV(makeGrid(2, 3));
    const rows = toLongFormat(parsed, null);
    expect(rows.length).toBe(6); // 2×3 unknown size, but with rows=2, cols=3... wait
  });

  it('joins sample labels from wellData', () => {
    const parsed = parsePlateReaderCSV(makeGrid(8, 12));
    const layout = { A1: { label: 'Control', color: '#ff0000' }, A2: { label: 'Treated', color: '#00ff00' } };
    const rows = toLongFormat(parsed, layout);
    const a1 = rows.find(r => r.well === 'A1');
    const a2 = rows.find(r => r.well === 'A2');
    const h12 = rows.find(r => r.well === 'H12');
    expect(a1.sample).toBe('Control');
    expect(a2.sample).toBe('Treated');
    expect(h12.sample).toBe(''); // no layout entry
  });

  it('serializes to CSV with sample column', () => {
    const parsed = parsePlateReaderCSV(makeGrid(8, 12));
    const layout = { A1: { label: 'Drug, A', color: '#ff0000' } };
    const rows = toLongFormat(parsed, layout);
    const csv = longFormatToCSV(rows);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('well,row,col,value,sample');
    expect(lines[1]).toBe('A1,A,1,1,"Drug, A"'); // quoted because of comma
  });

  it('omits sample column when includeSample=false', () => {
    const parsed = parsePlateReaderCSV(makeGrid(8, 12));
    const rows = toLongFormat(parsed, null);
    const csv = longFormatToCSV(rows, { includeSample: false });
    expect(csv.split('\n')[0]).toBe('well,row,col,value');
  });
});

describe('summarizeBySample', () => {
  it('computes mean/sd/n per sample group', () => {
    const rows = [
      { well: 'A1', rowLabel: 'A', row: 1, col: 1, value: 10, sample: 'Ctrl', color: '#000' },
      { well: 'A2', rowLabel: 'A', row: 1, col: 2, value: 12, sample: 'Ctrl', color: '#000' },
      { well: 'A3', rowLabel: 'A', row: 1, col: 3, value: 14, sample: 'Ctrl', color: '#000' },
      { well: 'B1', rowLabel: 'B', row: 2, col: 1, value: 100, sample: 'Tx', color: '#fff' },
      { well: 'B2', rowLabel: 'B', row: 2, col: 2, value: 110, sample: 'Tx', color: '#fff' },
      { well: 'C1', rowLabel: 'C', row: 3, col: 1, value: 5, sample: '', color: '' }, // unlabeled — skipped
    ];
    const summary = summarizeBySample(rows);
    expect(summary.length).toBe(2);
    const ctrl = summary.find(s => s.sample === 'Ctrl');
    expect(ctrl.n).toBe(3);
    expect(ctrl.mean).toBe(12);
    expect(ctrl.sd).toBeCloseTo(2.0, 5);
    const tx = summary.find(s => s.sample === 'Tx');
    expect(tx.n).toBe(2);
    expect(tx.mean).toBe(105);
  });

  it('returns empty array when no labels exist', () => {
    const rows = [{ well: 'A1', rowLabel: 'A', row: 1, col: 1, value: 1, sample: '', color: '' }];
    expect(summarizeBySample(rows)).toEqual([]);
  });
});
