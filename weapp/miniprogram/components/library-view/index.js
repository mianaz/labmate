// Recipes / Protocols list (the web's LibraryView.jsx, list half). Tapping a
// row opens pages/detail; the web's side-by-side detail becomes a pushed page.
const bus = require('../../lib/bus');
const recipes = require('../../lib/recipes');
const favorites = require('../../lib/favorites');
const ui = require('../../lib/ui');
const { t, tf } = require('../../shared/i18n.js');
const langBehavior = require('../../behaviors/lang');

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    kind: { type: String, value: 'buffers' }, // 'buffers' | 'protocols'
  },
  data: {
    search: '',
    scope: 'all', // all | favs | custom
    disc: 'all',
    discOptions: [],
    discIndex: 0,
    rows: [],
    recentRows: [],
    total: 0,
    footer: '',
    filtersActive: false,
    isProtocol: false,
  },
  lifetimes: {
    attached() {
      this.setData({ isProtocol: this.data.kind === 'protocols' });
      this.reload();
      this._subs = [
        bus.on('favs', () => this.refresh()),
        bus.on('custom', () => this.reload()),
      ];
    },
    detached() { (this._subs || []).forEach((off) => off()); },
  },
  pageLifetimes: {
    show() { this.refresh(); },
  },
  methods: {
    onLangChange() { this.reload(); },

    reload() {
      this._items = recipes.libraryItems(this.data.kind);
      const lang = this.data.lang;
      const discs = recipes.DISCIPLINES[this.data.kind] || [];
      const counts = {};
      discs.forEach((d) => { counts[d] = this._items.filter((r) => recipes.matchesDiscipline(r, d)).length; });
      const discOptions = [{ id: 'all', label: lang === 'zh' ? '全部学科' : 'All disciplines' }]
        .concat(discs.map((d) => ({ id: d, label: t(recipes.DISC_KEYS[d], lang) + (counts[d] ? ' (' + counts[d] + ')' : '') })));
      const discIndex = Math.max(0, discOptions.findIndex((o) => o.id === this.data.disc));
      this.setData({ discOptions, discIndex, total: this._items.length });
      this.refresh();
    },

    refresh() {
      if (!this._items) return;
      const lang = this.data.lang;
      const { scope, disc } = this.data;
      const q = this.data.search.trim().toLowerCase();
      const favList = favorites.favs();
      const favSet = new Set(favList);
      const filtered = this._items.filter((r) => {
        if (scope === 'favs' && !favSet.has(r.id)) return false;
        if (scope === 'custom' && !r._isCustom) return false;
        if (disc !== 'all' && !recipes.matchesDiscipline(r, disc)) return false;
        return recipes.matchesQuery(r, q);
      });
      const filtersActive = scope !== 'all' || disc !== 'all' || !!q;
      const byId = {};
      this._items.forEach((r) => { byId[r.id] = r; });
      const recentRows = filtersActive ? [] : favorites.recent()
        .map((id) => byId[id]).filter(Boolean).slice(0, 5)
        .map((r) => ({ id: r.id, name: r.name }));
      const total = this._items.length;
      this.setData({
        rows: filtered.map((r) => recipes.toRow(r, lang, favSet)),
        recentRows,
        filtersActive,
        footer: filtersActive
          ? tf('resultsCount', lang, { n: filtered.length }) + ' / ' + total
          : tf('itemsCount', lang, { n: total }),
      });
    },

    onSearch(e) {
      this.setData({ search: e.detail.value });
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.refresh(), 120);
    },
    clearSearch() { this.setData({ search: '' }); this.refresh(); },
    setScope(e) { this.setData({ scope: e.currentTarget.dataset.scope }); this.refresh(); },
    onDisc(e) {
      const discIndex = Number(e.detail.value);
      const opt = this.data.discOptions[discIndex];
      this.setData({ discIndex, disc: opt ? opt.id : 'all' });
      this.refresh();
    },
    clearFilters() { this.setData({ search: '', scope: 'all', disc: 'all', discIndex: 0 }); this.refresh(); },

    open(e) {
      const id = e.currentTarget.dataset.id;
      favorites.addRecent(id);
      wx.navigateTo({ url: '/pages/detail/index?id=' + encodeURIComponent(id) });
    },
    toggleFav(e) {
      const id = e.currentTarget.dataset.id;
      const on = favorites.toggle(id);
      ui.toast(t(on ? 'addedFav' : 'removedFav', this.data.lang));
    },
    openNew() {
      wx.navigateTo({ url: '/pages/custom-form/index?type=' + (this.data.isProtocol ? 'protocol' : 'recipe') });
    },
    openSearch() { wx.navigateTo({ url: '/pages/search/index' }); },
  },
});
