// In-memory stand-in for the parts of the wx API the mini program uses. Every
// call is recorded in wx.__calls so tests can assert on navigation, toasts, etc.
const store = new Map();
const calls = [];

function record(name) {
  return (opts) => {
    calls.push({ name, opts });
    if (opts && typeof opts.success === 'function') {
      const res = name === 'showModal' ? { confirm: !!mock.__modalConfirm, cancel: !mock.__modalConfirm }
        : name === 'showActionSheet' ? { tapIndex: mock.__actionSheetIndex || 0 }
        : {};
      opts.success(res);
    }
    if (opts && typeof opts.complete === 'function') opts.complete({});
  };
}

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const mock = {
  __calls: calls,
  __store: store,
  __modalConfirm: true,
  __actionSheetIndex: 0,
  __reset() {
    store.clear();
    calls.length = 0;
    mock.__modalConfirm = true;
    mock.__actionSheetIndex = 0;
    mock.__fileContent = '';
    mock.__pickedFile = null;
    // module-level caches in the mini program's lib/
    try { require('../../miniprogram/lib/lang.js')._reset(); } catch (e) { /* not loaded yet */ }
    try { require('../../miniprogram/lib/timers.js').init(); } catch (e) { /* not loaded yet */ }
  },
  __called(name) { return calls.filter((c) => c.name === name); },

  getStorageSync(key) { return store.has(key) ? clone(store.get(key)) : ''; },
  setStorageSync(key, value) { store.set(key, clone(value)); },
  removeStorageSync(key) { store.delete(key); },
  clearStorageSync() { store.clear(); },
  getStorageInfoSync() { return { keys: [...store.keys()], currentSize: 1, limitSize: 10240 }; },

  getAppBaseInfo() { return { language: 'zh_CN', theme: 'light', SDKVersion: '3.5.0' }; },
  getSystemInfoSync() { return { language: 'zh_CN', windowWidth: 375, windowHeight: 667, pixelRatio: 2, platform: 'devtools' }; },
  getWindowInfo() { return { windowWidth: 375, windowHeight: 667, screenWidth: 375, screenHeight: 812, statusBarHeight: 44, pixelRatio: 2, safeArea: { bottom: 778 } }; },
  getMenuButtonBoundingClientRect() { return { top: 48, bottom: 80, left: 281, right: 368, width: 87, height: 32 }; },
  env: { USER_DATA_PATH: 'wxfile://usr' },

  navigateTo: record('navigateTo'),
  redirectTo: record('redirectTo'),
  switchTab: record('switchTab'),
  navigateBack: record('navigateBack'),
  reLaunch: record('reLaunch'),
  showToast: record('showToast'),
  hideToast: record('hideToast'),
  showModal: record('showModal'),
  showActionSheet: record('showActionSheet'),
  showLoading: record('showLoading'),
  hideLoading: record('hideLoading'),
  setNavigationBarTitle: record('setNavigationBarTitle'),
  setClipboardData: record('setClipboardData'),
  setKeepScreenOn: record('setKeepScreenOn'),
  vibrateLong: record('vibrateLong'),
  vibrateShort: record('vibrateShort'),
  pageScrollTo: record('pageScrollTo'),
  showShareMenu: record('showShareMenu'),
  shareFileMessage: record('shareFileMessage'),
  setInnerAudioOption: record('setInnerAudioOption'),
  // Set wx.__pickedFile = { name, content } to simulate picking a file from a chat.
  chooseMessageFile(opts) {
    calls.push({ name: 'chooseMessageFile', opts });
    if (mock.__pickedFile) {
      mock.__fileContent = mock.__pickedFile.content;
      opts.success({ tempFiles: [{ path: 'wxfile://tmp/' + mock.__pickedFile.name, name: mock.__pickedFile.name, size: mock.__pickedFile.content.length }] });
    } else if (opts.fail) {
      opts.fail({ errMsg: 'chooseMessageFile:fail cancel' });
    }
  },
  createInnerAudioContext() { return { src: '', play() { calls.push({ name: 'audio.play' }); }, stop() {}, destroy() {} }; },
  getFileSystemManager() {
    return {
      writeFile: record('fs.writeFile'),
      readFile(opts) { calls.push({ name: 'fs.readFile', opts }); if (opts.success) opts.success({ data: mock.__fileContent || '' }); },
    };
  },
  nextTick(fn) { setTimeout(fn, 0); },
  createSelectorQuery() {
    const q = { in() { return q; }, select() { return q; }, selectAll() { return q; }, boundingClientRect(cb) { if (cb) cb([]); return q; }, exec(cb) { if (cb) cb([]); return q; }, fields() { return q; } };
    return q;
  },
};

module.exports = mock;
