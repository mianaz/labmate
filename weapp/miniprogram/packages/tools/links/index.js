// Links — the web's ToolsTab.jsx: a directory of external tools with a category
// filter and monogram tiles. A mini program cannot open arbitrary websites
// (web-view only loads the owner's ICP-filed, whitelisted domains), so a tap
// copies the URL and a toast says to paste it into a browser.
const pageBehavior = require('../../../behaviors/page');
const ui = require('../../../lib/ui');
const { EXTERNAL_TOOLS: GROUPS } = require('./tools-data');

// Two-letter monogram: initials of the first two words ("ELISA Calculator" → EC),
// else the camel-case humps ("freeCount" → FC), else the first two letters.
function monogram(tool) {
  if (tool.abbr) return tool.abbr;
  const words = tool.name.split(/[\s\-.()]+/).filter((w) => w && !/^\d+$/.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0] || tool.name;
  const hump = w.slice(1).search(/[A-Z]/);
  return (hump >= 0 ? w[0] + w[hump + 1] : w.slice(0, 2)).toUpperCase();
}

// No URL() in every WeChat JS engine — a regex does the same job here.
function hostname(url) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url);
  return m ? m[1].replace(/^www\./, '') : url;
}

const pad2 = (n) => (n < 10 ? '0' : '') + n;

const TOTAL = GROUPS.reduce((n, g) => n + g.tools.length, 0);

// Static view model: both languages are carried, the template picks one.
const VIEW_GROUPS = GROUPS.map((g) => ({
  cat: g.cat,
  count: pad2(g.tools.length),
  tools: g.tools.map((tool) => ({
    key: tool.url,
    name: tool.name,
    url: tool.url,
    mono: monogram(tool),
    host: hostname(tool.url),
    descEn: tool.desc.en,
    descZh: tool.desc.zh || tool.desc.en,
  })),
}));

const CATS = [{ id: 'all', count: TOTAL }].concat(GROUPS.map((g) => ({ id: g.cat, count: g.tools.length })));

Component({
  behaviors: [pageBehavior],
  data: {
    titleKey: 'tabTools',
    total: TOTAL,
    cats: CATS,
    groups: VIEW_GROUPS,
    filter: 'all',
  },
  methods: {
    setFilter(e) {
      const cat = e.currentTarget.dataset.cat;
      if (!cat || cat === this.data.filter) return;
      this.setData({ filter: cat });
    },
    copyLink(e) {
      const url = e.currentTarget.dataset.url;
      if (url) ui.copy(url, this.t('lkCopied'));
    },
  },
});
