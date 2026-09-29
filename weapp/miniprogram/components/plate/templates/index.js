// Quick templates (the web's template dialog). On a phone the parameters open
// inline under the buttons instead of in a modal; Apply emits
// `apply` { type, params } and the page builds the layout.
const langBehavior = require('../../../behaviors/lang');
const { TEMPLATE_DEFAULTS } = require('../util');

const NAMES = {
  serial: 'plateSerial',
  dose: 'plateDose',
  checkerboard: 'plateCheckerboard',
  control: 'plateControlLayout',
  antibody: 'plateAntibodyTitration',
};
const DESCS = {
  serial: 'plateTplDescSerial',
  dose: 'plateTplDescDose',
  checkerboard: 'plateTplDescCheckerboard',
  control: 'plateTplDescControl',
  antibody: 'plateTplDescAntibody',
};

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    plateType: { type: Number, value: 96 },
    labelled: { type: Number, value: 0 },
  },
  data: {
    types: ['serial', 'dose', 'checkerboard', 'control', 'antibody'],
    names: NAMES,
    descs: DESCS,
    open: '',
    p: {},
    repOptions: ['1', '2', '3', '4'],
  },
  methods: {
    toggle(e) {
      const type = e.currentTarget.dataset.type;
      if (this.data.open === type) { this.close(); return; }
      this.setData({ open: type, p: Object.assign({}, TEMPLATE_DEFAULTS[type]) });
    },
    close() { this.setData({ open: '', p: {} }); },
    onField(e) {
      this.setData({ ['p.' + e.currentTarget.dataset.key]: e.detail.value });
    },
    setParam(e) {
      const { key, val } = e.currentTarget.dataset;
      this.setData({ ['p.' + key]: String(val) });
    },
    apply() {
      const type = this.data.open;
      if (!type) return;
      this.triggerEvent('apply', { type, params: Object.assign({}, this.data.p) });
      this.close();
    },
  },
});
