// UI glue shared by the inventory pages: store results → toasts, and the web's
// downloads / file inputs → ui.shareTextFile / ui.pickTextFile.
const ui = require('../../../../lib/ui');
const { t, tf } = require('../../../../shared/i18n.js');

const REASON_KEYS = {
  storage: 'invSaveFailed',
  occupied: 'invPosOccupied',
  full: 'invNoEmptySlots',
  format: 'importError',
  name: 'invNameRequired',
  box: 'invNotFound',
  location: 'invNotFound',
  missing: 'invNotFound',
};

// true when res.ok; otherwise toasts why (a failed write included) and returns false.
function check(res, lang) {
  if (res && res.ok) return true;
  const key = REASON_KEYS[res && res.reason];
  if (key) ui.toast(t(key, lang));
  return false;
}

function isCancel(err) {
  return /cancel/i.test(String((err && (err.errMsg || err.message)) || ''));
}

// Send a CSV / JSON file to a chat. Where file sharing is unavailable (PC
// WeChat) the text goes to the clipboard instead.
function shareFile(fileName, content, lang) {
  return ui.shareTextFile(fileName, content).then(() => true, (err) => {
    if (isCancel(err)) return false;
    if (err && err.message === 'share_unsupported') {
      return ui.copy(content, t('invCsvCopied', lang)).then(() => false);
    }
    ui.toast(t('invShareFailed', lang));
    return false;
  });
}

// Pick a text file from a chat; resolves its content, or null (cancelled / failed).
function pickFile(extensions, lang) {
  return ui.pickTextFile(extensions).then((file) => file.content, (err) => {
    if (!isCancel(err)) ui.toast(t('importError', lang));
    return null;
  });
}

// "Restored 5 items (2 skipped — position conflict)"
function importMessage(res, lang) {
  let msg = tf('importSuccess', lang, { n: res.count || 0 });
  if (res.skipped) msg += tf('invImportSkipped', lang, { n: res.skipped });
  return msg;
}

module.exports = { check, shareFile, pickFile, importMessage, isCancel };
