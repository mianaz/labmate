// ═══════════════════════════════════════════════
// Inventory — Pure helpers, constants, CSV/JSON logic
// ═══════════════════════════════════════════════

import db from '../../lib/db.js';

const INV_KEY = 'labmate_inventory';

// ── Constants ────────────────────────────────────────────────────────────────

export const SAMPLE_TYPE_COLORS = {
  cell_line: { bg: 'var(--samp-cell-line-bg)', text: 'var(--samp-cell-line-text)' },
  plasmid:   { bg: 'var(--samp-plasmid-bg)', text: 'var(--samp-plasmid-text)' },
  antibody:  { bg: 'var(--samp-antibody-bg)', text: 'var(--samp-antibody-text)' },
  primer:    { bg: 'var(--samp-primer-bg)', text: 'var(--samp-primer-text)' },
  protein:   { bg: 'var(--samp-protein-bg)', text: 'var(--samp-protein-text)' },
  reagent:   { bg: 'var(--samp-reagent-bg)', text: 'var(--samp-reagent-text)' },
  tissue:    { bg: 'var(--samp-tissue-bg)', text: 'var(--samp-tissue-text)' },
  virus:     { bg: 'var(--samp-virus-bg)', text: 'var(--samp-virus-text)' },
  other:     { bg: 'var(--samp-other-bg)', text: 'var(--samp-other-text)' },
};

export const BOX_CONFIGS = [
  { type: 'cryo_81',  rows: 9,  cols: 9  },
  { type: 'cryo_100', rows: 10, cols: 10 },
  { type: 'tip',      rows: 8,  cols: 12 },
  { type: 'slide',    rows: 1,  cols: 25 },
  { type: 'tube',     rows: 4,  cols: 6  },
  { type: 'custom',   rows: 8,  cols: 8  },
];

export const STORAGE_ICONS = {
  freezer: 'M12 3v18M5.5 8l13-2M5.5 16l13-2',
  fridge:  'M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM4 12h16',
  shelf:   'M3 5h18M3 12h18M3 19h18',
  tank:    'M12 2a8 8 0 018 8v6a8 8 0 01-16 0v-6a8 8 0 018-8z',
  rack:    'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',
};

export const STORAGE_TYPE_LABELS = {
  freezer: 'invTypeFreezer',
  fridge:  'invTypeFridge',
  shelf:   'invTypeShelf',
  tank:    'invTypeTank',
  rack:    'invTypeRack',
};

export const BOX_TYPE_LABELS = {
  cryo_81:  'invBoxCryo81',
  cryo_100: 'invBoxCryo100',
  tip:      'invBoxTip',
  slide:    'invBoxSlide',
  tube:     'invBoxTube',
  custom:   'invBoxCustom',
};

export const SAMPLE_TYPE_LABELS = {
  cell_line: 'invSampleCellLine',
  plasmid:   'invSamplePlasmid',
  antibody:  'invSampleAntibody',
  primer:    'invSamplePrimer',
  protein:   'invSampleProtein',
  reagent:   'invSampleReagent',
  tissue:    'invSampleTissue',
  virus:     'invSampleVirus',
  other:     'invSampleOther',
};

export const VALID_SAMPLE_TYPES = new Set(Object.keys(SAMPLE_TYPE_LABELS));

// ── Button styles (shared across inventory components) ───────────────────────

export const invBtnStyle = {
  background: 'var(--primary)', color: 'var(--on-primary)', border: '2px solid var(--border-strong)',
  borderRadius: '0', cursor: 'pointer', padding: '8px 16px',
  fontSize: '14px', fontWeight: 700,
};
export const invBtnSecStyle = {
  background: 'var(--bg-2)', color: 'var(--text)',
  border: '2px solid var(--border-strong)', borderRadius: '0',
  cursor: 'pointer', padding: '8px 16px', fontSize: '14px',
};
export const invBtnDangerStyle = {
  background: 'var(--danger-border)', color: 'var(--on-danger)', border: '2px solid var(--border-strong)',
  borderRadius: '0', cursor: 'pointer', padding: '6px 12px',
  fontSize: '13px',
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function parseTags(str, sep = ',') {
  return str ? str.split(sep).map(s => s.trim()).filter(Boolean) : [];
}

export function normalizeSampleType(t) {
  return VALID_SAMPLE_TYPES.has(t) ? t : 'other';
}

export function loadInventory() {
  try {
    // Synchronous read from localStorage for instant first render
    const raw = localStorage.getItem(INV_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid inventory data');
    return parsed;
  } catch (e) {
    console.error('loadInventory: corrupted data:', e);
    alert(
      navigator.language.startsWith('zh')
        ? '库存数据已损坏，已重置为空。如有备份文件，请在工具页导入恢复。'
        : 'Inventory data was corrupted and has been reset. If you have a backup, import it from the Tools tab.'
    );
    return {};
  }
}

// Async version — reads from IndexedDB first, falls back to localStorage
export async function loadInventoryAsync() {
  try {
    const row = await db.inventory.get('data');
    if (row && row.value && typeof row.value === 'object') return row.value;
  } catch { /* fall through to localStorage */ }
  return loadInventory();
}

export function saveInventory(data) {
  // Write to localStorage (synchronous, immediate)
  try {
    localStorage.setItem(INV_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('saveInventory failed:', e);
    alert(
      navigator.language.startsWith('zh')
        ? '存储空间已满，无法保存库存数据。请先在工具页导出备份，然后清理浏览器数据。'
        : 'Storage quota exceeded — inventory data could not be saved. Please export a backup from the Tools tab and clear browser data.'
    );
  }
  // Also write to IndexedDB in the background
  db.inventory.put({ key: 'data', value: data }).catch((err) => {
    console.warn('saveInventory IndexedDB write failed:', err);
  });
}

export function getInvData() {
  const d = loadInventory();
  if (!d.locations) d.locations = [];
  if (!d.boxes) d.boxes = [];
  if (!d.samples) d.samples = [];
  if (!d.nextId) d.nextId = { locations: 1, boxes: 1, samples: 1 };
  return d;
}

export function nextInvId(data, type) {
  const id = data.nextId[type] || 1;
  data.nextId[type] = id + 1;
  return id;
}

export function posLabel(row, col) {
  return String.fromCharCode(65 + row) + (col + 1);
}

// ── CSV / Export helpers ─────────────────────────────────────────────────────

export function invExportAllCsv(data, lang) {
  const rows = [['Location', 'Box', 'Position', 'Name', 'Type', 'Quantity', 'Concentration', 'Passage', 'Date Stored', 'Expiry', 'Owner', 'Tags', 'Description', 'Notes']];
  data.samples.forEach(s => {
    const box = data.boxes.find(b => b.id === s.boxId);
    const loc = box ? data.locations.find(l => l.id === box.locationId) : null;
    rows.push([
      loc ? loc.name : '', box ? box.name : '', s.position || '', s.name || '',
      s.sampleType || '', s.quantity || '', s.concentration || '', s.passage || '',
      s.dateStored ? new Date(s.dateStored).toISOString().slice(0, 10) : '',
      s.expiryDate ? new Date(s.expiryDate).toISOString().slice(0, 10) : '',
      s.owner || '', (s.tags || []).join('; '), s.description || '', s.notes || '',
    ]);
  });
  return rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
}

export function invExportBoxCsv(data, boxId) {
  const box = data.boxes.find(b => b.id === boxId);
  if (!box) return '';
  const samples = data.samples.filter(s => s.boxId === boxId);
  const rows = [['Position', 'Name', 'Type', 'Quantity', 'Concentration', 'Passage', 'Date Stored', 'Expiry', 'Owner', 'Tags', 'Description', 'Notes']];
  samples.forEach(s => {
    rows.push([
      s.position || '', s.name || '', s.sampleType || '', s.quantity || '', s.concentration || '',
      s.passage || '', s.dateStored ? new Date(s.dateStored).toISOString().slice(0, 10) : '',
      s.expiryDate ? new Date(s.expiryDate).toISOString().slice(0, 10) : '',
      s.owner || '', (s.tags || []).join('; '), s.description || '', s.notes || '',
    ]);
  });
  return rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
}

export function invCsvTemplate() {
  return 'Position,Name,Type,Quantity,Concentration,Passage,Date Stored,Expiry,Owner,Tags,Description,Notes\nA1,HEK293T,cell_line,500 uL,,P5,2024-03-10,,John,frozen;validated,Human embryonic kidney cells,Passage 5 frozen stock\n';
}

export function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCsvImport(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += line[i]; }
    }
    cols.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.toLowerCase().replace(/\s+/g, '')] = (cols[i] || '').replace(/^"|"$/g, '');
    });
    return obj;
  });
}
