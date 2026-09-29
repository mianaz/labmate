// Running timers, floating above the bottom nav (the web's TimerBar). Tap a
// timer's label to open the timer page.
const bus = require('../../lib/bus');
const timers = require('../../lib/timers');
const langBehavior = require('../../behaviors/lang');

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    // true on tab pages (sits above the tab bar), false on pushed pages.
    tab: { type: Boolean, value: false },
  },
  data: { timers: [], expanded: false },
  lifetimes: {
    attached() {
      this.setData({ timers: timers.list() });
      this._off = bus.on('timers', (list) => this.setData({ timers: list }));
    },
    detached() { if (this._off) this._off(); },
  },
  pageLifetimes: {
    show() { this.setData({ timers: timers.list() }); },
  },
  methods: {
    pause(e) { timers.pause(e.currentTarget.dataset.id); },
    resume(e) { timers.resume(e.currentTarget.dataset.id); },
    reset(e) { timers.reset(e.currentTarget.dataset.id); },
    remove(e) { timers.remove(e.currentTarget.dataset.id); },
    toggle() { this.setData({ expanded: !this.data.expanded }); },
    open() { wx.navigateTo({ url: '/pages/timer/index' }); },
  },
});
