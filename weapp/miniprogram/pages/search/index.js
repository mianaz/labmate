// Global search across recipes, protocols and custom entries (the web's ⌘K
// GlobalSearchModal): name, Chinese name, tags, reagents/materials, notes.
const pageBehavior = require('../../behaviors/page');
const recipes = require('../../lib/recipes');
const favorites = require('../../lib/favorites');

const SUGGESTIONS = ['PBS', 'Tris', 'ChIP', 'WB', 'CRISPR', 'RNA', '转膜', '蛋白纯化'];

Component({
  behaviors: [pageBehavior],
  data: {
    query: '',
    results: [],
    suggestions: SUGGESTIONS,
    total: recipes.LIBRARY.length,
    focus: true,
  },
  methods: {
    pageTitle() { return this.data.lang === 'zh' ? '搜索' : 'Search'; },
    onLoad(query) {
      if (query && query.q) this.run(decodeURIComponent(query.q));
    },
    onLangChange() { this.run(this.data.query); },
    onInput(e) {
      const value = e.detail.value;
      this.setData({ query: value });
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.run(value), 120);
    },
    run(value) {
      const lang = this.data.lang;
      const q = String(value || '').trim().toLowerCase();
      const hits = recipes.search(q, 30);
      this.setData({
        query: value || '',
        results: hits.map(({ recipe: r, compMatch }) => {
          const parts = (r.category === 'protocol' ? (r.materials || []) : (r.components || []))
            .map((c) => String((c && c.name) || (typeof c === 'string' ? c : '')));
          return {
            id: r.id,
            name: r.name,
            nameCn: lang === 'zh' && r.nameCn && r.nameCn !== r.name ? r.nameCn : '',
            custom: !!r._isCustom,
            cat: recipes.categoryLabel(r, lang),
            catColor: recipes.CAT_COLOR_VARS[r.category] || recipes.CAT_COLOR_VARS.buffer,
            contains: compMatch ? parts.filter((n) => n.toLowerCase().includes(q)).slice(0, 4).join(', ') : '',
          };
        }),
      });
    },
    clear() { this.setData({ query: '', results: [], focus: true }); },
    suggest(e) { this.run(e.currentTarget.dataset.q); },
    open(e) {
      const id = e.currentTarget.dataset.id;
      favorites.addRecent(id);
      wx.navigateTo({ url: '/pages/detail/index?id=' + encodeURIComponent(id) });
    },
  },
});
