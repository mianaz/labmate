// Percent solution calculator — % (w/v) or (v/v), solved for solute, final
// volume or percentage (web: PercentCalc.jsx).
const langBehavior = require('../../../behaviors/lang');
const { percentCalc } = require('../../../shared/calculators.js');
const { num, cleanNumber, splitUnit } = require('../shared');

const TYPES = [{ id: 'wv', short: 'w/v' }, { id: 'vv', short: 'v/v' }];

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    types: TYPES,
    mode: 'wv', // wv | vv
    solve: 'solute', // solute | vol | perc
    vals: { perc: '', solute: '', vol: '' },
    fields: [], // [{ id, label, unit, placeholder }] in display order
    solveOpts: [],
    result: '', // formatted value of the solved-for quantity
    formula: '',
  },
  lifetimes: {
    attached() { this.relabel(); },
  },
  methods: {
    onLangChange() { this.relabel(); },

    // Labels depend on the language and the w/v · v/v type.
    relabel() {
      const t = (k) => this.t(k);
      const wv = this.data.mode === 'wv';
      const soluteUnit = wv ? 'g' : 'mL';
      this.setData({
        formula: wv ? '% (w/v) = g / 100 mL' : '% (v/v) = mL / 100 mL',
        fields: [
          { id: 'perc', label: splitUnit(t('percentConc')).label, unit: '%', placeholder: this.zh() ? '如 10' : 'e.g. 10' },
          { id: 'solute', label: splitUnit(t(wv ? 'soluteMass' : 'soluteVol')).label, unit: soluteUnit, placeholder: '0' },
          { id: 'vol', label: splitUnit(t('finalVol')).label, unit: 'mL', placeholder: '0' },
        ],
        solveOpts: [
          { id: 'solute', l: splitUnit(t(wv ? 'soluteG' : 'soluteML')).label },
          { id: 'vol', l: splitUnit(t('volML')).label },
          { id: 'perc', l: splitUnit(t('pctLabel')).label },
        ],
      });
      this.recalc();
    },

    setType(e) {
      this.setData({ mode: e.currentTarget.dataset.id });
      this.relabel();
    },
    setSolve(e) {
      this.setData({ solve: e.currentTarget.dataset.id });
      this.recalc();
    },
    onInput(e) {
      this.setData({ ['vals.' + e.currentTarget.dataset.field]: cleanNumber(e.detail.value) });
      this.recalc();
    },

    recalc() {
      const { vals, solve, mode } = this.data;
      const r = percentCalc({ solute: num(vals.solute), vol: num(vals.vol), perc: num(vals.perc), solveFor: solve, mode });
      this.setData({ result: r && Number.isFinite(r.val) ? r.val.toFixed(4) : '' });
    },
  },
});
