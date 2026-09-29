// Molecular weight from a chemical formula — MW = Σ(n × Aᵣ) (web: MWCalc.jsx;
// parser and atomic masses from shared/data.js). Accepts parentheses and
// subscript digits: Ca(OH)₂, Fe2(SO4)3, C₆H₁₂O₆.
const langBehavior = require('../../../behaviors/lang');
const { calcMW, COMMON_MOLECULES } = require('../../../shared/data.js');

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    commons: COMMON_MOLECULES,
    formula: '',
    state: 'empty', // empty | ok | error
    errorSym: '',
    total: '',
    rows: [], // [{ k, sym, name, count, mass, subtotal }]
  },
  methods: {
    onInput(e) {
      this.setData({ formula: e.detail.value });
      this.recalc();
    },
    pick(e) {
      this.setData({ formula: e.currentTarget.dataset.formula });
      this.recalc();
    },
    clear() {
      this.setData({ formula: '' });
      this.recalc();
    },

    recalc() {
      const f = String(this.data.formula || '').trim();
      const r = f ? calcMW(f) : null;
      if (r && r.error) {
        this.setData({ state: 'error', errorSym: r.sym, total: '', rows: [] });
      } else if (r && r.breakdown.length > 0) {
        this.setData({
          state: 'ok',
          errorSym: '',
          total: r.total.toFixed(3),
          rows: r.breakdown.map((b, i) => ({
            k: String(i), sym: b.sym, name: b.name, count: b.count,
            mass: b.mass.toFixed(3), subtotal: b.subtotal.toFixed(3),
          })),
        });
      } else {
        this.setData({ state: 'empty', errorSym: '', total: '', rows: [] });
      }
    },
  },
});
