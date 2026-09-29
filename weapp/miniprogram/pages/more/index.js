// More tab — everything that doesn't fit in the bottom bar (the web's MoreSheet):
// My lab / Tools / Help sections, language, backup & restore, about.
const pageBehavior = require('../../behaviors/page');
const bus = require('../../lib/bus');
const { setLang } = require('../../lib/lang');
const timers = require('../../lib/timers');
const backup = require('../../lib/backup');
const storage = require('../../lib/storage');
const ui = require('../../lib/ui');
const { t, tf } = require('../../shared/i18n.js');

const GROUPS = [
  { id: 'lab', label: 'navMyLab', items: [
    { id: 'inventory', label: 'tabInventory', icon: 'i-box', url: '/packages/lab/inventory/index' },
    { id: 'notebook', label: 'tabNotebook', icon: 'i-notebook', url: '/packages/lab/notebook/index' },
    { id: 'calendar', label: 'tabCalendar', icon: 'i-calendar', url: '/packages/lab/calendar/index' },
  ] },
  { id: 'tools', label: 'navTools', items: [
    { id: 'tools', label: 'tabTools', icon: 'i-link', url: '/packages/tools/links/index' },
  ] },
  { id: 'help', label: 'navHelp', items: [
    { id: 'guide', label: 'tabRefs', icon: 'i-book', url: '/packages/tools/guide/index' },
  ] },
];

Component({
  behaviors: [pageBehavior],
  data: {
    tabIndex: 4,
    titleKey: 'navMore',
    groups: GROUPS,
    runningTimers: 0,
    lastBackup: '',
    backupDue: false,
    storageText: '',
  },
  lifetimes: {
    attached() {
      this._subs = [
        bus.on('timers', (list) => {
          const n = list.filter((x) => x.running).length;
          if (n !== this.data.runningTimers) this.setData({ runningTimers: n });
        }),
        bus.on('backup', () => this.refresh()),
      ];
    },
    detached() { (this._subs || []).forEach((off) => off()); },
  },
  methods: {
    onPageShow() { this.refresh(); },
    onLangChange() { this.refresh(); },
    refresh() {
      const ts = backup.lastExport();
      const info = storage.info();
      this.setData({
        runningTimers: timers.runningCount(),
        lastBackup: backup.describeLastBackup(ts, this.data.lang),
        backupDue: backup.isDue(ts),
        storageText: info.currentSize ? (info.currentSize >= 1024 ? (info.currentSize / 1024).toFixed(1) + ' MB' : info.currentSize + ' KB') + ' / ' + Math.round((info.limitSize || 10240) / 1024) + ' MB' : '',
      });
    },
    go(e) {
      // Lab/tools pages live in subpackages, downloaded on first use: offline
      // before that download, navigation fails.
      wx.navigateTo({
        url: e.currentTarget.dataset.url,
        fail: () => ui.toast(t('mpNeedsNetwork', this.data.lang)),
      });
    },
    openSearch() { wx.navigateTo({ url: '/pages/search/index' }); },
    openTimer() { wx.navigateTo({ url: '/pages/timer/index' }); },
    setLangTo(e) {
      const lang = e.currentTarget.dataset.lang;
      if (lang === this.data.lang) return;
      setLang(lang);
      if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ lang });
    },
    async exportBackup() {
      const lang = this.data.lang;
      try {
        await ui.shareTextFile(backup.backupFileName(), JSON.stringify(backup.buildBackup(), null, 2));
        backup.markExported();
        ui.toast(t('backupDone', lang));
      } catch (err) {
        // Cancelling the chat picker is not a failure.
        if (!/cancel/i.test(String((err && err.errMsg) || err))) ui.toast(t('backupFailed', lang));
      }
    },
    async importBackup() {
      const lang = this.data.lang;
      let file;
      try { file = await ui.pickTextFile(['json']); } catch (err) { return; }
      let parsed;
      try {
        parsed = JSON.parse(file.content);
        if (!parsed || !parsed.exportedAt || !parsed.data) throw new Error('format');
      } catch (err) {
        ui.toast(t('mpRestoreFailed', lang));
        return;
      }
      const ok = await ui.confirm(t('mpRestoreConfirm', lang), { title: file.name });
      if (!ok) return;
      try {
        const n = backup.importBackup(parsed);
        ui.toast(tf('importSuccess', lang, { n }));
      } catch (err) {
        ui.toast(t(err && err.message === 'storage_full' ? 'mpStorageFull' : 'mpRestoreFailed', lang));
      }
      this.refresh();
    },
    copyWebLink() {
      ui.copy('https://apps.bioinfospace.com/labmate/');
    },
  },
});
