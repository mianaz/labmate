// Quick timers (the web's QuickTimerPanel + timer dock) on one page.
const pageBehavior = require('../../behaviors/page');
const bus = require('../../lib/bus');
const timers = require('../../lib/timers');

const QUICK_TIMES = [
  { min: 1, label: '1 min' },
  { min: 5, label: '5 min' },
  { min: 10, label: '10 min' },
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '1 h' },
];

Component({
  behaviors: [pageBehavior],
  data: {
    titleKey: 'timerAdd',
    quick: QUICK_TIMES,
    customLabel: '',
    customMin: '',
    canStart: false,
    timers: [],
    doneCount: 0,
  },
  lifetimes: {
    attached() {
      this.sync(timers.list());
      this._off = bus.on('timers', (list) => this.sync(list));
    },
    detached() { if (this._off) this._off(); },
  },
  methods: {
    onPageShow() { this.sync(timers.list()); },
    sync(list) {
      this.setData({ timers: list, doneCount: list.filter((x) => x.done).length });
    },
    startQuick(e) {
      const min = Number(e.currentTarget.dataset.min);
      const q = QUICK_TIMES.find((x) => x.min === min);
      timers.add(this.data.customLabel || (q ? q.label : min + ' min'), min * 60);
      this.setData({ customLabel: '' });
    },
    onLabel(e) { this.setData({ customLabel: e.detail.value }); },
    onMinutes(e) {
      const v = e.detail.value;
      this.setData({ customMin: v, canStart: parseFloat(v) > 0 });
    },
    startCustom() {
      const m = parseFloat(this.data.customMin);
      if (!(m > 0)) return;
      timers.add(this.data.customLabel || (m + ' min'), Math.round(m * 60));
      this.setData({ customMin: '', customLabel: '', canStart: false });
    },
    pause(e) { timers.pause(e.currentTarget.dataset.id); },
    resume(e) { timers.resume(e.currentTarget.dataset.id); },
    reset(e) { timers.reset(e.currentTarget.dataset.id); },
    remove(e) { timers.remove(e.currentTarget.dataset.id); },
    clearDone() { timers.clearDone(); },
  },
});
