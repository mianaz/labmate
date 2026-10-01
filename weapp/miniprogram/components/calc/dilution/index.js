// Dilution calculator — C₁V₁ = C₂V₂ solved for any one variable (web: DilutionCalc.jsx).
const langBehavior = require('../../../behaviors/lang');
const { dilution, dilutionSolvent } = require('../../../shared/calculators.js');
const { CONC_UNITS, VOL_UNITS, num, cleanNumber, seg } = require('../shared');

const FIELDS = [
  { id: 'c1', sym: 'C₁', key: 'dilC1Desc', kind: 'conc' },
  { id: 'v1', sym: 'V₁', key: 'dilV1Desc', kind: 'vol' },
  { id: 'c2', sym: 'C₂', key: 'dilC2Desc', kind: 'conc' },
  { id: 'v2', sym: 'V₂', key: 'dilV2Desc', kind: 'vol' },
];
const KIND = { c1: 'conc', v1: 'vol', c2: 'conc', v2: 'vol' };

const fmtVal = (v) => (v < 0.001 ? v.toExponential(3) : v.toFixed(4));
const fix4 = (v) => num(v).toFixed(4);

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    fields: FIELDS,
    concUnits: CONC_UNITS,
    volUnits: VOL_UNITS,
    solve: 'v1',
    vals: { c1: '', v1: '', c2: '', v2: '' },
    units: { c1: 'M', v1: 'mL', c2: 'M', v2: 'mL' },
    unitIdx: { c1: 0, v1: 1, c2: 0, v2: 1 },
    result: '', // formatted value of the solved-for variable, '' when incomplete
    prep: [], // "How to prepare" text runs
  },
  lifetimes: {
    attached() { this.recalc(); },
  },
  methods: {
    onLangChange() { this.recalc(); },

    setSolve(e) {
      this.setData({ solve: e.currentTarget.dataset.id });
      this.recalc();
    },
    onInput(e) {
      const id = e.currentTarget.dataset.field;
      this.setData({ ['vals.' + id]: cleanNumber(e.detail.value) });
      this.recalc();
    },
    onUnit(e) {
      const id = e.currentTarget.dataset.field;
      const idx = Number(e.detail.value);
      const list = KIND[id] === 'conc' ? CONC_UNITS : VOL_UNITS;
      this.setData({ ['units.' + id]: list[idx], ['unitIdx.' + id]: idx });
      this.recalc();
    },

    compute() {
      const { vals, units, solve } = this.data;
      return dilution({
        c1: num(vals.c1), v1: num(vals.v1), c2: num(vals.c2), v2: num(vals.v2),
        c1Unit: units.c1, v1Unit: units.v1, c2Unit: units.c2, v2Unit: units.v2,
        solveFor: solve,
      });
    },

    recalc() {
      const r = this.compute();
      const ok = !!r && Number.isFinite(r.val);
      this.setData({ result: ok ? fmtVal(r.val) : '', prep: ok ? this.prepText(r.val) : [] });
    },

    // Practical pipetting instructions. The solvent is worked out in V₂'s unit,
    // so mixed units (µL of stock into mL) work — dilutionSolvent, shared with the web.
    prepText(val) {
      const { vals, units, solve } = this.data;
      const zh = this.zh();
      const t = (k) => this.t(k);
      const comma = zh ? '，' : ', ';
      // Empty in Chinese on purpose: 至总体积 already says "total".
      const total = t('dilPrepTotal') ? ' ' + t('dilPrepTotal') : '';
      const out = [seg(0, t('dilPrepSummary'), true), seg(1, zh ? '：' : ': ')];
      const push = (text, bold) => out.push(seg(out.length, text, bold));

      if (solve === 'v1' || solve === 'v2') {
        const stock = solve === 'v1' ? val : num(vals.v1);
        const final = solve === 'v1' ? num(vals.v2) : val;
        const solvent = dilutionSolvent({ v1: stock, v1Unit: units.v1, v2: final, v2Unit: units.v2 });
        if (!(solvent > 0)) return [];
        push(t('dilPrepPipette') + ' ');
        push(fmtVal(stock) + ' ' + units.v1, true);
        push(' ' + t('dilPrepStock') + comma + t('dilPrepAdd') + ' ');
        push(fmtVal(solvent) + ' ' + units.v2, true);
        push(' ' + t('dilPrepSolvent') + (zh ? '，' : ' ') + t('dilPrepReach') + ' ');
        push((solve === 'v1' ? fix4(vals.v2) : fmtVal(val)) + ' ' + units.v2, true);
        if (total) push(total);
      } else if (solve === 'c2') {
        push(t('dilPrepDilute') + ' ');
        push(fmtVal(val) + ' ' + units.c2, true);
        push(comma + t('dilPrepUsing') + ' ');
        push(fix4(vals.v1) + ' ' + units.v1, true);
        push(' ' + t('dilPrepStock') + (zh ? '，' : ' → '));
        push(fix4(vals.v2) + ' ' + units.v2, true);
        push(' ' + t('dilPrepFinalVol'));
      } else if (solve === 'c1') {
        push(t('dilPrepNeedStock') + ' ');
        push(fmtVal(val) + ' ' + units.c1, true);
        push((zh ? '，' : ' ') + t('dilPrepToGet') + ' ');
        push(fix4(vals.c2) + ' ' + units.c2, true);
        push(comma + t('dilPrepFrom') + ' ');
        push(fix4(vals.v1) + ' ' + units.v1, true);
        push(' → ');
        push(fix4(vals.v2) + ' ' + units.v2, true);
      }
      return out;
    },
  },
});
