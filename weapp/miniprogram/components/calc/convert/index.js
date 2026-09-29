// Unit conversion — volume, mass, length, temperature, pressure
// (web: UnitConversionCalc.jsx; the factors live in shared/calculators.js).
const langBehavior = require('../../../behaviors/lang');
const { unitConvert } = require('../../../shared/calculators.js');
const { cleanNumber } = require('../shared');

const CATEGORIES = [
  { id: 'volume', key: 'convertCatVolume', units: ['L', 'mL', 'µL', 'nL', 'fl oz', 'cup', 'pt', 'qt', 'gal'] },
  { id: 'mass', key: 'convertCatMass', units: ['kg', 'g', 'mg', 'µg', 'ng', 'lb', 'oz'] },
  { id: 'length', key: 'convertCatLength', units: ['m', 'cm', 'mm', 'µm', 'nm', 'in', 'ft', 'yd'] },
  { id: 'temperature', key: 'convertCatTemp', units: ['°C', '°F', 'K'] },
  { id: 'pressure', key: 'convertCatPressure', units: ['atm', 'Pa', 'kPa', 'bar', 'psi', 'mmHg', 'Torr'] },
];
const byId = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

function fmt(n) {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) < 0.0001 && n !== 0) return n.toExponential(4);
  if (Math.abs(n) >= 1e7) return n.toExponential(4);
  return parseFloat(n.toPrecision(8)).toString();
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    cats: CATEGORIES.map((c) => ({ id: c.id, key: c.key })),
    cat: 'volume',
    units: CATEGORIES[0].units,
    fromIdx: 1, // mL
    toIdx: 2, // µL
    value: '',
    result: '', // formatted, '' when there is no value
  },
  methods: {
    pickCategory(e) {
      const c = byId(e.currentTarget.dataset.id);
      this.setData({ cat: c.id, units: c.units, fromIdx: 0, toIdx: 1, value: '' });
      this.recalc();
    },
    onInput(e) {
      this.setData({ value: cleanNumber(e.detail.value) });
      this.recalc();
    },
    onFrom(e) { this.setData({ fromIdx: Number(e.detail.value) }); this.recalc(); },
    onTo(e) { this.setData({ toIdx: Number(e.detail.value) }); this.recalc(); },
    // The digit keypad has no minus key: ± flips the sign (temperatures).
    toggleSign() {
      const v = this.data.value;
      this.setData({ value: v.charAt(0) === '-' ? v.slice(1) : '-' + v });
      this.recalc();
    },
    // Swap direction and carry the converted value across, so the same
    // quantity reads the other way round (1.5 mL → 1500 µL becomes 1500 µL → 1.5 mL).
    swap() {
      const r = this.convert();
      const patch = { fromIdx: this.data.toIdx, toIdx: this.data.fromIdx };
      if (r !== null && Number.isFinite(r)) patch.value = fmt(r);
      this.setData(patch);
      this.recalc();
    },

    convert() {
      const { value, units, fromIdx, toIdx, cat } = this.data;
      const n = parseFloat(value);
      if (value === '' || Number.isNaN(n)) return null;
      return unitConvert(n, units[fromIdx], units[toIdx], cat);
    },
    recalc() {
      const r = this.convert();
      this.setData({ result: r === null ? '' : fmt(r) });
    },
  },
});
