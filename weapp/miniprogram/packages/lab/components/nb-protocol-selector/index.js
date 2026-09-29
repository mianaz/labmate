// Protocol picker sheet (web: src/features/notebook/ProtocolSelector.jsx), used
// by the notebook editor (import steps into an entry) and the calendar (start a
// new experiment from a protocol). Lists the library's protocols plus the
// user's custom ones, with what an import brings in (steps, materials).
//   <nb-protocol-selector show="{{…}}" title="…" bind:select="…" bind:close="…" />
//   select → detail { id }
const langBehavior = require('../../../../behaviors/lang');
const { tf } = require('../../../../shared/i18n.js');
const nb = require('../nb-shared/model');

function viewRow(r) {
  return {
    id: r.id, primary: r.primary, secondary: r.secondary, steps: r.steps,
    materials: r.materials, duration: r.duration, custom: r.custom,
  };
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    show: { type: Boolean, value: false, observer(v) { if (v) this.build(); } },
    title: { type: String, value: '' },
  },
  data: { search: '', rows: [], countLabel: '' },
  lifetimes: {
    detached() { clearTimeout(this._searchTimer); },
  },
  methods: {
    onLangChange() { if (this.data.show) this.build(); },

    build() {
      this._all = nb.protocolRows(this.data.lang);
      this.setData({ search: '' });
      this.filter();
    },

    filter() {
      const all = this._all || [];
      const q = this.data.search.trim().toLowerCase();
      const list = q ? all.filter((r) => r.q.indexOf(q) >= 0) : all;
      this.setData({
        rows: list.map(viewRow),
        countLabel: tf('nbPsCount', this.data.lang, { n: list.length, total: all.length }),
      });
    },

    onSearch(e) {
      this.setData({ search: e.detail.value });
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.filter(), 120);
    },
    clearSearch() { this.setData({ search: '' }); this.filter(); },

    pick(e) { this.triggerEvent('select', { id: e.currentTarget.dataset.id }); },
    close() { this.triggerEvent('close'); },
    noop() {},
  },
});
