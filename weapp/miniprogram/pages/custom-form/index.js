// New / edit a custom recipe or protocol (the web's CustomRecipeFormModal).
// Saved in the web's shape and storage keys so backups interoperate.
const pageBehavior = require('../../behaviors/page');
const recipes = require('../../lib/recipes');
const ui = require('../../lib/ui');
const { t } = require('../../shared/i18n.js');

const CATEGORIES = ['buffer', 'staining', 'media'];
const TEMPS = ['RT', '4°C', '-20°C', '-80°C', 'N/A'];

function parseTags(str) {
  return str ? str.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

Component({
  behaviors: [pageBehavior],
  data: {
    isProtocol: false,
    editing: false,
    catOptions: [],
    catIndex: 0,
    temps: TEMPS,
    tempIndex: 0,
    f: {
      name: '', nameCn: '', tags: '', ph: '', defaultVolume: '1000', unit: 'mL',
      storageDuration: '', storageLabelEn: '', storageLabelZh: '', notesEn: '', notesZh: '',
    },
    components: [],
    steps: [],
    materials: [],
    canSave: false,
  },
  methods: {
    pageTitle() {
      return t(this.data.editing ? 'editCustom' : (this.data.isProtocol ? 'addCustomProtocol' : 'addCustomRecipe'), this.data.lang);
    },
    onLoad(query) {
      const isProtocol = (query && query.type) === 'protocol';
      const id = query && query.id ? decodeURIComponent(query.id) : '';
      const list = isProtocol ? recipes.loadCustomProtocols() : recipes.loadCustomRecipes();
      const initial = id ? list.find((r) => r.id === id) : null;
      this._initial = initial;
      this._isProtocol = isProtocol;
      const storage = (initial && initial.storage) || {};
      const category = (initial && initial.category) || 'buffer';
      this.setData({
        isProtocol,
        editing: !!initial,
        catIndex: Math.max(0, CATEGORIES.indexOf(category)),
        tempIndex: Math.max(0, TEMPS.indexOf(storage.temp || 'RT')),
        f: {
          name: (initial && initial.name) || '',
          nameCn: (initial && initial.nameCn) || '',
          tags: ((initial && initial.tags) || []).join(', '),
          ph: (initial && initial.ph) || '',
          defaultVolume: String((initial && initial.defaultVolume) || 1000),
          unit: (initial && initial.unit) || 'mL',
          storageDuration: storage.duration || '',
          storageLabelEn: (storage.label && storage.label.en) || '',
          storageLabelZh: (storage.label && storage.label.zh) || '',
          notesEn: (initial && initial._notesEn) || '',
          notesZh: (initial && typeof initial.notes === 'string' && initial.notes) || '',
        },
        components: ((initial && initial.components && initial.components.length) ? initial.components : [{ name: '', amount: '', unit: 'g', note: '' }])
          .map((c) => ({ name: c.name || '', amount: c.amount === 0 || c.amount ? String(c.amount) : '', unit: c.unit || 'g', note: typeof c.note === 'string' ? c.note : '' })),
        steps: ((initial && initial.briefSteps && initial.briefSteps.length) ? initial.briefSteps : [''])
          .map((s) => (typeof s === 'string' ? { en: s, zh: s } : { en: s.en || '', zh: s.zh || '' })),
        materials: ((initial && initial.materials && initial.materials.length) ? initial.materials : [''])
          .map((m) => (typeof m === 'string' ? m : (m && m.name) || '')),
        canSave: !!(initial && initial.name),
      });
      this.onLangChange();
    },
    onLangChange() {
      const lang = this.data.lang;
      this.setData({ catOptions: CATEGORIES.map((c) => t(c, lang)) });
    },

    onField(e) {
      const key = e.currentTarget.dataset.key;
      const value = e.detail.value;
      const patch = { ['f.' + key]: value };
      if (key === 'name') patch.canSave = !!value.trim();
      this.setData(patch);
    },
    onCategory(e) { this.setData({ catIndex: Number(e.detail.value) }); },
    onTemp(e) { this.setData({ tempIndex: Number(e.detail.value) }); },

    onListField(e) {
      const { list, index, key } = e.currentTarget.dataset;
      const path = list + '[' + index + ']' + (key ? '.' + key : '');
      this.setData({ [path]: e.detail.value });
    },
    addRow(e) {
      const list = e.currentTarget.dataset.list;
      const blank = list === 'components' ? { name: '', amount: '', unit: 'g', note: '' } : list === 'steps' ? { en: '', zh: '' } : '';
      this.setData({ [list]: this.data[list].concat([blank]) });
    },
    removeRow(e) {
      const { list, index } = e.currentTarget.dataset;
      this.setData({ [list]: this.data[list].filter((_, j) => j !== Number(index)) });
    },

    save() {
      const { f, isProtocol, lang } = this.data;
      if (!f.name.trim()) { ui.toast(t('customFormName', lang)); return; }
      const initial = this._initial;
      const recipe = {
        id: (initial && initial.id) || 'custom_' + Date.now(),
        name: f.name.trim(),
        nameCn: f.nameCn.trim(),
        category: isProtocol ? 'protocol' : CATEGORIES[this.data.catIndex],
        tags: parseTags(f.tags),
        _isCustom: true,
        defaultVolume: +f.defaultVolume || 1000,
        unit: f.unit,
      };
      if (!isProtocol) {
        recipe.ph = f.ph || '';
        recipe.storage = {
          temp: TEMPS[this.data.tempIndex],
          duration: f.storageDuration,
          label: { en: f.storageLabelEn, zh: f.storageLabelZh },
        };
        recipe.notes = f.notesZh;
        recipe._notesEn = f.notesEn;
        recipe.components = this.data.components
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name.trim(), amount: +c.amount || 0, unit: c.unit || 'g', note: c.note || '' }));
      } else {
        recipe.briefSteps = this.data.steps
          .filter((s) => s.en.trim() || s.zh.trim())
          .map((s) => s[lang] || s.en || s.zh);
        recipe.materials = this.data.materials.filter((m) => m.trim());
        recipe.notes = f.notesZh;
        recipe._notesEn = f.notesEn;
        recipe.components = [];
      }
      const list = isProtocol ? recipes.loadCustomProtocols() : recipes.loadCustomRecipes();
      const idx = list.findIndex((r) => r.id === recipe.id);
      if (idx >= 0) list[idx] = recipe; else list.push(recipe);
      if (isProtocol) recipes.saveCustomProtocols(list); else recipes.saveCustomRecipes(list);
      ui.toast(t('customFormSave', lang) + ' ✓');
      if (initial) wx.navigateBack();
      else wx.redirectTo({ url: '/pages/detail/index?id=' + encodeURIComponent(recipe.id) });
    },
    cancel() { wx.navigateBack(); },
  },
});
