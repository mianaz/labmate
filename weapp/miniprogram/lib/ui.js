// Thin promise wrappers over wx UI APIs.
const { t } = require('../shared/i18n.js');
const { getLang } = require('./lang');

function toast(title, icon) {
  wx.showToast({ title: String(title || ''), icon: icon || 'none', duration: 1800 });
}

// Resolves true when the user confirms.
function confirm(content, opts) {
  const o = opts || {};
  const lang = getLang();
  return new Promise((resolve) => {
    wx.showModal({
      title: o.title || '',
      content: String(content || ''),
      confirmText: o.confirmText || (lang === 'zh' ? '确定' : 'OK'),
      cancelText: o.cancelText || (lang === 'zh' ? '取消' : 'Cancel'),
      confirmColor: o.danger ? '#C42B1C' : '#0B7A3E',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    });
  });
}

function copy(text, doneMessage) {
  const lang = getLang();
  return new Promise((resolve) => {
    wx.setClipboardData({
      data: String(text || ''),
      success: () => { toast(doneMessage || t('copied', lang)); resolve(true); },
      fail: () => resolve(false),
    });
  });
}

// Action sheet → resolves the tapped index, or -1.
function actionSheet(items) {
  return new Promise((resolve) => {
    wx.showActionSheet({
      itemList: items,
      success: (res) => resolve(res.tapIndex),
      fail: () => resolve(-1),
    });
  });
}

// Write a text file to the user data dir and offer it to a chat (the mini
// program's version of the web's download link). Everything up to
// wx.shareFileMessage runs synchronously, so when this is called straight from
// a tap handler the share still counts as user-initiated.
function shareTextFile(fileName, content) {
  return new Promise((resolve, reject) => {
    if (!wx.shareFileMessage) { reject(new Error('share_unsupported')); return; }
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName;
    try {
      wx.getFileSystemManager().writeFileSync(filePath, content, 'utf8');
    } catch (err) {
      reject(err);
      return;
    }
    wx.shareFileMessage({ filePath, fileName, success: () => resolve(true), fail: reject });
  });
}

// Pick a file from a chat and read it as text.
function pickTextFile(extensions) {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: extensions,
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) { reject(new Error('no_file')); return; }
        wx.getFileSystemManager().readFile({
          filePath: file.path, encoding: 'utf8',
          success: (r) => resolve({ name: file.name, content: String(r.data).replace(/^\uFEFF/, '') }),
          fail: reject,
        });
      },
      fail: reject,
    });
  });
}

function go(url) {
  wx.navigateTo({ url, fail: () => wx.redirectTo({ url }) });
}

module.exports = { toast, confirm, copy, actionSheet, shareTextFile, pickTextFile, go };
