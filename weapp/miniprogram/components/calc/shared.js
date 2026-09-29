// Helpers shared by the calculator components (components/calc/*). The maths
// lives in shared/calculators.js (generated from the web's src/lib/calculators.js).

const CONC_UNITS = ['M', 'mM', 'µM', 'nM', '%'];
const VOL_UNITS = ['L', 'mL', 'µL'];

// The web reads inputs with unary plus: '' → 0, junk → NaN.
function num(v) {
  return Number(v === undefined || v === null ? '' : v);
}

// What a phone keyboard types into a number field → a plain decimal string
// (some keyboards offer ',' or '。' as the decimal separator).
function cleanNumber(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[,，。]/g, '.')
    .replace(/\s+/g, '');
}

// "Final Volume (mL)" → { label: 'Final Volume', unit: 'mL' }, so the unit can
// be shown outside the uppercase label ("ML" would misread).
function splitUnit(text) {
  const m = /^(.*?)\s*[(（]([^)）]+)[)）]\s*$/.exec(String(text || ''));
  return m ? { label: m[1], unit: m[2] } : { label: String(text || ''), unit: '' };
}

// Bold runs for <text> segments in a notice: seg('a', true) …
function seg(k, t, b) {
  return { k: String(k), t: String(t), b: !!b };
}

module.exports = { CONC_UNITS, VOL_UNITS, num, cleanNumber, splitUnit, seg };
