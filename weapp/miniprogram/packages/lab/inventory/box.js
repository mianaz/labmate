// One box (the web's box panel + sample column, phone drill-down): the position
// grid, the box's sample list, and bottom sheets for a sample's details, the
// sample form, moving, bulk add / edit / delete and the box form.
//   ?id=<box id>[&sample=<sample id>]  — sample opens its detail sheet.
const pageBehavior = require('../../../behaviors/page');
const bus = require('../../../lib/bus');
const ui = require('../../../lib/ui');
const { t, tf } = require('../../../shared/i18n.js');
const U = require('./lib/utils');
const store = require('./lib/store');
const A = require('./lib/actions');

const BLANK_BULK_ADD = { name: '', nameZh: '', sampleType: 'reagent', quantity: '', concentration: '', owner: '', expiryDate: '', tags: '', description: '', notes: '' };
const BLANK_BULK_EDIT = { owner: '', sampleType: '', expiryDate: '', tags: '' };

Component({
  behaviors: [pageBehavior],
  data: {
    loaded: false,
    found: true,
    box: null, // header view model
    gridBox: null,
    gridSamples: [],
    rows: [],
    canUndo: false,
    activePos: '',
    // select mode
    selectMode: false, selected: [], anchor: '', selEmpty: 0, selOcc: 0, selText: '',
    // sheets
    detail: null,
    formShow: false, formSample: null, formPos: '',
    moveShow: false, moveId: 0,
    boxFormShow: false, editBox: null,
    bulkAddShow: false, bulkAdd: BLANK_BULK_ADD, bulkAddTypeIdx: 5,
    bulkEditShow: false, bulkEdit: BLANK_BULK_EDIT, bulkEditTypeIdx: 0,
    typeOptions: [], editTypeOptions: [],
  },
  lifetimes: {
    attached() {
      this._off = bus.on('inventory', () => { if (this._boxId != null) this.reload(); });
    },
    detached() { if (this._off) this._off(); },
  },
  methods: {
    onLoad(query) {
      this._boxId = Number(query && query.id);
      this.reload();
      const sid = query && query.sample ? Number(query.sample) : 0;
      if (sid) this.openDetail(sid);
    },
    onPageShow() {
      if (this._shown) this.reload();
      this._shown = true;
    },
    onLangChange() { this.reload(); },
    pageTitle() {
      return this.data.box ? this.data.box.name : t('tabInventory', this.data.lang);
    },

    // ── View model ─────────────────────────────────────────────────────────
    reload() {
      const lang = this.data.lang;
      const data = store.load();
      this._data = data;
      const box = data.boxes.find((b) => b.id === this._boxId) || null;
      this._box = box;
      const typeOptions = U.SAMPLE_TYPES.map((tp) => t(U.SAMPLE_TYPE_LABELS[tp], lang));
      if (!box) {
        this.setData({ loaded: true, found: false, box: null, gridBox: null, detail: null, canUndo: store.canUndo(), typeOptions });
        return;
      }
      const loc = data.locations.find((l) => l.id === box.locationId) || null;
      const samples = U.boxSamples(data, box.id);
      this._samples = samples;
      const now = Date.now();
      const name = U.nameOf(box, lang);
      const prevName = this.data.box && this.data.box.name;
      this.setData(Object.assign({
        loaded: true,
        found: true,
        canUndo: store.canUndo(),
        typeOptions,
        editTypeOptions: [t('invBulkNoChange', lang)].concat(typeOptions),
        box: {
          id: box.id, name, color: box.color || '',
          loc: loc ? U.nameOf(loc, lang) + (loc.temperature ? ' · ' + loc.temperature : '') : '',
          desc: box.rows + ' × ' + box.cols + ' · ' + t(U.BOX_TYPE_LABELS[box.boxType] || 'invBoxCustom', lang),
          count: samples.length, total: box.rows * box.cols,
        },
        gridBox: { id: box.id, name, rows: box.rows, cols: box.cols },
        gridSamples: samples.map((s) => ({ id: s.id, position: s.position, name: s.name, sampleType: s.sampleType, expiryDate: s.expiryDate })),
        rows: samples.slice().sort((a, b) => U.comparePos(a.position, b.position)).map((s) => {
          const du = U.daysUntil(s.expiryDate, now);
          return {
            id: s.id, pos: s.position || '—', name: s.name,
            type: U.normalizeSampleType(s.sampleType), typeLabel: t(U.typeLabelKey(s.sampleType), lang),
            expired: du !== null && du < 0,
            warn: du !== null && du >= 0 && du <= 7 ? du + 'd' : '',
            soon: du !== null && du > 7 && du <= 30 ? du + ' d' : '',
            qty: s.quantity || '', owner: s.owner || '',
          };
        }),
      }, this.selectionState(this.data.selected)));
      if (prevName !== name) this.applyTitle();
      if (this.data.detail) this.openDetail(this.data.detail.id, true);
    },

    sampleById(id) { return this._data.samples.find((s) => s.id === id) || null; },
    sampleAt(pos) { return (this._samples || []).find((s) => s.position === pos) || null; },

    // ── Grid ───────────────────────────────────────────────────────────────
    onCell(e) {
      const { pos, sampleId } = e.detail;
      if (this.data.selectMode) {
        const anchor = this.data.anchor;
        if (anchor && anchor !== pos) this.selectRange(anchor, pos);
        else this.toggleCells([pos]);
        return;
      }
      if (sampleId) this.openDetail(sampleId);
      else this.openAdd(pos);
    },
    // Long-press: a range anchor in select mode, otherwise straight to the form
    // (the web's double-click on a sample).
    onLongCell(e) {
      const { pos, sampleId } = e.detail;
      if (this.data.selectMode) {
        this.setData({ anchor: this.data.anchor === pos ? '' : pos });
        return;
      }
      if (sampleId) this.openEdit(sampleId);
      else this.openAdd(pos);
    },
    onLine(e) {
      const positions = e.detail.positions || [];
      const sel = this.data.selected;
      const all = positions.every((p) => sel.indexOf(p) >= 0);
      const next = all ? sel.filter((p) => positions.indexOf(p) < 0) : sel.concat(positions.filter((p) => sel.indexOf(p) < 0));
      this.setSelection(next);
    },
    openRow(e) { this.openDetail(e.currentTarget.dataset.id); },

    // ── Select mode ────────────────────────────────────────────────────────
    toggleSelect() {
      const on = !this.data.selectMode;
      this.setData(Object.assign({ selectMode: on, anchor: '', activePos: '' }, this.selectionState([])));
    },
    clearSelection() { this.setSelection([]); },
    toggleCells(positions) {
      const sel = this.data.selected.slice();
      positions.forEach((p) => {
        const i = sel.indexOf(p);
        if (i >= 0) sel.splice(i, 1); else sel.push(p);
      });
      this.setSelection(sel);
    },
    selectRange(a, b) {
      const pa = U.parsePos(a);
      const pb = U.parsePos(b);
      if (!pa || !pb) return;
      const sel = this.data.selected.slice();
      for (let r = Math.min(pa.r, pb.r); r <= Math.max(pa.r, pb.r); r++) {
        for (let c = Math.min(pa.c, pb.c); c <= Math.max(pa.c, pb.c); c++) {
          const p = U.posLabel(r, c);
          if (sel.indexOf(p) < 0) sel.push(p);
        }
      }
      this.setSelection(sel);
    },
    setSelection(selected) {
      this.setData(Object.assign({ anchor: '' }, this.selectionState(selected)));
    },
    selectionState(selected) {
      const lang = this.data.lang;
      const box = this._box;
      const valid = box ? selected.filter((p) => { const q = U.parsePos(p); return q && q.r < box.rows && q.c < box.cols; }) : [];
      let occ = 0;
      valid.forEach((p) => { if (this.sampleAt(p)) occ++; });
      const empty = valid.length - occ;
      const n = valid.length;
      return {
        selected: valid, selOcc: occ, selEmpty: empty,
        selText: n === 0 ? t('invSelectHint', lang)
          : tf('invSelectedN', lang, { n }) + (empty > 0 ? ' · ' + tf('invEmptyN', lang, { n: empty }) : ''),
      };
    },
    selectedIds() {
      return this.data.selected.map((p) => this.sampleAt(p)).filter(Boolean).map((s) => s.id);
    },

    // ── Sample detail ──────────────────────────────────────────────────────
    openDetail(id, refresh) {
      const lang = this.data.lang;
      const s = this.sampleById(Number(id));
      if (!s || !this._box || s.boxId !== this._box.id) {
        this.setData({ detail: null, activePos: '' });
        if (!refresh && s) ui.go('/packages/lab/inventory/box?id=' + s.boxId + '&sample=' + s.id);
        return;
      }
      const loc = this._data.locations.find((l) => l.id === this._box.locationId);
      const du = U.daysUntil(s.expiryDate);
      const expired = du !== null && du < 0;
      const soon = du !== null && du >= 0 && du <= 30;
      const exp = U.isoDate(s.expiryDate);
      this.setData({
        activePos: s.position || '',
        detail: {
          id: s.id, name: s.name, pos: s.position || '—',
          nameZh: s.nameZh && s.nameZh !== s.name ? s.nameZh : '',
          type: U.normalizeSampleType(s.sampleType), typeLabel: t(U.typeLabelKey(s.sampleType), lang),
          expired, warn: !expired && du !== null && du <= 7 ? du + 'd' : '',
          tags: s.tags || [],
          fields: [
            { k: 'box', label: t('invColBox', lang), v: U.nameOf(this._box, lang) },
            { k: 'loc', label: t('invColLocation', lang), v: loc ? U.nameOf(loc, lang) + (loc.temperature ? ' · ' + loc.temperature : '') : '' },
            { k: 'qty', label: t('invQuantity', lang), v: s.quantity || '' },
            { k: 'conc', label: t('invConcentration', lang), v: s.concentration || '' },
            { k: 'pass', label: t('invPassage', lang), v: s.passage || '' },
            { k: 'owner', label: t('invOwner', lang), v: s.owner || '' },
            { k: 'stored', label: t('invDateStored', lang), v: U.isoDate(s.dateStored) },
            {
              k: 'exp', label: t('invExpiryDate', lang),
              v: exp ? exp + (expired ? ' · ' + t('expired', lang) : soon ? ' · ' + du + ' d' : '') : '',
              tone: expired ? 'danger' : soon ? 'inv-warn-text' : '',
            },
          ],
          description: s.description || '',
          notes: s.notes || '',
        },
      });
    },
    closeDetail() { this.setData({ detail: null }); },
    detailEdit() {
      const id = this.data.detail && this.data.detail.id;
      if (!id) return;
      this._returnTo = id;
      this.setData({ detail: null });
      this.openEdit(id);
    },
    detailMove() {
      const id = this.data.detail && this.data.detail.id;
      if (!id) return;
      this.setData({ detail: null, moveShow: true, moveId: id });
    },
    detailDuplicate() {
      const id = this.data.detail && this.data.detail.id;
      if (!id) return;
      const res = store.duplicateSample(id);
      if (!A.check(res, this.data.lang)) return;
      ui.toast(tf('invDuplicatedTo', this.data.lang, { pos: res.position }));
      this.openDetail(res.id);
    },
    detailDelete() {
      const id = this.data.detail && this.data.detail.id;
      if (!id) return Promise.resolve(false);
      return this.confirmDeleteSample(id).then((ok) => {
        if (ok) this.setData({ detail: null, activePos: '' });
        return ok;
      });
    },
    confirmDeleteSample(id) {
      const lang = this.data.lang;
      const s = this.sampleById(id);
      if (!s) return Promise.resolve(false);
      return ui.confirm(tf('invDelSampleBody', lang, { name: s.name, pos: s.position || '—' }), {
        title: t('invDeleteSample', lang), danger: true, confirmText: t('deleteCustom', lang),
      }).then((ok) => {
        if (!ok) return false;
        const res = store.deleteSample(id);
        if (!A.check(res, lang)) return false;
        ui.toast(t('invSampleDeleted', lang));
        return true;
      });
    },

    // ── Sample form ────────────────────────────────────────────────────────
    addSample() {
      const pos = U.findNextEmpty(this._box, this._samples || []);
      if (!pos) { ui.toast(t('invNoEmptySlots', this.data.lang)); return; }
      this.openAdd(pos);
    },
    openAdd(pos) {
      this._returnTo = null;
      this.setData({ formShow: true, formSample: null, formPos: pos });
    },
    openEdit(id) {
      const s = this.sampleById(id);
      if (!s) return;
      this.setData({ formShow: true, formSample: s, formPos: s.position || '' });
    },
    closeForm() {
      const back = this._returnTo;
      this._returnTo = null;
      this.setData({ formShow: false, formSample: null });
      if (back && this.sampleById(back)) this.openDetail(back);
    },
    onFormSave(e) {
      const editing = this.data.formSample;
      const res = editing
        ? store.saveSample(e.detail.form, { id: editing.id })
        : store.saveSample(e.detail.form, { boxId: this._box.id, position: this.data.formPos });
      if (!A.check(res, this.data.lang)) return;
      if (!editing) this.setData({ activePos: this.data.formPos });
      this.closeForm();
    },
    onFormDelete() {
      const editing = this.data.formSample;
      if (!editing) return Promise.resolve(false);
      return this.confirmDeleteSample(editing.id).then((ok) => {
        if (ok) { this._returnTo = null; this.setData({ formShow: false, formSample: null, activePos: '' }); }
        return ok;
      });
    },

    // ── Move ───────────────────────────────────────────────────────────────
    closeMove() {
      const id = this.data.moveId;
      this.setData({ moveShow: false });
      if (id && this.sampleById(id)) this.openDetail(id);
    },
    onMove(e) {
      const lang = this.data.lang;
      const { sampleId, boxId, position } = e.detail;
      const res = store.moveSample(sampleId, boxId, position);
      if (!A.check(res, lang)) return;
      const target = this._data.boxes.find((b) => b.id === boxId);
      ui.toast(tf('invMovedTo', lang, { where: (target ? U.nameOf(target, lang) + ' · ' : '') + position }));
      this.setData({ moveShow: false, moveId: 0 });
      // Follow the sample, like the web selects its new box.
      if (boxId !== this._box.id) wx.redirectTo({ url: '/packages/lab/inventory/box?id=' + boxId + '&sample=' + sampleId });
      else this.openDetail(sampleId);
    },

    // ── Box ────────────────────────────────────────────────────────────────
    editBox() { this.setData({ boxFormShow: true, editBox: this._box }); },
    closeBoxForm() { this.setData({ boxFormShow: false, editBox: null }); },
    onBoxSave(e) {
      const res = store.saveBox(e.detail.form, this._box.locationId, this._box.id);
      if (A.check(res, this.data.lang)) this.closeBoxForm();
    },
    boxMore() {
      const lang = this.data.lang;
      ui.actionSheet([t('invExportBoxCsv', lang), t('invImportCsv', lang), t('invDownloadTemplate', lang), t('invDeleteBox', lang)]).then((i) => {
        if (i === 0) this.exportBox();
        else if (i === 1) this.importCsv();
        else if (i === 2) this.downloadTemplate();
        else if (i === 3) this.deleteBox();
      });
    },
    exportBox() {
      const box = this._box;
      return A.shareFile('inventory-' + U.safeFileName(box.name) + '.csv', U.invExportBoxCsv(store.load(), box.id), this.data.lang);
    },
    downloadTemplate() {
      return A.shareFile('inventory-template.csv', U.invCsvTemplate(), this.data.lang);
    },
    importCsv() {
      const lang = this.data.lang;
      const boxId = this._box.id;
      return A.pickFile(['csv', 'txt'], lang).then((content) => {
        if (content === null) return false;
        const res = store.importCsv(boxId, content);
        if (!A.check(res, lang)) return false;
        ui.toast(A.importMessage(res, lang));
        return true;
      });
    },
    deleteBox() {
      const lang = this.data.lang;
      const box = this._box;
      return ui.confirm(tf('invDelBoxBody', lang, { name: U.nameOf(box, lang), samples: (this._samples || []).length }), {
        title: t('invDeleteBox', lang), danger: true, confirmText: t('deleteCustom', lang),
      }).then((ok) => {
        if (!ok) return false;
        const res = store.deleteBox(box.id);
        if (!A.check(res, lang)) return false;
        ui.toast(t('invBoxDeleted', lang));
        this.goBack();
        return true;
      });
    },
    goBack() {
      wx.navigateBack({ fail: () => wx.redirectTo({ url: '/packages/lab/inventory/index' }) });
    },
    undo() {
      const res = store.undo();
      if (res.ok) ui.toast(t('invUndone', this.data.lang));
      else if (res.reason === 'empty') ui.toast(t('invNoUndo', this.data.lang));
      else A.check(res, this.data.lang);
    },

    // ── Bulk add / edit / delete ───────────────────────────────────────────
    openBulkAdd() {
      if (!this.data.selEmpty) return;
      this.setData({ bulkAddShow: true, bulkAdd: BLANK_BULK_ADD, bulkAddTypeIdx: U.SAMPLE_TYPES.indexOf('reagent') });
    },
    closeBulkAdd() { this.setData({ bulkAddShow: false }); },
    onBulkAddInput(e) { this.setData({ ['bulkAdd.' + e.currentTarget.dataset.k]: e.detail.value }); },
    onBulkAddType(e) {
      const i = Number(e.detail.value);
      this.setData({ bulkAddTypeIdx: i, 'bulkAdd.sampleType': U.SAMPLE_TYPES[i] || 'other' });
    },
    saveBulkAdd() {
      const lang = this.data.lang;
      const positions = this.data.selected.filter((p) => !this.sampleAt(p));
      const res = store.bulkAdd(this._box.id, positions, this.data.bulkAdd);
      if (!A.check(res, lang)) return;
      ui.toast(tf('invSamplesAdded', lang, { n: res.count }));
      this.setData(Object.assign({ bulkAddShow: false }, this.selectionState([])));
    },
    openBulkEdit() {
      if (!this.data.selOcc) return;
      this.setData({ bulkEditShow: true, bulkEdit: BLANK_BULK_EDIT, bulkEditTypeIdx: 0 });
    },
    closeBulkEdit() { this.setData({ bulkEditShow: false }); },
    onBulkEditInput(e) { this.setData({ ['bulkEdit.' + e.currentTarget.dataset.k]: e.detail.value }); },
    onBulkEditType(e) {
      const i = Number(e.detail.value);
      this.setData({ bulkEditTypeIdx: i, 'bulkEdit.sampleType': i > 0 ? U.SAMPLE_TYPES[i - 1] : '' });
    },
    clearBulkDate(e) {
      this.setData({ [e.currentTarget.dataset.k]: '' });
    },
    saveBulkEdit() {
      const lang = this.data.lang;
      const res = store.bulkEdit(this.selectedIds(), this.data.bulkEdit);
      if (!A.check(res, lang)) return;
      ui.toast(tf('invSamplesEdited', lang, { n: res.count }));
      this.setData(Object.assign({ bulkEditShow: false }, this.selectionState([])));
    },
    bulkDelete() {
      const lang = this.data.lang;
      const ids = this.selectedIds();
      if (!ids.length) return Promise.resolve(false);
      return ui.confirm(tf('invDelSamplesBody', lang, { n: ids.length }), {
        title: t('invBulkDelConfirm', lang), danger: true, confirmText: t('deleteCustom', lang),
      }).then((ok) => {
        if (!ok) return false;
        const res = store.deleteSamples(ids);
        if (!A.check(res, lang)) return false;
        ui.toast(tf('invSamplesDeleted', lang, { n: res.count }));
        this.setData(this.selectionState([]));
        return true;
      });
    },
  },
});
