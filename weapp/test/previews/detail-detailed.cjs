// Preview setup: open the detailed step view with a couple of steps done and a timer running.
module.exports = {
  seed(wx) {
    wx.setStorageSync('stepTracker_wb_protocol', [1, 2]);
    wx.setStorageSync('biolab_lang', 'en');
  },
  async run(comp) {
    comp.instance.setStepMode({ currentTarget: { dataset: { mode: 'detailed' } } });
    require('../../miniprogram/lib/timers').add('Western Blot - 1 h', 3600);
  },
};
