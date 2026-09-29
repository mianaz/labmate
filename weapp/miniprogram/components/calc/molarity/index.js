// Molarity calculator — C = m / (MW × V) (web: MolarityCalc.jsx).
const langBehavior = require('../../../behaviors/lang');
const { molarityCalc, formatConcentration } = require('../../../shared/calculators.js');
const { num, cleanNumber } = require('../shared');

const MASS_UNITS = ['g', 'mg', 'µg'];
const VOL_UNITS = ['L', 'mL', 'µL'];

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    massUnits: MASS_UNITS,
    volUnits: VOL_UNITS,
    mass: '',
    mw: '',
    vol: '',
    massIdx: 0,
    volIdx: 1,
    value: '',
    unit: '',
    sub: '',
  },
  methods: {
    onInput(e) {
      const f = e.currentTarget.dataset.field;
      this.setData({ [f]: cleanNumber(e.detail.value) });
      this.recalc();
    },
    onMassUnit(e) { this.setData({ massIdx: Number(e.detail.value) }); this.recalc(); },
    onVolUnit(e) { this.setData({ volIdx: Number(e.detail.value) }); this.recalc(); },

    recalc() {
      const { mass, mw, vol, massIdx, volIdx } = this.data;
      const m = molarityCalc({ mass: num(mass), mw: num(mw), vol: num(vol), massUnit: MASS_UNITS[massIdx], volUnit: VOL_UNITS[volIdx] });
      const ok = m !== null && Number.isFinite(m);
      const fc = ok ? formatConcentration(m) : null;
      this.setData({
        value: fc ? fc.val : '',
        unit: fc ? fc.unit : '',
        sub: ok ? '= ' + m.toExponential(4) + ' M' : '',
      });
    },
  },
});
