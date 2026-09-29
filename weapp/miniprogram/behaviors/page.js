// Base behavior for every page (pages are built with Component(), so their
// lifecycle handlers live in `methods`).
//
// Conventions:
//   • Do NOT define onShow in a page — define onPageShow() instead; this behavior's
//     onShow syncs the language, the nav bar title and the tab bar first.
//   • Title: data.titleKey (an i18n key) or a pageTitle() method.
//   • Tab pages: data.tabIndex (0–4) selects the custom tab bar item.
//   • data.timerCount mirrors the number of timers, for bottom padding under
//     the floating <timer-bar>.
const bus = require('../lib/bus');
const timers = require('../lib/timers');
const { getLang } = require('../lib/lang');
const { t } = require('../shared/i18n.js');
const langBehavior = require('./lang');

function isCurrentPage(inst) {
  const pages = getCurrentPages();
  return pages.length > 0 && pages[pages.length - 1] === inst;
}

module.exports = Behavior({
  behaviors: [langBehavior],
  data: { timerCount: 0 },
  lifetimes: {
    attached() {
      this.setData({ timerCount: timers.list().length });
      this._offPage = [
        bus.on('lang', () => { if (isCurrentPage(this)) this.applyTitle(); }),
        bus.on('timers', (list) => {
          if (list.length !== this.data.timerCount) this.setData({ timerCount: list.length });
        }),
      ];
    },
    detached() {
      (this._offPage || []).forEach((off) => off());
    },
  },
  methods: {
    onShow() {
      const lang = getLang();
      if (lang !== this.data.lang) {
        this.setData({ lang });
        if (typeof this.onLangChange === 'function') this.onLangChange(lang);
      }
      this.applyTitle();
      if (this.data.tabIndex !== undefined && typeof this.getTabBar === 'function') {
        const bar = this.getTabBar();
        if (bar) bar.setData({ selected: this.data.tabIndex, lang });
      }
      if (typeof this.onPageShow === 'function') this.onPageShow();
    },
    applyTitle() {
      const title = typeof this.pageTitle === 'function'
        ? this.pageTitle()
        : (this.data.titleKey ? t(this.data.titleKey, this.data.lang) : '');
      if (title) wx.setNavigationBarTitle({ title });
    },
  },
});
