// Table view of the labelled wells (the web's PlateTableView.jsx): sortable
// by well, row, column, label or colour.
const langBehavior = require('../../../behaviors/lang');
const { parseKey } = require('../util');

const HEADS = [
  { id: 'well', en: 'Well', zh: '孔位' },
  { id: 'row', en: 'Row', zh: '行' },
  { id: 'col', en: 'Col', zh: '列' },
  { id: 'label', en: 'Label', zh: '标签' },
  { id: 'color', en: 'Color', zh: '颜色' },
];

function cmpStr(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    layout: { type: Object, value: {} },
  },
  data: { sort: 'well', asc: true, heads: [], rows: [] },
  observers: {
    layout() { this.refresh(); },
  },
  lifetimes: {
    attached() { this.refresh(); },
  },
  methods: {
    onLangChange() { this.refresh(); },

    refresh() {
      const layout = this.data.layout || {};
      const { sort, asc, lang } = this.data;
      const rows = Object.keys(layout).map((well) => {
        const pos = parseKey(well) || { r: 0, c: 0 };
        const d = layout[well] || {};
        return { well, row: well.charAt(0), r: pos.r, col: pos.c + 1, label: String(d.label == null ? '' : d.label), color: String(d.color || '') };
      });
      rows.sort((a, b) => {
        let cmp = 0;
        if (sort === 'well' || sort === 'row') cmp = a.r - b.r || a.col - b.col;
        else if (sort === 'col') cmp = a.col - b.col || a.r - b.r;
        else if (sort === 'label') cmp = cmpStr(a.label, b.label) || a.r - b.r || a.col - b.col;
        else if (sort === 'color') cmp = cmpStr(a.color, b.color) || a.r - b.r || a.col - b.col;
        return asc ? cmp : -cmp;
      });
      this.setData({
        rows,
        heads: HEADS.map((h) => ({ id: h.id, l: lang === 'zh' ? h.zh : h.en })),
      });
    },

    toggleSort(e) {
      const id = e.currentTarget.dataset.id;
      if (this.data.sort === id) this.setData({ asc: !this.data.asc });
      else this.setData({ sort: id, asc: true });
      this.refresh();
    },
  },
});
