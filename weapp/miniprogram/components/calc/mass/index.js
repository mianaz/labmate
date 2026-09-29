// Mass calculator — m = MW × C × V (web: MassCalc.jsx).
const langBehavior = require('../../../behaviors/lang');
const { massCalc, formatMass } = require('../../../shared/calculators.js');
const { num, cleanNumber, seg } = require('../shared');

const COMMON_MW = [
  { name: 'NaCl', mw: 58.44 },
  { name: 'KCl', mw: 74.55 },
  { name: 'Tris', mw: 121.14 },
  { name: 'EDTA', mw: 292.24 },
  { name: 'HEPES', mw: 238.30 },
  { name: 'SDS', mw: 288.38 },
  { name: 'DTT', mw: 154.25 },
  { name: 'PMSF', mw: 174.19 },
  { name: 'Glycine', mw: 75.03 },
  { name: 'Sucrose', mw: 342.30 },
  { name: 'Glucose', mw: 180.16 },
  { name: 'CaCl₂', mw: 110.98 },
  { name: 'MgCl₂', mw: 95.21 },
  { name: 'Na₂HPO₄', mw: 141.96 },
  { name: 'KH₂PO₄', mw: 136.09 },
  { name: 'NaOH', mw: 40.00 },
  { name: 'HCl', mw: 36.46 },
  { name: 'IPTG', mw: 238.31 },
  { name: 'Ampicillin', mw: 349.41 },
  { name: 'Kanamycin', mw: 484.50 },
];
const CONC_UNITS = ['M', 'mM', 'µM'];
const VOL_UNITS = ['L', 'mL', 'µL'];

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    commons: COMMON_MW,
    concUnits: CONC_UNITS,
    volUnits: VOL_UNITS,
    mw: '',
    conc: '',
    vol: '',
    concIdx: 0,
    volIdx: 1,
    mwNum: 0,
    value: '', // formatted mass, '' when incomplete
    unit: '',
    sub: '',
    prep: [],
  },
  methods: {
    onLangChange() { this.recalc(); },

    onInput(e) {
      const f = e.currentTarget.dataset.field;
      this.setData({ [f]: cleanNumber(e.detail.value) });
      this.recalc();
    },
    onConcUnit(e) { this.setData({ concIdx: Number(e.detail.value) }); this.recalc(); },
    onVolUnit(e) { this.setData({ volIdx: Number(e.detail.value) }); this.recalc(); },
    pickCommon(e) {
      this.setData({ mw: String(e.currentTarget.dataset.mw) });
      this.recalc();
    },

    recalc() {
      const { mw, conc, vol, concIdx, volIdx } = this.data;
      const concUnit = CONC_UNITS[concIdx];
      const volUnit = VOL_UNITS[volIdx];
      const mass = massCalc({ mw: num(mw), conc: num(conc), vol: num(vol), concUnit, volUnit });
      const ok = mass !== null && Number.isFinite(mass);
      const fm = ok ? formatMass(mass) : null;
      let prep = [];
      if (fm) {
        const zh = this.zh();
        const t = (k) => this.t(k);
        prep = [
          seg(0, t('massPrepSummary'), true), seg(1, zh ? '：' : ': '),
          seg(2, t('massPrepWeigh') + ' '), seg(3, fm.val + ' ' + fm.unit, true),
          seg(4, ' ' + t('massPrepDissolve') + ' '), seg(5, vol + ' ' + volUnit, true),
          seg(6, ' ' + t('massPrepTo') + ' '), seg(7, conc + ' ' + concUnit, true),
          seg(8, ' ' + t('massPrepSolution')),
        ];
      }
      this.setData({
        mwNum: num(mw),
        value: fm ? fm.val : '',
        unit: fm ? fm.unit : '',
        sub: ok ? '= ' + mass.toExponential(4) + ' g' : '',
        prep,
      });
    },
  },
});
