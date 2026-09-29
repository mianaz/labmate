// Add / edit a storage location (the web's LocationForm). Emits save { form }, close.
const U = require('../../lib/utils');
const ui = require('../../../../../lib/ui');
const { t } = require('../../../../../shared/i18n.js');
const langBehavior = require('../../../../../behaviors/lang');

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    show: { type: Boolean, value: false },
    location: { type: Object, value: null },
  },
  data: {
    form: { name: '', nameZh: '', type: 'freezer', temperature: '-80°C' },
    editing: false, typeOptions: [], typeIndex: 0, tempOptions: [], tempIndex: 0,
    types: U.STORAGE_TYPES,
  },
  observers: {
    show(on) { if (on) this.init(); },
  },
  methods: {
    onLangChange() { this.buildOptions(); },
    buildOptions() {
      const lang = this.data.lang;
      this.setData({
        typeOptions: U.STORAGE_TYPES.map((tp) => t(U.STORAGE_TYPE_LABELS[tp], lang)),
        tempOptions: U.TEMPERATURES.map((x) => (x[0] === 'RT' && lang === 'zh' ? 'RT（室温）' : x[1])),
      });
    },
    init() {
      const l = this.data.location;
      const form = l
        ? { name: l.name || '', nameZh: l.nameZh || '', type: l.type || 'freezer', temperature: l.temperature || '' }
        : { name: '', nameZh: '', type: 'freezer', temperature: '-80°C' };
      let tempIndex = U.TEMPERATURES.findIndex((x) => x[0] === form.temperature);
      this.buildOptions();
      // A temperature typed elsewhere (web import) stays selectable.
      if (tempIndex < 0) {
        this.setData({ tempOptions: this.data.tempOptions.concat([form.temperature]) });
        tempIndex = this.data.tempOptions.length - 1;
      }
      this.setData({
        form, editing: !!l, tempIndex,
        typeIndex: Math.max(0, U.STORAGE_TYPES.indexOf(form.type)),
      });
    },
    onInput(e) { this.setData({ ['form.' + e.currentTarget.dataset.k]: e.detail.value }); },
    pickType(e) {
      const typeIndex = Number(e.currentTarget.dataset.index);
      this.setData({ typeIndex, 'form.type': U.STORAGE_TYPES[typeIndex] });
    },
    onTemp(e) {
      const tempIndex = Number(e.detail.value);
      const preset = U.TEMPERATURES[tempIndex];
      this.setData({ tempIndex, 'form.temperature': preset ? preset[0] : this.data.form.temperature });
    },
    close() { this.triggerEvent('close'); },
    save() {
      if (!String(this.data.form.name).trim()) { ui.toast(t('invNameRequired', this.data.lang)); return; }
      this.triggerEvent('save', { form: Object.assign({}, this.data.form) });
    },
  },
});
