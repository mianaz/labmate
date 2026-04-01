// DATA: Well Plate Configs

export const PLATE_CONFIGS = {
  6:   { rows: 2, cols: 3, wellSize: 56 },
  12:  { rows: 3, cols: 4, wellSize: 44 },
  24:  { rows: 4, cols: 6, wellSize: 36 },
  48:  { rows: 6, cols: 8, wellSize: 28 },
  96:  { rows: 8, cols: 12, wellSize: 22 },
  384: { rows: 16, cols: 24, wellSize: 14 },
};

export const WELL_COLORS = [
  '#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6',
  '#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1',
  '#a855f7','#84cc16','#e11d48','#0ea5e9','#d946ef',
  '#78716c','#0d9488','#b91c1c','#4338ca','#15803d',
  '#c2410c','#7e22ce','#0369a1','#a16207','#be185d',
];

export const ROW_LABELS = 'ABCDEFGHIJKLMNOP'.split('');
