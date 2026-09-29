// Recipe / protocol document (the web's RecipeDetail.jsx) as a pushed page:
// volume scaling, protocol step checklist with per-step timers, keep-screen-on,
// copy as text and share to a chat.
const pageBehavior = require('../../behaviors/page');
const recipes = require('../../lib/recipes');
const favorites = require('../../lib/favorites');
const storage = require('../../lib/storage');
const timers = require('../../lib/timers');
const keepAwake = require('../../lib/keep-awake');
const ui = require('../../lib/ui');
const { t } = require('../../shared/i18n.js');
const fmt = require('../../lib/format');

const SCALE_PRESETS = [0.5, 1, 2, 5];
const RELATED_PREVIEW = 4;
const KEEP_AWAKE_KEY = 'labmate_keepScreenOn';

function stepKey(id) { return 'stepTracker_' + id; }

function goToRecipe(id) {
  const url = '/pages/detail/index?id=' + encodeURIComponent(id);
  // WeChat caps the page stack at 10: replace instead of push when deep.
  if (getCurrentPages().length >= 8) wx.redirectTo({ url });
  else wx.navigateTo({ url });
}

Component({
  behaviors: [pageBehavior],
  data: {
    missing: false,
    doc: null,
    fav: false,
    targetVol: 0,
    scale: 1,
    scaleText: '',
    presets: SCALE_PRESETS.map((m) => ({ m, label: '×' + (m === 0.5 ? '½' : m) })),
    components: [],
    prep: [],
    showDetailed: false,
    showAllRelated: false,
    done: {},
    doneCount: 0,
    keepAwake: false,
  },
  methods: {
    onLoad(query) {
      this._id = decodeURIComponent((query && query.id) || '');
      this.load();
      if (wx.showShareMenu) wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    },
    onPageShow() {
      // A custom entry may have been edited on the form page.
      if (this._recipe && this._recipe._isCustom) this.load();
      else this.setData({ fav: favorites.isFav(this._id) });
      if (this.data.keepAwake) keepAwake.acquire('detail');
    },
    onHide() { keepAwake.release('detail'); },
    onUnload() { keepAwake.release('detail'); },
    onLangChange() { this.load(true); },
    pageTitle() {
      const r = this._recipe;
      if (!r) return '';
      return this.data.lang === 'zh' && r.nameCn ? r.nameCn : r.name;
    },

    load(keepState) {
      const r = recipes.getById(this._id);
      this._recipe = r;
      if (!r) { this.setData({ missing: true }); return; }
      const lang = this.data.lang;
      const isProtocol = r.category === 'protocol';
      const isGel = r.id === 'sds_page_gel';
      const hasStepToggle = !!(r.briefSteps && r.detailedSteps && r.detailedSteps.length);
      const detailed = (r.detailedSteps || []);
      const actionCount = detailed.filter((s) => !s.isHeader).length;

      // Storage (reagents) / duration (protocols) — two recipe shapes exist.
      let storageText = '';
      if (r.storage) {
        const label = r.storage.label ? (r.storage.label[lang] || r.storage.label.zh || r.storage.label.en || '') : '';
        storageText = label
          ? label.replace(/^(Protocol|实验方案)\s*[—–-]\s*/i, '')
          : [r.storage.temperature || r.storage.temp, r.storage.duration].filter((x) => x && x !== 'N/A').join(', ');
      }
      const facts = [];
      if (r.ph) facts.push({ k: t('phLabel', lang), v: r.ph });
      if (storageText) facts.push({ k: t(isProtocol ? 'durationLabel' : 'storageLabel', lang), v: storageText, wide: storageText.length > 18 });
      if (!isProtocol && !isGel && r.defaultVolume) facts.push({ k: t('defaultVolLabel', lang), v: r.defaultVolume + ' ' + (r.unit || '') });
      if (isProtocol && actionCount) facts.push({ k: t('stepsLabel', lang), v: String(actionCount) });
      if (isProtocol && r.materials && r.materials.length) facts.push({ k: t('materialsLabel', lang), v: String(r.materials.length) });
      if (!isProtocol && !isGel && r.components && r.components.length) facts.push({ k: t('componentsLabel', lang), v: String(r.components.length) });
      // Odd count: let the last cell span the row so the grid closes cleanly.
      const narrow = facts.filter((f) => !f.wide).length;
      if (narrow % 2 === 1) { const last = [...facts].reverse().find((f) => !f.wide); if (last) last.wide = true; }
      let col = 0;
      facts.forEach((f) => {
        if (f.wide) { f.right = true; col = 0; } else { f.right = col === 1; col = col === 1 ? 0 : 1; }
      });

      const related = (r.relatedProtocols || []).map((id) => recipes.BY_ID[id]).filter(Boolean)
        .map((p) => ({ id: p.id, name: p.name }));

      const materials = (r.materials || []).map((mat) => {
        const m = typeof mat === 'string' ? { name: mat } : mat;
        const linked = m.linkedRecipe && recipes.getById(m.linkedRecipe);
        return { name: m.name, note: fmt.safeText(m.note, lang), linkedId: linked ? linked.id : '' };
      });

      const safeStops = {};
      (r.safeStops || []).forEach((ss) => { safeStops[ss.afterStep] = ss.note ? (ss.note[lang] || ss.note.en || '') : ''; });
      const steps = detailed.map((step, i) => {
        const text = fmt.stepText(step, lang);
        return {
          i,
          header: !!step.isHeader,
          segs: fmt.boldSegments(text),
          timers: step.isHeader ? [] : fmt.parseTimePatternsFromText(text).slice(0, 2),
          safeStop: Object.prototype.hasOwnProperty.call(safeStops, i) ? (safeStops[i] || ' ') : '',
        };
      });

      // Protocols without the brief/detailed pair: legacy component list, or a
      // custom protocol's plain-string steps.
      let legacySteps = [];
      if (isProtocol && !hasStepToggle) {
        if ((r.components || []).length) {
          legacySteps = r.components.map((c) => ({
            name: String(c.name || '').trim(),
            sub: String(c.name || '').startsWith('  '),
            amountUnit: c.unit && c.unit !== 'step' && Number.isFinite(c.amount) ? ' ' + c.unit : '',
            amount: c.amount,
            note: fmt.safeText(c.note, lang),
          }));
        } else {
          legacySteps = (r.briefSteps || []).map((st) => ({ name: fmt.stepText(st, lang), sub: false, amountUnit: '', note: '' }));
        }
      }

      const noteText = fmt.getRecipeNotes(r, lang);
      const doc = {
        id: r.id,
        name: r.name,
        nameCn: lang === 'zh' && r.nameCn && r.nameCn !== r.name ? r.nameCn : '',
        usage: r.usage ? (r.usage[lang] || r.usage.zh || r.usage.en || '') : '',
        catLabel: recipes.categoryLabel(r, lang),
        catColor: recipes.CAT_COLOR_VARS[r.category] || recipes.CAT_COLOR_VARS.buffer,
        disc: (() => {
          const d = recipes.disciplineLabel(r, lang) || '';
          return d.toLowerCase() === recipes.categoryLabel(r, lang).toLowerCase() ? '' : d;
        })(),
        isCustom: !!r._isCustom,
        isProtocol,
        isGel,
        hasStepToggle,
        unit: r.unit || '',
        defaultVolume: r.defaultVolume || 0,
        related,
        relatedMore: Math.max(0, related.length - RELATED_PREVIEW),
        relatedPreview: RELATED_PREVIEW,
        facts,
        materials,
        briefSteps: (r.briefSteps || []).map((s) => fmt.stepText(s, lang)),
        steps,
        actionCount,
        legacySteps,
        showComponentsTable: !isGel && !isProtocol && (r.components || []).length > 0,
        showNotesCol: (r.components || []).some((c) => c.note),
        note: noteText,
        ref: r.ref || '',
      };

      const patch = { doc, missing: false, fav: favorites.isFav(r.id), keepAwake: storage.get(KEEP_AWAKE_KEY, false) === true };
      if (!keepState) {
        const saved = storage.get(stepKey(r.id), []);
        const done = {};
        (Array.isArray(saved) ? saved : []).forEach((idx) => { done[idx] = true; });
        Object.assign(patch, { done, showDetailed: false, showAllRelated: false, targetVol: r.defaultVolume || 0 });
      }
      this.setData(patch);
      this.applyScale(keepState ? this.data.targetVol : (r.defaultVolume || 0));
      this.countDone();
      this.applyTitle();
    },

    applyScale(vol) {
      const r = this._recipe;
      if (!r) return;
      const lang = this.data.lang;
      const base = r.defaultVolume || 1;
      const targetVol = vol > 0 ? vol : base;
      const scale = targetVol / base;
      const components = (r.components || []).map((c) => {
        const linked = c.linkedRecipe && recipes.getById(c.linkedRecipe);
        return {
          name: c.name,
          amount: fmt.fmtAmount(c.amount * scale),
          unit: c.unit,
          note: fmt.safeText(c.note, lang),
          linkedId: linked ? linked.id : '',
        };
      });
      const prep = (r.prepSteps || []).map((s) => fmt.renderDynamicStep(fmt.stepText(s, lang), scale));
      const legacy = (this.data.doc && this.data.doc.legacySteps) || [];
      const legacyPatch = {};
      legacy.forEach((s, i) => {
        if (s.amountUnit) legacyPatch['doc.legacySteps[' + i + '].amountText'] = fmt.fmtAmount(s.amount * scale) + s.amountUnit;
      });
      const presets = SCALE_PRESETS.map((m) => ({ m, label: '×' + (m === 0.5 ? '½' : m), active: Math.abs(scale - m) < 1e-9 }));
      this.setData(Object.assign({
        targetVol,
        scale,
        scaleText: scale !== 1 ? t('scaleFactor', lang) + ' ×' + scale.toFixed(2) + ' · ' + t('defaultVolLabel', lang).toLowerCase() + ' ' + base + ' ' + (r.unit || '') : '',
        components,
        prep,
        presets,
      }, legacyPatch));
    },

    onVolume(e) {
      const v = parseFloat(e.detail.value);
      if (v > 0) this.applyScale(v);
    },
    onVolumeBlur(e) {
      const v = parseFloat(e.detail.value);
      this.applyScale(v > 0 ? v : this.data.targetVol);
    },
    setPreset(e) {
      const m = Number(e.currentTarget.dataset.m);
      this.applyScale((this._recipe.defaultVolume || 1) * m);
    },

    // ── Steps ─────────────────────────────────────────
    setStepMode(e) { this.setData({ showDetailed: e.currentTarget.dataset.mode === 'detailed' }); },
    countDone() {
      const steps = (this.data.doc && this.data.doc.steps) || [];
      const done = this.data.done;
      this.setData({ doneCount: steps.filter((s) => !s.header && done[s.i]).length });
    },
    toggleStep(e) {
      const i = Number(e.currentTarget.dataset.i);
      const done = Object.assign({}, this.data.done);
      if (done[i]) delete done[i]; else done[i] = true;
      const list = Object.keys(done).map(Number);
      if (list.length) storage.set(stepKey(this._id), list); else storage.remove(stepKey(this._id));
      this.setData({ ['done.' + i]: !!done[i] });
      this.countDone();
    },
    resetSteps() {
      storage.remove(stepKey(this._id));
      this.setData({ done: {}, doneCount: 0 });
    },
    startTimer(e) {
      const { seconds, label } = e.currentTarget.dataset;
      timers.add(this._recipe.name + ' - ' + label, Number(seconds));
      ui.toast((this.data.lang === 'zh' ? '计时开始：' : 'Timer started: ') + label);
    },
    toggleKeepAwake() {
      const next = !this.data.keepAwake;
      storage.set(KEEP_AWAKE_KEY, next);
      this.setData({ keepAwake: next });
      if (next) keepAwake.acquire('detail'); else keepAwake.release('detail');
      ui.toast(t('keepScreenOn', this.data.lang) + (next ? ' ✓' : ' ✕'));
    },

    // ── Header actions ────────────────────────────────
    toggleFav() {
      const on = favorites.toggle(this._id);
      this.setData({ fav: on });
      ui.toast(t(on ? 'addedFav' : 'removedFav', this.data.lang));
    },
    copyText() {
      ui.copy(fmt.recipeToText(this._recipe, this.data.targetVol, this.data.lang));
    },
    toggleRelated() { this.setData({ showAllRelated: !this.data.showAllRelated }); },
    openRecipe(e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      favorites.addRecent(id);
      goToRecipe(id);
    },
    editCustom() {
      const type = this._recipe.category === 'protocol' ? 'protocol' : 'recipe';
      wx.navigateTo({ url: '/pages/custom-form/index?type=' + type + '&id=' + encodeURIComponent(this._id) });
    },
    async deleteCustom() {
      const lang = this.data.lang;
      const ok = await ui.confirm(t('deleteConfirm', lang), { danger: true, confirmText: t('deleteCustom', lang) });
      if (!ok) return;
      if (this._recipe.category === 'protocol') {
        recipes.saveCustomProtocols(recipes.loadCustomProtocols().filter((r) => r.id !== this._id));
      } else {
        recipes.saveCustomRecipes(recipes.loadCustomRecipes().filter((r) => r.id !== this._id));
      }
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/recipes/index' }) });
    },
    goHome() { wx.switchTab({ url: '/pages/recipes/index' }); },

    onShareAppMessage() {
      const r = this._recipe;
      return {
        title: r ? this.pageTitle() : 'LabMate',
        path: '/pages/detail/index?id=' + encodeURIComponent(this._id),
      };
    },
    onShareTimeline() {
      return { title: this._recipe ? this.pageTitle() : 'LabMate', query: 'id=' + encodeURIComponent(this._id) };
    },
  },
});
