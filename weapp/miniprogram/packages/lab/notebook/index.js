// Experiment notebook — the list (web: src/features/notebook/NotebookTab.jsx,
// master list + first-run panel + JSON export/import). A row opens
// notebook/edit, which is the web's side-by-side document as a pushed page.
const pageBehavior = require('../../../behaviors/page');
const bus = require('../../../lib/bus');
const experiments = require('../../../lib/experiments');
const ui = require('../../../lib/ui');
const { isoDate } = require('../../../lib/format');
const { tf } = require('../../../shared/i18n.js');
const nb = require('../components/nb-shared/model');

const FILTERS = ['all'].concat(nb.STATUS_IDS);
const SECTIONS = [
  { num: '01', key: 'nbPlan', desc: 'nbPlanDesc' },
  { num: '02', key: 'nbMaterials', desc: 'nbMaterialsDesc' },
  { num: '03', key: 'nbProcedure', desc: 'nbProcedureDesc' },
  { num: '04', key: 'nbResults', desc: 'nbResultsDesc' },
];

Component({
  behaviors: [pageBehavior],
  data: {
    titleKey: 'tabNotebook',
    sections: SECTIONS,
    total: 0,
    countLabel: '',
    listLabel: '',
    search: '',
    statusFilter: 'all',
    chips: [],
    rows: [],
  },
  lifetimes: {
    attached() {
      this.reload();
      this._off = bus.on('experiments', () => this.reload());
    },
    detached() {
      if (this._off) this._off();
      clearTimeout(this._searchTimer);
    },
  },
  methods: {
    onLangChange() { this.refresh(); },

    reload() {
      this._entries = experiments.all();
      this.refresh();
    },

    refresh() {
      const lang = this.data.lang;
      const entries = this._entries || [];
      const filter = this.data.statusFilter;
      const q = this.data.search.trim().toLowerCase();
      const counts = { all: entries.length };
      nb.STATUS_IDS.forEach((s) => { counts[s] = 0; });
      entries.forEach((e) => { if (nb.STATUS_KEY[e.status]) counts[e.status] += 1; });
      const list = entries.filter((e) => (filter === 'all' || e.status === filter) && nb.matchesSearch(e, q));
      const countLabel = nb.entriesCount(entries.length, lang);
      this.setData({
        total: entries.length,
        countLabel,
        listLabel: list.length === entries.length ? countLabel : tf('nbEntriesFiltered', lang, { n: list.length, total: entries.length }),
        chips: FILTERS.map((id) => ({ id, key: id === 'all' ? 'nbAll' : nb.STATUS_KEY[id], count: counts[id] })),
        rows: list.map((e) => nb.listRow(e, lang)),
      });
    },

    onSearch(e) {
      this.setData({ search: e.detail.value });
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.refresh(), 120);
    },
    clearSearch() { this.setData({ search: '' }); this.refresh(); },
    setStatus(e) { this.setData({ statusFilter: e.currentTarget.dataset.id }); this.refresh(); },
    clearFilters() { this.setData({ search: '', statusFilter: 'all' }); this.refresh(); },

    open(e) {
      ui.go('/packages/lab/notebook/edit?id=' + encodeURIComponent(e.currentTarget.dataset.id));
    },

    // New entries open straight in edit mode; clear the filters so the entry
    // shows in the list when we come back (the web's handleNewEntry).
    newEntry() {
      if (this.data.search || this.data.statusFilter !== 'all') this.clearFilters();
      ui.go('/packages/lab/notebook/edit?date=' + isoDate());
    },

    exportJson() {
      if (!this.data.total) return;
      ui.shareTextFile(nb.exportFileName(), nb.exportJSON(experiments.all()))
        .catch((err) => { if (!nb.isCancelError(err)) ui.toast(this.t('nbShareFailed')); });
    },

    importJson() {
      ui.pickTextFile(['json']).then((file) => {
        let entries;
        try {
          entries = nb.parseImportJSON(file.content);
        } catch (err) {
          ui.toast(this.t('nbImportFailed'));
          return;
        }
        experiments.bulkPut(entries);
        ui.toast(this.tf('nbImportedN', { n: entries.length }));
      }).catch((err) => { if (!nb.isCancelError(err)) ui.toast(this.t('nbImportFailed')); });
    },
  },
});
