// Guide — the web's RefsTab.jsx: backup & restore, the feature guide, the privacy
// note and the literature references, adapted to WeChat (files go to and come
// from a chat; data lives in this mini program's local storage).
const pageBehavior = require('../../../behaviors/page');
const ui = require('../../../lib/ui');
const bus = require('../../../lib/bus');
const storage = require('../../../lib/storage');
const backup = require('../../../lib/backup');
const langLib = require('../../../lib/lang');
const { REFERENCES, REF_NOTES_EN } = require('../../../shared/data.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WEB_APP_URL = 'https://apps.bioinfospace.com/labmate/';

// The web's GUIDE_SECTIONS without the keyboard-shortcut and AI-assistant
// sections (neither exists here). gd* bodies are the web text rewritten for
// WeChat; guide* keys are the web's own, used where they are already true.
const SECTIONS = [
  { titleKey: 'guideBuffersTitle', bodyKey: 'gdBuffersBody' },
  { titleKey: 'guideProtocolsTitle', bodyKey: 'guideProtocolsBody' },
  { titleKey: 'guideCalcTitle', bodyKey: 'gdCalcBody' },
  { titleKey: 'guideGelTitle', bodyKey: 'gdGelBody' },
  { titleKey: 'guidePlateTitle', bodyKey: 'gdPlateBody' },
  { titleKey: 'guideInventoryTitle', bodyKey: 'gdInventoryBody' },
  { titleKey: 'guideNotebookTitle', bodyKey: 'guideNotebookBody' },
  { titleKey: 'guideCalendarTitle', bodyKey: 'gdCalendarBody' },
  { titleKey: 'guideToolsTitle', bodyKey: 'gdToolsBody' },
  { titleKey: 'gdSearchTitle', bodyKey: 'gdSearchBody' },
  { titleKey: 'guideCustomTitle', bodyKey: 'guideCustomBody' },
  { titleKey: 'guideDataSafetyTitle', bodyKey: 'gdDataSafetyBody' },
];

const pad2 = (n) => (n < 10 ? '0' : '') + n;

// string | {en, zh} → string (the web's safeText)
function safeText(val, lang) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return (lang === 'en' ? val.en : val.zh) || val.en || val.zh || '';
}

const REF_ROWS = REFERENCES.map((ref) => ({
  id: ref.id,
  num: pad2(ref.id),
  text: ref.text,
  journal: ref.journal,
  volPages: (ref.vol ? ' ' + ref.vol : '') + (ref.pages ? ':' + ref.pages : ''),
  noteEn: REF_NOTES_EN[ref.id] || safeText(ref.note, 'en'),
  noteZh: safeText(ref.note, 'zh'),
  doi: ref.doi || '',
  url: ref.doi ? 'https://doi.org/' + ref.doi : '',
}));

// KB (as wx.getStorageInfoSync reports it) → "12 KB" / "1.5 MB"
function fmtKB(kb) {
  const n = Math.max(0, Number(kb) || 0);
  if (n < 1024) return Math.round(n) + ' KB';
  const mb = n / 1024;
  return (mb >= 10 || mb === Math.round(mb) ? Math.round(mb) : mb.toFixed(1)) + ' MB';
}

function errText(err) {
  return String((err && (err.errMsg || err.message)) || err || '');
}

Component({
  behaviors: [pageBehavior],
  data: {
    titleKey: 'tabRefs',
    sections: SECTIONS.map((s, idx) => ({ id: s.titleKey, num: pad2(idx + 1), titleKey: s.titleKey, bodyKey: s.bodyKey, open: false })),
    sectionCount: SECTIONS.length,
    allOpen: false,
    refs: REF_ROWS,
    refCount: REF_ROWS.length,
    refsOpen: false,
    lastLabel: '',
    backupStale: true,
    storageLabel: '',
    storageHigh: false,
    webUrlLabel: WEB_APP_URL.replace(/^https:\/\//, '').replace(/\/$/, ''),
  },
  lifetimes: {
    attached() {
      this.refreshStatus();
      this._offBackup = bus.on('backup', () => this.refreshStatus());
    },
    detached() {
      if (this._offBackup) this._offBackup();
    },
  },
  methods: {
    onPageShow() { this.refreshStatus(); },
    onLangChange() { this.refreshStatus(); },

    // Last backup ("today" / "3 d ago" / "never", like the web's
    // describeLastBackup) and how full local storage is.
    refreshStatus() {
      const last = backup.lastExport();
      let lastLabel;
      if (!last) lastLabel = this.t('backupNever');
      else {
        const days = Math.floor((Date.now() - last) / DAY_MS);
        lastLabel = days <= 0 ? this.t('backupToday') : this.tf('backupDaysAgo', { n: days });
      }
      const info = storage.info();
      const used = Number(info.currentSize) || 0;
      const limit = Number(info.limitSize) || 10240;
      this.setData({
        lastLabel,
        backupStale: !last || Date.now() - last > WEEK_MS,
        storageLabel: this.tf('gdStorageUsed', { used: fmtKB(used), limit: fmtKB(limit) }),
        storageHigh: used / limit > 0.8,
      });
    },

    // ── Backup / restore ──────────────────────────────────────────────────
    async exportData() {
      if (this._exporting) return;
      this._exporting = true;
      try {
        const json = JSON.stringify(backup.buildBackup(), null, 2);
        await ui.shareTextFile(backup.backupFileName(), json);
        backup.markExported();
        ui.toast(this.t('gdBackupSent'));
      } catch (err) {
        const msg = errText(err);
        if (/cancel/i.test(msg)) return; // closed the chat picker
        ui.toast(this.t(msg === 'share_unsupported' ? 'gdShareUnsupported' : 'backupFailed'));
      } finally {
        this._exporting = false;
        this.refreshStatus();
      }
    },

    async importData() {
      let file;
      try {
        file = await ui.pickTextFile(['json']);
      } catch (err) {
        if (!/cancel/i.test(errText(err))) ui.toast(this.t('importError'));
        return;
      }
      const ok = await ui.confirm(this.tf('gdImportConfirm', { name: file.name || 'backup.json' }), { title: this.t('importTitle') });
      if (!ok) return;
      let count;
      try {
        count = backup.importBackup(file.content);
      } catch (err) {
        ui.toast(this.t('importError'));
        return;
      }
      // The web reloads after an import, picking up the backup's language;
      // do the same by applying it live.
      const lang = storage.get('biolab_lang', '');
      if ((lang === 'en' || lang === 'zh') && lang !== langLib.getLang()) langLib.setLang(lang);
      ui.toast(this.tf('importSuccess', { n: count }));
      this.refreshStatus();
    },

    copyWebUrl() { ui.copy(WEB_APP_URL, this.t('lkCopied')); },

    // ── Feature guide ─────────────────────────────────────────────────────
    toggleSection(e) {
      const idx = Number(e.currentTarget.dataset.index);
      const sec = this.data.sections[idx];
      if (!sec) return;
      const open = !sec.open;
      const allOpen = this.data.sections.every((s, k) => (k === idx ? open : s.open));
      this.setData({ ['sections[' + idx + '].open']: open, allOpen });
    },
    toggleAll() {
      const open = !this.data.allOpen;
      this.setData({ sections: this.data.sections.map((s) => Object.assign({}, s, { open })), allOpen: open });
    },

    // ── References ────────────────────────────────────────────────────────
    toggleRefs() { this.setData({ refsOpen: !this.data.refsOpen }); },
    copyRef(e) {
      const url = e.currentTarget.dataset.url;
      if (url) ui.copy(url, this.t('lkCopied'));
    },
  },
});
