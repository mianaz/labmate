// wx storage with the web app's localStorage key names, so a backup file moves
// freely between the web app and the mini program (see lib/backup.js).
// Values are stored already parsed (the web stores JSON strings).

function get(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined || v === null ? fallback : v;
  } catch (err) {
    return fallback;
  }
}

// Returns false when the write failed (storage full: 10 MB total, 1 MB per key).
function set(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (err) {
    console.error('[storage] write failed', key, err);
    return false;
  }
}

function remove(key) {
  try { wx.removeStorageSync(key); } catch (err) { /* ignore */ }
}

function keys() {
  try { return wx.getStorageInfoSync().keys || []; } catch (err) { return []; }
}

function info() {
  try { return wx.getStorageInfoSync(); } catch (err) { return { keys: [], currentSize: 0, limitSize: 10240 }; }
}

module.exports = { get, set, remove, keys, info };
