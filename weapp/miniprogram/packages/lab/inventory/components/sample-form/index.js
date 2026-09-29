// Add / edit one sample (the web's SampleForm). Emits save { form } with the raw
// form (the store turns dates and tags into the stored shape), delete and close.
const U = require('../../lib/utils');
const ui = require('../../../../../lib/ui');
const { t } = require('../../../../../shared/i18n.js');
const langBehavior = require('../../../../../behaviors/lang');

function blank() {
  return {
    name: '', sampleType: 'cell_line', quantity: '', concentration: '', passage: '',
    dateStored: U.todayInput(), expiryDate: '', owner: '', tags: '', description: '', notes: '',
  };
}

function fromSample(s) {
  return {
    name: s.name || '',
    sampleType: s.sampleType || 'cell_line',
    quantity: s.quantity || '',
    concentration: s.concentration || '',
    passage: s.passage || '',
    dateStored: U.isoDate(s.dateStored),
    expiryDate: U.isoDate(s.expiryDate),
    owner: s.owner || '',
    tags: (s.tags || []).join(', '),
    description: s.description || '',
    notes: s.notes || '',
  };
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    show: { type: Boolean, value: false },
    sample: { type: Object, value: null }, // editing when set
    position: { type: String, value: '' },
    boxName: { type: String, value: '' },
  },
  data: { form: blank(), typeOptions: [], typeIndex: 0, editing: false },
  observers: {
    show(on) { if (on) this.init(); },
  },
  methods: {
    onLangChange() { this.buildTypes(); },
    buildTypes() {
      const lang = this.data.lang;
      this.setData({ typeOptions: U.SAMPLE_TYPES.map((tp) => t(U.SAMPLE_TYPE_LABELS[tp], lang)) });
    },
    init() {
      const s = this.data.sample;
      const form = s ? fromSample(s) : blank();
      this.buildTypes();
      this.setData({
        form, editing: !!s,
        typeIndex: Math.max(0, U.SAMPLE_TYPES.indexOf(U.normalizeSampleType(form.sampleType))),
      });
    },
    onInput(e) {
      this.setData({ ['form.' + e.currentTarget.dataset.k]: e.detail.value });
    },
    onType(e) {
      const typeIndex = Number(e.detail.value);
      this.setData({ typeIndex, 'form.sampleType': U.SAMPLE_TYPES[typeIndex] || 'other' });
    },
    clearDate(e) {
      this.setData({ ['form.' + e.currentTarget.dataset.k]: '' });
    },
    close() { this.triggerEvent('close'); },
    save() {
      const form = this.data.form;
      if (!String(form.name).trim()) { ui.toast(t('invNameRequired', this.data.lang)); return; }
      this.triggerEvent('save', { form: Object.assign({}, form) });
    },
    remove() { this.triggerEvent('delete'); },
  },
});
