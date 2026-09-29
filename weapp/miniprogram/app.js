// LabMate — WeChat Mini Program. Everything is stored on the device (wx storage);
// there is no server. See weapp/README.md.
const timers = require('./lib/timers');

App({
  onLaunch() {
    timers.init();
  },
  onShow() {
    timers.wake();
  },
  onHide() {
    timers.sleep();
  },
  onError(err) {
    console.error('[app]', err);
  },
});
