// Backup / restore in the web app's file format (src/lib/backup.js), so one file
// moves between the browser and WeChat in both directions:
//   { exportedAt, appVersion, schemaVersion: 2, data: { <storage key>: value }, experiments: [] }
const storage = require('./storage');
const experiments = require('./experiments');
const bus = require('./bus');
const { isoDate } = require('./format');
const { getLang, setLang } = require('./lang');

const APP_VERSION = 'weapp-0.1.0';
const LAST_EXPORT_KEY = 'labmate_lastExport';
const LS_PREFIXES = ['labmate_', 'biolab_', 'stepProgress_', 'stepTracker_'];
const LS_EXACT_KEYS = ['favs', 'lang', 'theme'];
const MERGE_ARRAY_KEYS = ['labmate_customRecipes', 'labmate_customProtocols'];
const SECRET_KEY_RE = /(^|[_-])(api[_-]?key|secret|token|credential|bearer|password|passwd|key)([_-]|$)/i;
// Device-local state, and experiments (which travel in their own field).
const EXCLUDED_KEYS = ['labmate_timers', experiments.KEY];

function isBackupKey(key) {
  if (SECRET_KEY_RE.test(key) || EXCLUDED_KEYS.includes(key)) return false;
  return LS_PREFIXES.some((p) => key.startsWith(p)) || LS_EXACT_KEYS.includes(key);
}

function collectBackupData() {
  const data = {};
  storage.keys().forEach((key) => {
    if (isBackupKey(key)) data[key] = storage.get(key, null);
  });
  return data;
}

function buildBackup() {
  return {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    schemaVersion: 2,
    data: collectBackupData(),
    experiments: experiments.all(),
  };
}

function backupFileName() {
  return 'labmate-backup-' + isoDate() + '.json';
}

function markExported() {
  storage.set(LAST_EXPORT_KEY, Date.now());
  bus.emit('backup');
}

function lastExport() {
  const v = Number(storage.get(LAST_EXPORT_KEY, 0));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// Values in web backups are already parsed, except where the web stored a raw
// string that was not JSON — keep those as strings.
function importBackup(fileContent) {
  const parsed = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
  if (!parsed || !parsed.exportedAt || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Invalid backup format');
  }
  let count = 0;
  const failed = [];
  if (Array.isArray(parsed.experiments) && parsed.experiments.length > 0) {
    const valid = parsed.experiments.filter((e) => e && e.id).length;
    const written = experiments.bulkPut(parsed.experiments);
    count += written;
    if (written < valid) failed.push('experiments');
  }
  Object.keys(parsed.data).forEach((key) => {
    const value = parsed.data[key];
    if (SECRET_KEY_RE.test(key) || EXCLUDED_KEYS.includes(key)) return;
    let ok;
    if (MERGE_ARRAY_KEYS.includes(key)) {
      const existing = storage.get(key, []);
      const merged = Array.isArray(existing) ? existing.slice() : [];
      const incoming = Array.isArray(value) ? value : [];
      incoming.forEach((item) => {
        const idx = merged.findIndex((m) => m && item && m.id === item.id);
        if (idx >= 0) merged[idx] = item; else merged.push(item);
      });
      ok = storage.set(key, merged);
    } else {
      ok = storage.set(key, value);
    }
    if (ok) count++; else failed.push(key);
  });
  ['custom', 'favs', 'experiments', 'inventory', 'backup'].forEach((e) => bus.emit(e));
  // The language is cached in lib/lang: apply a restored one right away.
  const lang = parsed.data.biolab_lang;
  if ((lang === 'en' || lang === 'zh') && lang !== getLang()) setLang(lang);
  // wx storage holds 10 MB (1 MB per key); the browser holds more. Say so
  // instead of reporting a restore that silently wrote nothing.
  if (failed.length) {
    const err = new Error('storage_full');
    err.failed = failed;
    err.count = count;
    throw err;
  }
  return count;
}

module.exports = { buildBackup, backupFileName, markExported, lastExport, importBackup, isBackupKey, collectBackupData };

// "today" / "3 d ago" / "never" (web: describeLastBackup in useBackupStatus.js).
const { t } = require('../shared/i18n.js');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function describeLastBackup(ts, lang) {
  if (!ts) return t('backupNever', lang);
  const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (days <= 0) return t('backupToday', lang);
  return t('backupDaysAgo', lang).replace('{n}', days);
}
function isDue(ts) {
  return !ts || Date.now() - ts > WEEK_MS;
}

module.exports.describeLastBackup = describeLastBackup;
module.exports.isDue = isDue;
