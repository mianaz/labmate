// Inventory home (the web's InventoryTab, phone layout): header · toolbar
// (sample search, Boxes / All samples, undo, stats) · overview strip · storage
// tree (locations → boxes). A box opens packages/lab/inventory/box; forms are
// bottom sheets. Data: `labmate_inventory`, same shape as the web app.
const pageBehavior = require('../../../behaviors/page');
const bus = require('../../../lib/bus');
const ui = require('../../../lib/ui');
const { isoDate: localDate } = require('../../../lib/format');
const { t, tf } = require('../../../shared/i18n.js');
const U = require('./lib/utils');
const store = require('./lib/store');
const A = require('./lib/actions');

const BOX_PAGE = '/packages/lab/inventory/box';
const MAX_ROWS = 300; // rows rendered in search results / all-samples (setData size)
const SORTS = [
  ['name', 'invColName'], ['sampleType', 'invColType'], ['locName', 'invColLocation'], ['boxName', 'invColBox'],
  ['quantity', 'invColQty'], ['owner', 'invColOwner'], ['date', 'invColDate'],
];
const EMPTY_FILTERS = { name: '', type: '', location: '', box: '', owner: '' };

Component({
  behaviors: [pageBehavior],
  data: {
    titleKey: 'tabInventory',
    loaded: false,
    hasLocations: false,
    meta: '',
    view: 'grid', // 'grid' = storage tree, 'list' = all samples
    canUndo: false,
    tree: [],
    dash: null,
    // search
    search: '',
    searching: false,
    results: [],
    resultsCount: 0,
    resultsMore: 0,
    // all samples
    lf: EMPTY_FILTERS,
    sortIdx: 0,
    dir: 'asc',
    sortOpts: [],
    typeOpts: [], locOpts: [], boxOpts: [], ownerOpts: [],
    typeIdx: 0, locIdx: 0, boxIdx: 0, ownerIdx: 0,
    listRows: [], listMore: 0, listCount: '', hasFilters: false,
    // sheets
    locFormShow: false, editLoc: null,
    boxFormShow: false, editBox: null, boxLocName: '',
    statsShow: false,
    importShow: false, importBoxes: [], importBoxIdx: 0,
    csvColumns: U.CSV_COLUMNS,
  },
  lifetimes: {
    attached() {
      this._collapsed = {};
      this._off = bus.on('inventory', () => this.reload());
      this.reload();
    },
    detached() {
      if (this._off) this._off();
      clearTimeout(this._searchTimer);
      clearTimeout(this._nameTimer);
    },
  },
  methods: {
    onPageShow() {
      if (this._shown) this.reload();
      this._shown = true;
    },
    onLangChange() { this.reload(); },

    // ── View model ─────────────────────────────────────────────────────────
    reload() {
      const lang = this.data.lang;
      const zh = lang === 'zh';
      const data = store.load();
      this._data = data;
      const perBox = {};
      data.samples.forEach((s) => { perBox[s.boxId] = (perBox[s.boxId] || 0) + 1; });
      const tree = data.locations.map((loc) => ({
        id: loc.id,
        name: U.nameOf(loc, lang),
        temp: loc.temperature || '',
        type: U.STORAGE_TYPE_LABELS[loc.type] ? loc.type : 'shelf',
        open: !this._collapsed[loc.id],
        boxes: data.boxes.filter((b) => b.locationId === loc.id).map((b) => ({
          id: b.id, name: U.nameOf(b, lang), color: b.color || '',
          count: perBox[b.id] || 0, total: b.rows * b.cols,
        })),
      }));
      const n = data.samples.length;
      this.setData(Object.assign({
        loaded: true,
        hasLocations: data.locations.length > 0,
        meta: n > 0 ? n + (zh ? ' 个样品' : ' samples') : '',
        canUndo: store.canUndo(),
        tree,
        dash: this.buildDash(data),
        sortOpts: SORTS.map((s) => ({ key: s[0], label: t(s[1], lang) })),
      }, this.buildResults(), this.data.view === 'list' ? this.buildList() : {}));
    },

    // Overview strip (dismissible; its switch also lives in the stats sheet).
    buildDash(data) {
      if (!store.dashboardShown() || (!data.samples.length && !data.boxes.length)) return null;
      const lang = this.data.lang;
      const zh = lang === 'zh';
      const st = U.computeStats(data);
      const days = t('invStatsDays', lang);
      return [
        {
          k: 'samples', label: t('invStatsSamples', lang), value: data.samples.length,
          sub: data.boxes.length + (zh ? ' 个盒子 · ' : ' boxes · ') + data.locations.length + (zh ? ' 个位置' : ' locations'),
        },
        {
          k: 'util', label: t('invStatsUtilization', lang), value: st.utilPct + '%', meter: st.utilPct,
          tone: U.utilTone(st.utilPct), sub: st.occupiedPositions + ' / ' + st.totalPositions,
        },
        {
          k: 'exp', label: t('invStatsExpiring', lang), value: st.expiring30, warn: st.expiring30 > 0,
          sub: '≤ 30 ' + days + ' · ≤ 7: ' + st.expiring7,
        },
        {
          k: 'new', label: t('invStatsRecentlyAdded', lang), value: st.added7,
          sub: '≤ 7 ' + days + ' · ≤ 30: ' + st.added30,
        },
      ];
    },

    // Where a sample lives: "Freezer A / Box 1".
    placeIndex() {
      const lang = this.data.lang;
      const data = this._data;
      const locs = {};
      data.locations.forEach((l) => { locs[l.id] = l; });
      const boxes = {};
      data.boxes.forEach((b) => {
        const loc = locs[b.locationId];
        boxes[b.id] = { box: b, loc, boxName: U.nameOf(b, lang), locName: loc ? U.nameOf(loc, lang) : '', locTemp: loc ? loc.temperature || '' : '' };
      });
      return boxes;
    },

    buildResults() {
      const q = this.data.search.trim().toLowerCase();
      if (!q || !this._data) return { searching: false, results: [], resultsMore: 0 };
      const lang = this.data.lang;
      const place = this.placeIndex();
      const hits = this._data.samples.filter((s) => U.matchesSearch(s, q));
      return {
        searching: true,
        resultsCount: hits.length,
        resultsMore: Math.max(0, hits.length - MAX_ROWS),
        results: hits.slice(0, MAX_ROWS).map((s) => {
          const p = place[s.boxId];
          return {
            id: s.id, boxId: s.boxId, name: s.name, pos: s.position || '',
            type: U.normalizeSampleType(s.sampleType), typeLabel: t(U.typeLabelKey(s.sampleType), lang),
            where: p ? (p.locName ? p.locName + ' / ' : '') + p.boxName : '',
            qty: s.quantity || '', owner: s.owner || '',
          };
        }),
      };
    },

    // All samples: filters (type / location / box / owner / name) and sort.
    buildList() {
      const lang = this.data.lang;
      const zh = lang === 'zh';
      const place = this.placeIndex();
      const all = [];
      this._data.samples.forEach((s) => {
        const p = place[s.boxId];
        if (!p) return; // the web lists samples through their boxes
        all.push({ s, boxName: p.boxName, locName: p.locName, locTemp: p.locTemp });
      });
      const uniq = (arr) => arr.filter((v, i) => v && arr.indexOf(v) === i);
      const allLabel = '— ' + t('all', lang);
      const opts = (values, labelOf) => [{ v: '', label: allLabel }].concat(values.map((v) => ({ v, label: labelOf ? labelOf(v) : v })));
      const typeOpts = opts(uniq(all.map((x) => x.s.sampleType)), (tp) => t(U.typeLabelKey(tp), lang));
      const locOpts = opts(uniq(all.map((x) => x.locName)));
      const boxOpts = opts(uniq(all.map((x) => x.boxName)));
      const ownerOpts = opts(uniq(all.map((x) => x.s.owner)));
      const f = this.data.lf;
      const idx = (list, v) => Math.max(0, list.findIndex((o) => o.v === v));
      const name = f.name.trim().toLowerCase();
      const sortKey = SORTS[this.data.sortIdx] ? SORTS[this.data.sortIdx][0] : 'name';
      const valueOf = (x) => {
        if (sortKey === 'date') return x.s.dateStored || 0;
        if (sortKey === 'locName' || sortKey === 'boxName') return x[sortKey] || '';
        return x.s[sortKey] || '';
      };
      const filtered = all.filter((x) => {
        if (name && String(x.s.name || '').toLowerCase().indexOf(name) < 0) return false;
        if (f.type && x.s.sampleType !== f.type) return false;
        if (f.location && x.locName !== f.location) return false;
        if (f.box && x.boxName !== f.box) return false;
        if (f.owner && (x.s.owner || '') !== f.owner) return false;
        return true;
      }).sort((a, b) => {
        const av = valueOf(a);
        const bv = valueOf(b);
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return this.data.dir === 'desc' ? -cmp : cmp;
      });
      return {
        typeOpts, locOpts, boxOpts, ownerOpts,
        typeIdx: idx(typeOpts, f.type), locIdx: idx(locOpts, f.location), boxIdx: idx(boxOpts, f.box), ownerIdx: idx(ownerOpts, f.owner),
        hasFilters: !!(f.name || f.type || f.location || f.box || f.owner),
        listCount: filtered.length + t('invResults', lang) +
          (filtered.length < all.length ? (zh ? ' / 共 ' + all.length : ' / ' + all.length + ' total') : ''),
        listMore: Math.max(0, filtered.length - MAX_ROWS),
        listRows: filtered.slice(0, MAX_ROWS).map((x) => ({
          id: x.s.id, boxId: x.s.boxId, name: x.s.name, pos: x.s.position || '',
          type: U.normalizeSampleType(x.s.sampleType), typeLabel: t(U.typeLabelKey(x.s.sampleType), lang),
          where: (x.locName ? x.locName + (x.locTemp ? ' (' + x.locTemp + ')' : '') + ' / ' : '') + x.boxName,
          qty: x.s.quantity || '', owner: x.s.owner || '', date: U.isoDate(x.s.dateStored),
        })),
      };
    },

    // ── Toolbar ────────────────────────────────────────────────────────────
    onSearch(e) {
      this.setData({ search: e.detail.value });
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.setData(this.buildResults()), 150);
    },
    clearSearch() { this.setData(Object.assign({ search: '' }, { searching: false, results: [], resultsMore: 0 })); },
    setView(e) {
      const view = e.currentTarget.dataset.view;
      this.setData({ view });
      if (view === 'list') this.setData(this.buildList());
    },
    undo() {
      const res = store.undo();
      if (res.ok) ui.toast(t('invUndone', this.data.lang));
      else if (res.reason === 'empty') ui.toast(t('invNoUndo', this.data.lang));
      else A.check(res, this.data.lang);
    },
    openStats() { this.setData({ statsShow: true }); },
    closeStats() { this.setData({ statsShow: false }); },
    dismissDash() { store.setDashboardShown(false); },

    // ── All samples ────────────────────────────────────────────────────────
    onListName(e) {
      this.setData({ 'lf.name': e.detail.value });
      clearTimeout(this._nameTimer);
      this._nameTimer = setTimeout(() => this.setData(this.buildList()), 150);
    },
    onFilter(e) {
      const k = e.currentTarget.dataset.k;
      const list = this.data[k + 'Opts'];
      const opt = list[Number(e.detail.value)];
      const field = k === 'loc' ? 'location' : k;
      this.setData({ ['lf.' + field]: opt ? opt.v : '' });
      this.setData(this.buildList());
    },
    onSort(e) {
      this.setData({ sortIdx: Number(e.detail.value), dir: 'asc' });
      this.setData(this.buildList());
    },
    toggleDir() {
      this.setData({ dir: this.data.dir === 'asc' ? 'desc' : 'asc' });
      this.setData(this.buildList());
    },
    clearFilters() {
      this.setData({ lf: EMPTY_FILTERS, sortIdx: 0, dir: 'asc' });
      this.setData(this.buildList());
    },

    // ── Navigation ─────────────────────────────────────────────────────────
    openBox(e) {
      ui.go(BOX_PAGE + '?id=' + e.currentTarget.dataset.id);
    },
    openSample(e) {
      const ds = e.currentTarget.dataset;
      ui.go(BOX_PAGE + '?id=' + ds.box + '&sample=' + ds.id);
    },
    toggleLoc(e) {
      const id = e.currentTarget.dataset.id;
      this._collapsed[id] = !this._collapsed[id];
      const i = this.data.tree.findIndex((l) => l.id === id);
      if (i >= 0) this.setData({ ['tree[' + i + '].open']: !this._collapsed[id] });
    },

    // ── Locations ──────────────────────────────────────────────────────────
    findLoc(id) { return this._data.locations.find((l) => l.id === id) || null; },
    openAddLocation() { this.setData({ locFormShow: true, editLoc: null }); },
    closeLocForm() { this.setData({ locFormShow: false, editLoc: null }); },
    onLocSave(e) {
      const editing = this.data.editLoc;
      const res = store.saveLocation(e.detail.form, editing ? editing.id : undefined);
      if (A.check(res, this.data.lang)) this.closeLocForm();
    },
    locMenu(e) {
      const loc = this.findLoc(e.currentTarget.dataset.id);
      if (!loc) return;
      const lang = this.data.lang;
      ui.actionSheet([t('invAddBox', lang), t('invEditLocation', lang), t('invDeleteLocation', lang)]).then((i) => {
        if (i === 0) this.openAddBoxFor(loc);
        else if (i === 1) this.setData({ locFormShow: true, editLoc: loc });
        else if (i === 2) this.deleteLocation(loc);
      });
    },
    deleteLocation(loc) {
      const lang = this.data.lang;
      const boxIds = this._data.boxes.filter((b) => b.locationId === loc.id).map((b) => b.id);
      const samples = this._data.samples.filter((s) => boxIds.indexOf(s.boxId) >= 0).length;
      return ui.confirm(tf('invDelLocBody', lang, { name: U.nameOf(loc, lang), boxes: boxIds.length, samples }), {
        title: t('invDeleteLocation', lang), danger: true, confirmText: t('deleteCustom', lang),
      }).then((ok) => {
        if (!ok) return false;
        const res = store.deleteLocation(loc.id);
        if (A.check(res, lang)) { ui.toast(t('invLocationDeleted', lang)); return true; }
        return false;
      });
    },

    // ── Boxes ──────────────────────────────────────────────────────────────
    addBoxTap(e) {
      const loc = this.findLoc(e.currentTarget.dataset.id);
      if (loc) this.openAddBoxFor(loc);
    },
    openAddBoxFor(loc) {
      this._boxLocId = loc.id;
      this.setData({ boxFormShow: true, editBox: null, boxLocName: U.nameOf(loc, this.data.lang) });
    },
    closeBoxForm() { this.setData({ boxFormShow: false, editBox: null }); },
    onBoxSave(e) {
      const editing = this.data.editBox;
      const res = editing
        ? store.saveBox(e.detail.form, editing.locationId, editing.id)
        : store.saveBox(e.detail.form, this._boxLocId);
      if (A.check(res, this.data.lang)) this.closeBoxForm();
    },
    boxMenu(e) {
      const box = this._data.boxes.find((b) => b.id === e.currentTarget.dataset.id);
      if (!box) return;
      const lang = this.data.lang;
      ui.actionSheet([t('invEditBox', lang), t('invDeleteBox', lang)]).then((i) => {
        if (i === 0) this.setData({ boxFormShow: true, editBox: box, boxLocName: '' });
        else if (i === 1) this.deleteBox(box);
      });
    },
    deleteBox(box) {
      const lang = this.data.lang;
      const samples = this._data.samples.filter((s) => s.boxId === box.id).length;
      return ui.confirm(tf('invDelBoxBody', lang, { name: U.nameOf(box, lang), samples }), {
        title: t('invDeleteBox', lang), danger: true, confirmText: t('deleteCustom', lang),
      }).then((ok) => {
        if (!ok) return false;
        const res = store.deleteBox(box.id);
        if (A.check(res, lang)) { ui.toast(t('invBoxDeleted', lang)); return true; }
        return false;
      });
    },

    // ── Import / export ────────────────────────────────────────────────────
    openImport() {
      const lang = this.data.lang;
      const zh = lang === 'zh';
      const data = this._data;
      const perBox = {};
      data.samples.forEach((s) => { perBox[s.boxId] = (perBox[s.boxId] || 0) + 1; });
      const importBoxes = [];
      data.locations.forEach((loc) => {
        data.boxes.filter((b) => b.locationId === loc.id).forEach((b) => {
          importBoxes.push({
            id: b.id,
            label: U.nameOf(loc, lang) + ' › ' + U.nameOf(b, lang) + ' · ' + (b.rows * b.cols - (perBox[b.id] || 0)) + (zh ? ' 个空位' : ' free'),
          });
        });
      });
      this.setData({ importShow: true, importBoxes, importBoxIdx: 0 });
    },
    closeImport() { this.setData({ importShow: false }); },
    onImportBox(e) { this.setData({ importBoxIdx: Number(e.detail.value) }); },
    importCsv() {
      const lang = this.data.lang;
      const target = this.data.importBoxes[this.data.importBoxIdx];
      if (!target) return Promise.resolve(false);
      return A.pickFile(['csv', 'txt'], lang).then((content) => {
        if (content === null) return false;
        const res = store.importCsv(target.id, content);
        if (!A.check(res, lang)) return false;
        this.setData({ importShow: false });
        ui.toast(A.importMessage(res, lang));
        return true;
      });
    },
    importJson() {
      const lang = this.data.lang;
      return A.pickFile(['json', 'txt'], lang).then((content) => {
        if (content === null) return false;
        const res = store.importJson(content);
        if (!A.check(res, lang)) return false;
        this.setData({ importShow: false });
        ui.toast(A.importMessage(res, lang));
        return true;
      });
    },
    openExport() {
      const lang = this.data.lang;
      ui.actionSheet([t('invExportAllCsv', lang), t('invExportJson', lang), t('invDownloadTemplate', lang)]).then((i) => {
        if (i === 0) this.exportAllCsv();
        else if (i === 1) this.exportJson();
        else if (i === 2) this.downloadTemplate();
      });
    },
    exportAllCsv() {
      return A.shareFile('inventory-all-' + localDate() + '.csv', U.invExportAllCsv(store.load()), this.data.lang);
    },
    exportJson() {
      return A.shareFile('inventory-backup-' + localDate() + '.json', store.exportJson(), this.data.lang);
    },
    downloadTemplate() {
      return A.shareFile('inventory-template.csv', U.invCsvTemplate(), this.data.lang);
    },
  },
});
