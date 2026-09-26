import { useState, useEffect, useCallback } from 'react';
import db from '../lib/db.js';
import { exportBackup } from '../lib/backup.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_KEY = 'labmate_lastExport';
const SNOOZE_KEY = 'labmate_backupSnoozedAt';

function readTs(key) {
  const n = parseInt(localStorage.getItem(key), 10);
  return Number.isFinite(n) ? n : 0;
}

// Backup reminder state: due when the last export is older than a week (or
// never happened) and the reminder hasn't been snoozed in the past week.
// "Later" snoozes instead of pretending an export happened, so the
// "last backup" status stays truthful.
export function useBackupStatus() {
  const [lastExport, setLastExport] = useState(() => readTs(LAST_KEY));
  const [snoozedAt, setSnoozedAt] = useState(() => readTs(SNOOZE_KEY));

  useEffect(() => {
    function onExported(e) { setLastExport(e.detail?.exportedAt || Date.now()); }
    window.addEventListener('labmate-backup-exported', onExported);
    return () => window.removeEventListener('labmate-backup-exported', onExported);
  }, []);

  const now = Date.now();
  const due = (!lastExport || now - lastExport > WEEK_MS) && (!snoozedAt || now - snoozedAt > WEEK_MS);

  const backupNow = useCallback(() => exportBackup(), []);

  const snooze = useCallback(() => {
    const ts = Date.now();
    localStorage.setItem(SNOOZE_KEY, String(ts));
    db.settings.put({ key: SNOOZE_KEY, value: String(ts) }).catch(() => {});
    setSnoozedAt(ts);
  }, []);

  return { lastExport, due, backupNow, snooze };
}

// "today" / "3 d ago" / "never" — keys live in i18n (backupToday, backupDaysAgo, backupNever).
export function describeLastBackup(lastExport, t, lang) {
  if (!lastExport) return t('backupNever', lang);
  const days = Math.floor((Date.now() - lastExport) / (24 * 60 * 60 * 1000));
  if (days <= 0) return t('backupToday', lang);
  return t('backupDaysAgo', lang).replace('{n}', days);
}
