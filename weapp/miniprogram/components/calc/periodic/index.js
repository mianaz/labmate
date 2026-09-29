// Interactive periodic table (web: PeriodicTableCalc.jsx). On a phone the
// 18-column table scrolls sideways (34 px tiles, as on the web below 504 px);
// tapping an element shows its details under the table. Search dims the
// elements that don't match (filtering runs in WXS, so typing only sends the
// query string to the view).
const langBehavior = require('../../../behaviors/lang');
const { ELEMENTS, ELEMENT_CAT_COLORS, PT_LAYOUT } = require('../../../shared/data.js');

const CAT_LABELS = {
  'alkali': ['Alkali Metal', '碱金属'], 'alkaline-earth': ['Alkaline Earth', '碱土金属'], 'transition': ['Transition Metal', '过渡金属'],
  'post-transition': ['Post-Transition', '后过渡金属'], 'metalloid': ['Metalloid', '类金属'], 'nonmetal': ['Nonmetal', '非金属'],
  'halogen': ['Halogen', '卤素'], 'noble-gas': ['Noble Gas', '稀有气体'], 'lanthanide': ['Lanthanide', '镧系'], 'actinide': ['Actinide', '锕系'],
};
const catLabel = (cat, lang) => (CAT_LABELS[cat] ? CAT_LABELS[cat][lang === 'zh' ? 1 : 0] : cat);

// Grid geometry (px): 7 periods, an 8 px gap, then the lanthanide/actinide rows.
const TILE_W = 34;
const TILE_H = 37;
const GAP = 2;
const SPACER = 8;
const top = (row) => (row < 7 ? row * (TILE_H + GAP) : 7 * (TILE_H + GAP) + SPACER + (row - 8) * (TILE_H + GAP));
const GRID_W = 18 * (TILE_W + GAP) - GAP;
const GRID_H = top(9) + TILE_H;

const TILES = ELEMENTS.filter((el) => PT_LAYOUT[el.z]).map((el) => {
  const pos = PT_LAYOUT[el.z];
  return {
    z: el.z,
    sym: el.sym,
    name: el.name,
    m: el.mass.toFixed(1),
    cat: el.cat,
    pos: 'left:' + pos[1] * (TILE_W + GAP) + 'px;top:' + top(pos[0]) + 'px',
  };
});
const BY_Z = {};
ELEMENTS.forEach((el) => { BY_Z[el.z] = el; });

function legend(lang) {
  return Object.keys(ELEMENT_CAT_COLORS).map((cat) => ({ cat, label: catLabel(cat, lang), color: ELEMENT_CAT_COLORS[cat] }));
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    tiles: TILES,
    gridStyle: 'width:' + GRID_W + 'px;height:' + GRID_H + 'px',
    legend: [],
    search: '',
    q: '',
    sel: 0,
    el: null, // selected element, for the details
  },
  lifetimes: {
    attached() { this.setData({ legend: legend(this.data.lang) }); },
  },
  methods: {
    onLangChange(lang) {
      this.setData({ legend: legend(lang) });
      if (this.data.sel) this.showElement(this.data.sel);
    },

    onSearch(e) {
      const search = e.detail.value;
      this.setData({ search, q: String(search || '').trim().toLowerCase() });
    },
    clearSearch() { this.setData({ search: '', q: '' }); },

    select(e) { this.showElement(Number(e.currentTarget.dataset.z)); },

    showElement(z) {
      const el = BY_Z[z];
      if (!el) return;
      this.setData({
        sel: z,
        el: {
          z: el.z, sym: el.sym, name: el.name, cat: el.cat,
          mass3: el.mass.toFixed(3), mass4: el.mass.toFixed(4),
          catLabel: catLabel(el.cat, this.data.lang), econf: el.econf,
        },
      });
    },
  },
});
