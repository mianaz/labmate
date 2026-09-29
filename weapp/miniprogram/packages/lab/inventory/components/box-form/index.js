// Add / edit a box (the web's BoxForm): name, format (9×9 cryo box, tip box…,
// or custom rows × cols) and a colour label. Emits save { form }, close.
const U = require('../../lib/utils');
const store = require('../../lib/store');
const ui = require('../../../../../lib/ui');
const { t } = require('../../../../../shared/i18n.js');
const langBehavior = require('../../../../../behaviors/lang');

const HEX_RE = /^#[0-9a-f]{6}$/i;

function clampDim(k, v) {
  return Math.max(1, Math.min(k === 'rows' ? 26 : 50, parseInt(v, 10) || 1));
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    show: { type: Boolean, value: false },
    box: { type: Object, value: null }, // editing when set
    locationName: { type: String, value: '' },
  },
  data: {
    form: { name: '', nameZh: '', boxType: 'cryo_81', rows: 9, cols: 9, color: '' },
    editing: false, typeOptions: [], typeIndex: 0,
    colors: U.BOX_COLORS, hex: '', dims: '', outside: 0,
  },
  observers: {
    show(on) { if (on) this.init(); },
  },
  methods: {
    onLangChange() { this.buildOptions(); this.refresh(); },
    buildOptions() {
      const lang = this.data.lang;
      this.setData({ typeOptions: U.BOX_CONFIGS.map((c) => t(U.BOX_TYPE_LABELS[c.type], lang)) });
    },
    init() {
      const b = this.data.box;
      const form = b
        ? { name: b.name || '', nameZh: b.nameZh || '', boxType: b.boxType || 'cryo_81', rows: b.rows || 9, cols: b.cols || 9, color: b.color || '' }
        : { name: '', nameZh: '', boxType: 'cryo_81', rows: 9, cols: 9, color: '' };
      if (b) this._samples = U.boxSamples(store.load(), b.id);
      else this._samples = [];
      this.buildOptions();
      this.setData({
        form, editing: !!b,
        typeIndex: Math.max(0, U.BOX_CONFIGS.findIndex((c) => c.type === form.boxType)),
        hex: form.color && U.BOX_COLORS.indexOf(form.color) < 0 ? form.color : '',
      });
      this.refresh();
    },
    // Size line and the "positions outside the new size" warning.
    refresh() {
      const f = this.data.form;
      const rows = clampDim('rows', f.rows);
      const cols = clampDim('cols', f.cols);
      const zh = this.data.lang === 'zh';
      this.setData({
        dims: rows + ' × ' + cols + ' = ' + (rows * cols) + (zh ? ' 个孔位' : ' positions') + ' · A1–' + U.posLabel(rows - 1, cols - 1),
        outside: this.data.editing ? U.samplesOutside(this.data.box, rows, cols, this._samples || []) : 0,
      });
    },
    onInput(e) { this.setData({ ['form.' + e.currentTarget.dataset.k]: e.detail.value }); },
    onType(e) {
      const typeIndex = Number(e.detail.value);
      const cfg = U.BOX_CONFIGS[typeIndex] || U.BOX_CONFIGS[U.BOX_CONFIGS.length - 1];
      this.setData({ typeIndex, 'form.boxType': cfg.type, 'form.rows': cfg.rows, 'form.cols': cfg.cols });
      this.refresh();
    },
    // Raw while typing (the store clamps on save); clamped when the field is left.
    onDim(e) {
      const k = e.currentTarget.dataset.k;
      this.setData({ ['form.' + k]: e.detail.value });
      this.refresh();
    },
    onDimBlur(e) {
      const k = e.currentTarget.dataset.k;
      this.setData({ ['form.' + k]: clampDim(k, e.detail.value) });
      this.refresh();
    },
    pickColor(e) {
      this.setData({ 'form.color': e.currentTarget.dataset.color || '', hex: '' });
    },
    onHex(e) {
      let v = String(e.detail.value || '').trim();
      if (v && v[0] !== '#') v = '#' + v;
      this.setData({ hex: v });
      if (HEX_RE.test(v)) this.setData({ 'form.color': v.toUpperCase() });
    },
    close() { this.triggerEvent('close'); },
    save() {
      if (!String(this.data.form.name).trim()) { ui.toast(t('invNameRequired', this.data.lang)); return; }
      this.triggerEvent('save', { form: Object.assign({}, this.data.form) });
    },
  },
});
