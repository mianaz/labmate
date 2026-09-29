// One experiment entry (web: src/features/notebook/NotebookTab.jsx, the document
// half). Query:
//   ?id=<entry id>                          open an entry (read mode)
//   ?date=YYYY-MM-DD[&startTime=HH:MM]       new entry (edit mode) — calendar day / notebook "New"
//   ?date=…&protocol=<recipe id>             new entry from a protocol (calendar "From protocol")
// As on the web: read mode shows the record with live checkboxes; Edit opens the
// fields, changes auto-save after 1.5 s, Save ends editing, Cancel restores the
// snapshot taken when editing started (a brand-new entry is discarded). Pending
// changes are written when the page hides or unloads. A new entry is stored on
// its first change, so backing out of an untouched one leaves nothing behind.
const pageBehavior = require('../../../behaviors/page');
const experiments = require('../../../lib/experiments');
const recipes = require('../../../lib/recipes');
const ui = require('../../../lib/ui');
const { isoDate, formatClock } = require('../../../lib/format');
const nb = require('../components/nb-shared/model');

const AUTOSAVE_MS = 1500;
const CALENDAR_ROUTE = 'packages/lab/calendar/index';
// List sections: their rows carry a view-only `_k` key for wx:key.
const LISTS = ['materials.reagents', 'materials.equipment', 'materials.checklist', 'procedure.protocolSteps', 'results.figures'];
const NEW_ITEM = {
  'materials.reagents': () => ({ name: '', amount: '', unit: '', location: '', inventoryRef: null }),
  'materials.equipment': () => ({ name: '', status: 'pending' }),
  'materials.checklist': () => ({ item: '', checked: false }),
  'results.figures': () => ({ description: '', notes: '' }),
};

// 'materials.reagents[2].name' → ['materials', 'reagents', '2', 'name']
function pathKeys(path) { return String(path).replace(/\[(\d+)\]/g, '.$1').split('.'); }
function getPath(obj, path) {
  return pathKeys(path).reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = pathKeys(path);
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function goBack() {
  wx.navigateBack({ fail: () => wx.redirectTo({ url: '/packages/lab/notebook/index' }) });
}

Component({
  behaviors: [pageBehavior],
  data: {
    titleKey: 'tabNotebook',
    ready: false,
    missing: false,
    doc: null,
    editing: false,
    isNew: false,
    open: { plan: true, materials: true, procedure: true, results: true },
    meta: {},
    protoLabel: '',
    updatedLabel: '—',
    shortId: '',
    statusLabels: [],
    savedAt: '',
    colors: nb.LABEL_COLORS,
    showSelector: false,
  },
  methods: {
    pageTitle() { return this.t(this.data.isNew ? 'nbNewEntry' : 'tabNotebook'); },

    onLoad(query) {
      const q = query || {};
      this._keys = {};
      this._seq = 0;
      if (q.id) {
        const stored = experiments.get(nb.dec(q.id));
        if (!stored) { this.setData({ missing: true }); return; }
        this._persisted = true;
        this.load(nb.normalize(stored), false);
        return;
      }
      const date = nb.isDateStr(q.date) ? q.date : isoDate();
      const start = nb.isTimeStr(nb.dec(q.startTime || '')) ? nb.dec(q.startTime) : undefined;
      let doc = experiments.createEmptyExperiment(date, start);
      const recipe = q.protocol ? recipes.getById(nb.dec(q.protocol)) : null;
      if (recipe) doc = nb.applyProtocol(doc, recipe, this.data.lang);
      this._persisted = false;
      this._snapshot = nb.clone(doc);
      this.load(doc, true);
      if (recipe) this.scheduleSave(); // a protocol import is a change worth keeping
    },

    // Back on this page (e.g. from the calendar): pick up outside changes unless
    // we are editing or still have a write pending.
    onPageShow() {
      if (!this._doc || !this._persisted || this._discarded || this.data.editing || this._timer) return;
      const stored = experiments.get(this._doc.id);
      if (!stored) { this.setData({ missing: true, ready: false }); return; }
      if (stored.updatedAt !== this._doc.updatedAt) this.load(nb.normalize(stored), false);
    },
    onHide() { this.flush(); },
    onUnload() { this.flush(); },
    onLangChange() { if (this._doc) this.refreshLabels(); },
    back() { goBack(); },

    // ── State ───────────────────────────────────────────────────────────────
    load(doc, editing) {
      this._doc = doc;
      this._keys = {};
      this.setData({
        ready: true,
        missing: false,
        editing,
        isNew: editing && !this._persisted,
        doc: this.viewDoc(doc),
        savedAt: '',
        shortId: String(doc.id || '').split('_').pop().toUpperCase(),
        updatedLabel: nb.formatStamp(this._persisted ? doc.updatedAt : 0),
      });
      this.refreshLabels();
    },

    // The record as the template sees it: list rows get a stable `_k` for wx:key
    // (the stored record never carries it).
    viewDoc(doc) {
      const v = Object.assign({}, doc, {
        materials: Object.assign({}, doc.materials),
        procedure: Object.assign({}, doc.procedure),
        results: Object.assign({}, doc.results),
      });
      LISTS.forEach((path) => setPath(v, path, this.keyed(path, getPath(doc, path))));
      return v;
    },
    keyed(path, list) {
      const rows = list || [];
      const keys = this._keys[path] || (this._keys[path] = []);
      while (keys.length < rows.length) keys.push(++this._seq);
      keys.length = rows.length;
      return rows.map((row, i) => Object.assign({}, row, { _k: keys[i] }));
    },

    refreshLabels() {
      const lang = this.data.lang;
      this.setData({
        meta: nb.docMeta(this._doc, lang),
        protoLabel: nb.protocolName(this._doc.protocolRef, lang),
        statusLabels: nb.STATUSES.map((s) => this.t(s.key)),
      });
    },

    // Update one field: the JS copy, the view (by path only) and the save timer.
    change(path, value) {
      setPath(this._doc, path, value);
      this.setData({ ['doc.' + path]: value });
      this.afterChange();
    },
    setList(path, list) {
      setPath(this._doc, path, list);
      this.setData({ ['doc.' + path]: this.keyed(path, list) });
      this.afterChange();
    },
    afterChange() {
      const meta = nb.docMeta(this._doc, this.data.lang);
      if (JSON.stringify(meta) !== JSON.stringify(this.data.meta)) this.setData({ meta });
      this.scheduleSave();
    },

    // ── Saving ──────────────────────────────────────────────────────────────
    scheduleSave() {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        this._timer = null;
        if (this.persist() && this.data.editing) this.setData({ savedAt: formatClock(Date.now()) });
      }, AUTOSAVE_MS);
    },
    discardPending() {
      clearTimeout(this._timer);
      this._timer = null;
    },
    flush() {
      if (!this._timer || this._discarded) return;
      this.persist();
    },
    persist() {
      this.discardPending();
      if (this._discarded || !this._doc) return false;
      let rec;
      try {
        rec = experiments.save(this._doc);
      } catch (err) {
        ui.toast(this.t('nbSaveFailed'));
        return false;
      }
      this._doc.createdAt = rec.createdAt;
      this._doc.updatedAt = rec.updatedAt;
      this._persisted = true;
      this.setData({ updatedLabel: nb.formatStamp(rec.updatedAt) });
      return true;
    },

    // ── Edit / save / cancel / delete ───────────────────────────────────────
    startEdit() {
      this.flush();
      this._snapshot = nb.clone(this._doc);
      this.setData({ editing: true, savedAt: '' });
    },

    saveEdit() {
      if (!this.persist()) return;
      const wasNew = this.data.isNew;
      this.setData({ editing: false, isNew: false, savedAt: '' });
      if (wasNew) this.applyTitle();
      ui.toast(this.t('nbEntrySaved'));
    },

    cancelEdit() {
      this.discardPending();
      if (this.data.isNew) {
        // Cancelling a brand-new entry discards it.
        if (this._persisted) experiments.remove(this._doc.id);
        this._discarded = true;
        goBack();
        return;
      }
      const snap = this._snapshot;
      if (snap && JSON.stringify(snap) !== JSON.stringify(this._doc)) {
        // Auto-save may already have stored some of the discarded edits.
        this._doc = nb.clone(snap);
        this.persist();
        this.load(this._doc, false);
      } else {
        this.setData({ editing: false, savedAt: '' });
      }
    },

    deleteEntry() {
      const doc = this._doc;
      const name = nb.displayTitle(doc, this.data.lang) || this.t('nbUntitled');
      ui.confirm(this.t('nbDeleteConfirm') + '\n' + name + ' · ' + doc.date, {
        title: this.t('nbDeleteEntry'), danger: true, confirmText: this.t('deleteCustom'),
      }).then((ok) => {
        if (!ok) return;
        this.discardPending();
        if (this._persisted) experiments.remove(doc.id);
        this._discarded = true;
        ui.toast(this.t('nbEntryDeleted'));
        goBack();
      });
    },

    exportMarkdown() {
      this.flush();
      ui.shareTextFile(nb.experimentFilename(this._doc), nb.experimentToMarkdown(this._doc))
        .catch((err) => { if (!nb.isCancelError(err)) ui.toast(this.t('nbShareFailed')); });
    },

    // Came from the calendar? Go back to it on this entry's day; else open it.
    viewInCalendar() {
      this.flush();
      const doc = this._doc;
      const pages = getCurrentPages();
      const prev = pages[pages.length - 2];
      if (prev && prev.route === CALENDAR_ROUTE && typeof prev.focusDate === 'function') {
        prev.focusDate(doc.date, doc.id);
        wx.navigateBack();
        return;
      }
      ui.go('/packages/lab/calendar/index?date=' + doc.date + '&id=' + encodeURIComponent(doc.id));
    },

    // ── Field handlers ──────────────────────────────────────────────────────
    onField(e) { this.change(e.currentTarget.dataset.path, e.detail.value); },
    onDuration(e) { this.change('duration', parseInt(e.detail.value, 10) || 0); },
    onDate(e) { this.change('date', e.detail.value); },
    onStartTime(e) { this.change('startTime', e.detail.value); },
    onStatus(e) {
      const s = nb.STATUS_IDS[Number(e.detail.value)];
      if (s) this.change('status', s);
    },
    setPriority(e) { this.change('priority', e.currentTarget.dataset.value); },
    setColor(e) { this.change('color', e.currentTarget.dataset.color || nb.DEFAULT_COLOR); },
    setMode(e) { this.change('procedure.mode', e.currentTarget.dataset.mode); },

    onItemField(e) {
      const d = e.currentTarget.dataset;
      this.change(d.list + '[' + Number(d.index) + '].' + d.field, e.detail.value);
    },
    addItem(e) {
      const list = e.currentTarget.dataset.list;
      this.setList(list, (getPath(this._doc, list) || []).concat(NEW_ITEM[list]()));
    },
    removeItem(e) {
      const d = e.currentTarget.dataset;
      const i = Number(d.index);
      const rows = (getPath(this._doc, d.list) || []).filter((_, j) => j !== i);
      (this._keys[d.list] || []).splice(i, 1);
      this.setList(d.list, rows);
    },
    setEquipStatus(e) {
      const d = e.currentTarget.dataset;
      this.change('materials.equipment[' + Number(d.index) + '].status', d.value);
    },

    // Checkboxes work in read mode too (ticking steps at the bench): those
    // changes are stored right away.
    toggleCheck(e) {
      const i = Number(e.currentTarget.dataset.index);
      const row = this._doc.materials.checklist[i];
      if (!row) return;
      this.change('materials.checklist[' + i + '].checked', !row.checked);
      if (!this.data.editing) this.flush();
    },
    toggleStep(e) {
      const i = Number(e.currentTarget.dataset.index);
      const step = this._doc.procedure.protocolSteps[i];
      if (!step) return;
      this.change('procedure.protocolSteps[' + i + '].completed', !step.completed);
      if (!this.data.editing) this.flush();
    },

    toggleSection(e) {
      const key = e.currentTarget.dataset.key;
      this.setData({ ['open.' + key]: !this.data.open[key] });
    },

    // ── Protocol import ─────────────────────────────────────────────────────
    openSelector() { this.setData({ showSelector: true }); },
    closeSelector() { this.setData({ showSelector: false }); },
    onProtocolSelect(e) {
      const recipe = recipes.getById(e.detail.id);
      this.setData({ showSelector: false });
      if (!recipe) return;
      this._doc = nb.applyProtocol(this._doc, recipe, this.data.lang);
      this._keys = {};
      this.setData({ doc: this.viewDoc(this._doc), 'open.procedure': true });
      this.refreshLabels();
      this.scheduleSave();
      if (!this.data.editing) this.flush();
      ui.toast(this.t('nbImportedProtocol'));
    },
  },
});
