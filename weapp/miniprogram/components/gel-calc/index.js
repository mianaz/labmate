// SDS-PAGE gel calculator (web: src/features/calc/GelTab.jsx), self-contained so
// it can sit anywhere: `<gel-calc />` in the sds_page_gel recipe detail
// (document style, the default) or `<gel-calc variant="panel" />` on the Calc tab.
// The web's "Download Recipe" becomes Copy (clipboard) and Send to chat (.txt).
const langBehavior = require('../../behaviors/lang');
const ui = require('../../lib/ui');
const { calcGel } = require('../../shared/calculators.js');

const RES_PERCS = [6, 7.5, 8, 10, 12, 15];
const STACK_PERCS = [4, 5];
const MW_GUIDE = [
  { perc: 6, range: '60–200 kDa' },
  { perc: 7.5, range: '40–150 kDa' },
  { perc: 8, range: '35–120 kDa' },
  { perc: 10, range: '20–80 kDa' },
  { perc: 12, range: '15–60 kDa' },
  { perc: 15, range: '10–40 kDa' },
];
const REF = 'Ref: Laemmli (1970) Nature 227:680; Bio-Rad Mini-PROTEAN Manual';

const fmtVol = (v) => String(parseFloat(v.toFixed(3)));
const fmtRow = (row) => (row.unit === 'µL' ? row.vol.toFixed(1) : row.vol.toFixed(3));
const totalMl = (rows) => rows.reduce((s, r) => s + (r.unit === 'µL' ? r.vol / 1000 : r.vol), 0);
const cleanNumber = (v) => String(v === undefined || v === null ? '' : v).replace(/[,，。]/g, '.').replace(/\s+/g, '');

// Plain-text recipe, same layout as the web's download.
function gelToText(title, data) {
  let txt = title + '\n' + '─'.repeat(50) + '\n';
  txt += '试剂'.padEnd(35) + '用量'.padStart(10) + '  单位\n';
  txt += '─'.repeat(50) + '\n';
  data.forEach((row) => {
    txt += row.name.padEnd(35) + fmtRow(row).padStart(10) + '  ' + row.unit + '\n';
  });
  txt += '─'.repeat(50) + '\n';
  txt += 'Total'.padEnd(35) + totalMl(data).toFixed(2).padStart(10) + '  mL\n';
  return txt;
}

// "Vol/gel (mL)" → label + unit, so the uppercase label never reads "(ML)".
function withUnit(text) {
  const m = /^(.*?)\s*([(（][^)）]+[)）])\s*$/.exec(String(text || ''));
  return m ? { label: m[1], unit: m[2] } : { label: String(text || ''), unit: '' };
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    // 'doc': section inside a recipe document (default) · 'panel': framed card
    variant: { type: String, value: 'doc' },
  },
  data: {
    resOptions: RES_PERCS.map((p) => p + '%'),
    stackOptions: STACK_PERCS.map((p) => p + '%'),
    resIdx: 3, // 10 %
    stackIdx: 0, // 4 %
    resVol: '',
    stackVol: '',
    numGels: '',
    resPerc: 10,
    stackPerc: 4,
    tables: [], // resolving, stacking: [{ id, titleKey, meta, rows: [{ k, name, val, unit }], total }]
    guide: [],
    volLabel: { label: '', unit: '' },
    rangeLabel: { label: '', unit: '' },
  },
  lifetimes: {
    attached() { this.recalc(); },
  },
  methods: {
    onLangChange() { this.recalc(); },

    onResPerc(e) { this.setData({ resIdx: Number(e.detail.value) }); this.recalc(); },
    onStackPerc(e) { this.setData({ stackIdx: Number(e.detail.value) }); this.recalc(); },
    onInput(e) {
      this.setData({ [e.currentTarget.dataset.field]: cleanNumber(e.detail.value) });
      this.recalc();
    },

    // Same fallbacks as the web: 10 mL resolving, 5 mL stacking, 2 gels.
    params() {
      const d = this.data;
      const rv = +d.resVol || 10;
      const sv = +d.stackVol || 5;
      const ng = +d.numGels || 2;
      const resPerc = RES_PERCS[d.resIdx];
      const stackPerc = STACK_PERCS[d.stackIdx];
      return {
        rv, sv, ng, resPerc, stackPerc,
        resGel: calcGel(resPerc, rv * ng, 'resolving'),
        stackGel: calcGel(stackPerc, sv * ng, 'stacking'),
      };
    },

    recalc() {
      const p = this.params();
      const table = (id, titleKey, rows, perc, vol) => ({
        id,
        titleKey,
        rows: rows.map((r, i) => ({ k: String(i), name: r.name, val: fmtRow(r), unit: r.unit })),
        total: totalMl(rows).toFixed(2),
        meta: perc + '% · ' + fmtVol(vol) + ' mL × ' + p.ng + ' = ' + fmtVol(vol * p.ng) + ' mL',
      });
      this.setData({
        resPerc: p.resPerc,
        stackPerc: p.stackPerc,
        tables: [
          table('res', 'gelResolving', p.resGel, p.resPerc, p.rv),
          table('stack', 'gelStacking', p.stackGel, p.stackPerc, p.sv),
        ],
        guide: MW_GUIDE.map((g) => ({ perc: g.perc + '%', range: g.range, current: g.perc === p.resPerc })),
        volLabel: withUnit(this.t('gelResolvingVol')),
        rangeLabel: withUnit(this.t('bestRange')),
      });
    },

    recipeText() {
      const p = this.params();
      let txt = 'SDS-PAGE Gel Recipe\n' + '═'.repeat(50) + '\n';
      txt += 'Gels: ' + p.ng + '\n\n';
      txt += gelToText('Resolving Gel (' + p.resPerc + '%, ' + fmtVol(p.rv * p.ng) + ' mL)', p.resGel);
      txt += '\n';
      txt += gelToText('Stacking Gel (' + p.stackPerc + '%, ' + fmtVol(p.sv * p.ng) + ' mL)', p.stackGel);
      txt += '\n' + REF + '\n';
      return txt;
    },
    fileName() {
      const p = this.params();
      return 'SDS-PAGE_' + p.resPerc + 'pct_x' + p.ng + '.txt';
    },

    copyRecipe() {
      return ui.copy(this.recipeText());
    },
    // Send the .txt to a chat; where file sharing isn't available (PC WeChat,
    // old base library) fall back to the clipboard.
    sendRecipe() {
      const text = this.recipeText();
      return ui.shareTextFile(this.fileName(), text).then(() => true).catch((err) => {
        const msg = String((err && (err.errMsg || err.message)) || '');
        if (/cancel/i.test(msg)) return false;
        return ui.copy(text, this.t('calcGelSendFailed')).then(() => false);
      });
    },
  },
});
