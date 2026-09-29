// Active UI language ('en' | 'zh'), stored under the web app's key.
const storage = require('./storage');
const bus = require('./bus');

const KEY = 'biolab_lang';
let current = null;

function systemLang() {
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    return String(info.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch (err) {
    return 'zh';
  }
}

function getLang() {
  if (!current) {
    const stored = storage.get(KEY, '');
    current = stored === 'en' || stored === 'zh' ? stored : systemLang();
  }
  return current;
}

function setLang(lang) {
  if (lang !== 'en' && lang !== 'zh') return;
  current = lang;
  storage.set(KEY, lang);
  bus.emit('lang', lang);
}

// Tests: forget the cached value so the next getLang() re-reads storage.
function _reset() { current = null; }

module.exports = { getLang, setLang, _reset };
