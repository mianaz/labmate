// Saved plate layout — localStorage key `labmate_plate`. The labmate_ prefix
// puts it in backups (lib/backup.js), and the WeChat mini program stores the
// same shape under the same key, so a layout moves between the two apps.
// Pure; shared with the mini program (weapp/scripts/sync.mjs).
//
//   { plateType, wellData: { A1: { color, label } }, groups: [{ label, color, wells }],
//     colorIdx, useCustom, customColor }
import { PLATE_CONFIGS, WELL_COLORS, ROW_LABELS } from '../../data/plateConfigs.js';

export const PLATE_STORE_KEY = 'labmate_plate';

const DEFAULT_TYPE = 96;
const COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl)a?\([\d\s.,%]+\))$/i;
const HEX6_RE = /^#[0-9a-f]{6}$/i;

const safeColor = (c) => (COLOR_RE.test(String(c || '')) ? String(c) : WELL_COLORS[0]);

// "B12" → { r: 1, c: 11 }
function parseWellKey(key) {
  const r = ROW_LABELS.indexOf(String(key).charAt(0));
  const c = parseInt(String(key).slice(1), 10) - 1;
  return r >= 0 && c >= 0 ? { r, c } : null;
}

// Saved value (parsed JSON, possibly from an old or hand-edited backup) →
// a clean layout; anything unusable falls back to an empty 96-well plate.
export function loadPlateState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const plateType = PLATE_CONFIGS[s.plateType] ? Number(s.plateType) : DEFAULT_TYPE;
  const cfg = PLATE_CONFIGS[plateType];
  const wellData = {};
  if (s.wellData && typeof s.wellData === 'object') {
    Object.keys(s.wellData).forEach((key) => {
      const pos = parseWellKey(key);
      const d = s.wellData[key];
      if (!pos || pos.r >= cfg.rows || pos.c >= cfg.cols || !d || typeof d !== 'object') return;
      wellData[ROW_LABELS[pos.r] + (pos.c + 1)] = { color: safeColor(d.color), label: d.label == null ? '' : String(d.label) };
    });
  }
  const groups = (Array.isArray(s.groups) ? s.groups : [])
    .filter((g) => g && Array.isArray(g.wells))
    .map((g) => ({
      label: g.label == null ? '' : String(g.label),
      color: safeColor(g.color),
      wells: g.wells.map(String).filter((w) => wellData[w]),
    }))
    .filter((g) => g.wells.length > 0);
  return {
    plateType,
    wellData,
    groups,
    colorIdx: Number.isInteger(s.colorIdx) && s.colorIdx >= 0 ? s.colorIdx % WELL_COLORS.length : 0,
    useCustom: !!s.useCustom,
    customColor: HEX6_RE.test(s.customColor) ? s.customColor : '#ff0000',
  };
}

// In-memory layout → the stored value; null when there is nothing worth keeping
// (an untouched 96-well plate), so callers can remove the key instead.
export function toStoredPlate({ plateType, wellData, groups, colorIdx, useCustom, customColor }) {
  const empty = !wellData || Object.keys(wellData).length === 0;
  if (empty && Number(plateType) === DEFAULT_TYPE && !useCustom) return null;
  return {
    plateType: Number(plateType),
    wellData: wellData || {},
    groups: groups || [],
    colorIdx: ((Number(colorIdx) || 0) % WELL_COLORS.length + WELL_COLORS.length) % WELL_COLORS.length,
    useCustom: !!useCustom,
    customColor: customColor || '#ff0000',
  };
}
