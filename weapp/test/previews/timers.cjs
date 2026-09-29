// Preview setup: a running, a paused and a finished timer.
module.exports = {
  seed(wx) {
    const now = Date.now();
    wx.setStorageSync('labmate_timers', [
      { id: 1, label: 'Blocking', totalSeconds: 3600, running: true, endsAt: now + 2400 * 1000, remaining: 3600 },
      { id: 2, label: 'Primary antibody', totalSeconds: 900, running: false, remaining: 420 },
      { id: 3, label: 'Wash ×3', totalSeconds: 300, running: false, done: true, remaining: 0, finishedAt: now - 60000 },
    ]);
  },
  async run() { require('../../miniprogram/lib/timers').init(); },
};
