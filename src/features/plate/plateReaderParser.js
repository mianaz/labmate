// Pure parser for plate reader CSV/TSV exports.
// Handles Tecan/BioTek/SpectraMax-style grids (optionally with row/col headers).

import { ROW_LABELS, PLATE_CONFIGS } from '../../data/plateConfigs.js';

const PLATE_DIMS = Object.entries(PLATE_CONFIGS)
  .map(([size, cfg]) => ({ size: Number(size), rows: cfg.rows, cols: cfg.cols }))
  .sort((a, b) => a.size - b.size);

function detectSeparator(text) {
  const sample = text.split(/\r?\n/).slice(0, 20).join('\n');
  const counts = {
    '\t': (sample.match(/\t/g) || []).length,
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function parseNum(s) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  const m = t.replace(/[<>]/g, '').match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function isHeaderRow(cells, expectedCols) {
  let i = 0;
  while (i < cells.length && !String(cells[i]).trim()) i++;
  const trimmed = cells.slice(i).map(c => String(c).trim());
  if (trimmed.length < expectedCols) return false;
  let hits = 0;
  for (let k = 0; k < expectedCols; k++) {
    const m = trimmed[k].match(/^(?:col(?:umn)?\s*)?(\d+)$/i);
    if (m && parseInt(m[1], 10) === k + 1) hits++;
  }
  return hits >= Math.max(2, expectedCols - 1);
}

// Detect a row that's almost certainly a 1..N column header.
// Conservative: only fires when there's a leading empty/label cell — otherwise
// a row of consecutive integers is indistinguishable from real data.
function looksLikeColumnHeader(cells) {
  if (cells.length < 4) return false;
  const first = String(cells[0]).trim();
  // Must have a leading empty cell or a non-numeric cell that's not a row label
  // (a single letter A-P is a row label, not a sentinel of a header row).
  if (first !== '' && /^[A-P]$/i.test(first)) return false;
  if (first !== '' && parseNum(first) !== null) return false; // leading numeric → likely data
  const tail = cells.slice(1).map(c => String(c).trim());
  if (tail.length < 3) return false;
  let hits = 0;
  for (let k = 0; k < tail.length; k++) {
    const m = tail[k].match(/^(?:col(?:umn)?\s*)?(\d+)$/i);
    if (m && parseInt(m[1], 10) === k + 1) hits++;
  }
  return hits >= tail.length - 1;
}

function isHeaderColumn(rows, start, n) {
  let alphaHits = 0;
  let numHits = 0;
  for (let r = 0; r < n; r++) {
    const cell = String(rows[start + r]?.[0] || '').trim();
    if (/^[A-P]$/i.test(cell) && cell.toUpperCase() === ROW_LABELS[r]) alphaHits++;
    else if (parseInt(cell, 10) === r + 1) numHits++;
  }
  return alphaHits >= Math.max(2, n - 1) || numHits >= Math.max(2, n - 1);
}

export function parsePlateReaderCSV(text) {
  if (!text || !text.trim()) {
    return { error: 'empty', values: {}, plateSize: 0, rows: 0, cols: 0, parsed: 0, unparsed: 0 };
  }

  const sep = detectSeparator(text);
  const rows = text
    .split(/\r?\n/)
    .map(line => line.split(sep).map(c => c.trim()))
    .filter(row => row.some(c => c !== ''));

  if (rows.length === 0) {
    return { error: 'no_data', values: {}, plateSize: 0, rows: 0, cols: 0, parsed: 0, unparsed: 0 };
  }

  // Track which rows are "data-like" (>=40% cells numeric, length >= 2)
  const isDataRow = rows.map(row => {
    if (row.length < 2) return false;
    const nums = row.filter(c => parseNum(c) !== null).length;
    return nums / row.length >= 0.4 && nums >= 2;
  });

  // Pick longest contiguous run of data rows
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < rows.length; i++) {
    if (isDataRow[i]) {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  if (bestLen === 0) {
    return { error: 'no_numeric_block', values: {}, plateSize: 0, rows: 0, cols: 0, parsed: 0, unparsed: 0 };
  }

  // Peel header rows (1..N column labels) off the front of the block —
  // these otherwise get classified as data because their cells are numeric.
  let headerRowSeen = false;
  while (bestLen > 1 && looksLikeColumnHeader(rows[bestStart])) {
    bestStart++;
    bestLen--;
    headerRowSeen = true;
  }

  // Determine effective data width — mode of widths in the block
  const widths = rows.slice(bestStart, bestStart + bestLen).map(r => r.length);
  const widthCounts = widths.reduce((acc, w) => { acc[w] = (acc[w] || 0) + 1; return acc; }, {});
  const dataWidth = Number(Object.entries(widthCounts).sort((a, b) => b[1] - a[1])[0][0]);

  // Check for header column (col 0 in data rows is A,B,C... or 1,2,3...)
  const hasHeaderCol = isHeaderColumn(rows, bestStart, bestLen);
  const colOffset = hasHeaderCol ? 1 : 0;
  const valueCols = dataWidth - colOffset;

  // Match plate dimensions
  const candidate =
    PLATE_DIMS.find(p => p.cols === valueCols && p.rows === bestLen) ||
    PLATE_DIMS.find(p => p.cols === valueCols) ||
    PLATE_DIMS.find(p => p.rows === bestLen);

  if (!candidate) {
    return {
      error: 'unknown_plate_size',
      values: {}, plateSize: 0,
      rows: bestLen, cols: valueCols,
      parsed: 0, unparsed: 0,
    };
  }

  // Check for header row immediately above the data block, or the one we peeled
  const hasHeaderRow = headerRowSeen || (bestStart > 0 && isHeaderRow(rows[bestStart - 1], candidate.cols));

  // Build values, clamped to candidate dimensions
  const finalRows = Math.min(bestLen, candidate.rows);
  const finalCols = Math.min(valueCols, candidate.cols);
  const values = {};
  let parsed = 0;
  let unparsed = 0;
  for (let r = 0; r < finalRows; r++) {
    const row = rows[bestStart + r];
    for (let c = 0; c < finalCols; c++) {
      const raw = row[c + colOffset];
      const v = parseNum(raw);
      const key = ROW_LABELS[r] + (c + 1);
      if (v !== null) {
        values[key] = v;
        parsed++;
      } else if (raw !== undefined && raw !== '') {
        unparsed++;
      }
    }
  }

  return {
    plateSize: candidate.size,
    rows: candidate.rows,
    cols: candidate.cols,
    values,
    parsed,
    unparsed,
    hasHeaderRow,
    hasHeaderCol,
    separator: sep,
  };
}

// Convert parsed plate values + (optional) wellData layout to a long-format array.
export function toLongFormat(parsed, wellData) {
  const out = [];
  Object.entries(parsed.values).forEach(([well, value]) => {
    const rowLetter = well.charAt(0);
    const col = parseInt(well.slice(1), 10);
    const row = ROW_LABELS.indexOf(rowLetter) + 1;
    const layout = wellData ? wellData[well] : null;
    out.push({
      well,
      rowLabel: rowLetter,
      row,
      col,
      value,
      sample: layout?.label || '',
      color: layout?.color || '',
    });
  });
  return out.sort((a, b) => {
    if (a.rowLabel !== b.rowLabel) return a.rowLabel.localeCompare(b.rowLabel);
    return a.col - b.col;
  });
}

export function longFormatToCSV(rows, opts = {}) {
  const includeSample = opts.includeSample !== false;
  const headers = ['well', 'row', 'col', 'value'];
  if (includeSample) headers.push('sample');
  const lines = [headers.join(',')];
  for (const r of rows) {
    const cells = [r.well, r.rowLabel, r.col, r.value];
    if (includeSample) {
      const s = (r.sample || '').replace(/"/g, '""');
      cells.push(s.includes(',') || s.includes('"') ? `"${s}"` : s);
    }
    lines.push(cells.join(','));
  }
  return lines.join('\n') + '\n';
}

// Group long-format rows by sample label and compute mean/sd/n
export function summarizeBySample(longRows) {
  const groups = {};
  for (const r of longRows) {
    if (!r.sample) continue;
    if (!groups[r.sample]) groups[r.sample] = { sample: r.sample, color: r.color, values: [], wells: [] };
    groups[r.sample].values.push(r.value);
    groups[r.sample].wells.push(r.well);
  }
  return Object.values(groups).map(g => {
    const n = g.values.length;
    const mean = g.values.reduce((s, v) => s + v, 0) / n;
    const variance = n > 1 ? g.values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    const sd = Math.sqrt(variance);
    return { sample: g.sample, color: g.color, n, mean, sd, sem: n > 1 ? sd / Math.sqrt(n) : 0, wells: g.wells };
  }).sort((a, b) => a.sample.localeCompare(b.sample));
}
