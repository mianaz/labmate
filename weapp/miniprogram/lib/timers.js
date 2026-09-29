// Bench timers — same model as the web app (src/components/Timer.jsx):
//   { id, label, totalSeconds, running, endsAt (ms, while running),
//     remaining (s, while paused), done, finishedAt (ms) }
// A running timer stores the moment it ends, not a counter, so it stays right
// while the mini program is in the background (WeChat suspends JS there). Timers
// are saved under the web's key, so they survive the mini program being closed;
// ones that ran out while it was closed come back finished, without an alarm.
const storage = require('./storage');
const bus = require('./bus');
const keepAwake = require('./keep-awake');
const { t } = require('../shared/i18n.js');
const { getLang } = require('./lang');
const { formatTimer, formatClock } = require('./format');

const KEY = 'labmate_timers';
let timers = [];
let tickHandle = null;
let foreground = true;
let audio = null;

function remainingOf(tmr, now) {
  if (!tmr.running) return tmr.remaining;
  return Math.max(0, Math.ceil((tmr.endsAt - now) / 1000));
}

function finished(tmr) {
  return Object.assign({}, tmr, { running: false, done: true, remaining: 0, endsAt: null, finishedAt: tmr.endsAt });
}

function isTimer(x) {
  return !!x && typeof x === 'object' && ['number', 'string'].includes(typeof x.id)
    && typeof x.label === 'string' && Number.isFinite(x.totalSeconds) && x.totalSeconds > 0
    && (x.running ? Number.isFinite(x.endsAt) : Number.isFinite(x.remaining));
}

function parseTimers(list, now) {
  if (!Array.isArray(list)) return [];
  return list.filter(isTimer).map((tmr) => (tmr.running && tmr.endsAt <= now ? finished(tmr) : tmr));
}

function save() {
  if (timers.length) storage.set(KEY, timers);
  else storage.remove(KEY);
}

// What the UI renders: remaining seconds resolved against now, plus display bits.
function view(now) {
  const at = now || Date.now();
  return timers.map((tmr) => {
    const remaining = remainingOf(tmr, at);
    const done = !!tmr.done || (remaining <= 0 && !tmr.running);
    return {
      id: tmr.id,
      label: tmr.label,
      running: !!tmr.running,
      done,
      remaining,
      display: done ? '' : formatTimer(remaining),
      finishedClock: tmr.finishedAt ? formatClock(tmr.finishedAt) : '',
      pct: tmr.totalSeconds ? Math.round(((tmr.totalSeconds - remaining) / tmr.totalSeconds) * 1000) / 10 : 0,
    };
  });
}

function list() { return view(); }
function runningCount() { return timers.filter((x) => x.running).length; }

function publish() {
  bus.emit('timers', view());
}

function alertDone(due) {
  try { wx.vibrateLong(); setTimeout(() => wx.vibrateLong(), 600); } catch (err) { /* no vibration */ }
  try {
    if (wx.setInnerAudioOption) wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true });
    if (!audio) {
      audio = wx.createInnerAudioContext();
      audio.src = '/assets/chime.wav';
    }
    audio.stop();
    audio.play();
  } catch (err) { /* audio unavailable */ }
  const lang = getLang();
  wx.showModal({
    title: t('timerNotifyTitle', lang),
    content: due.map((x) => x.label).join('\n'),
    showCancel: false,
    confirmText: lang === 'zh' ? '知道了' : 'OK',
  });
}

// Finish timers that have run out; alert only when `alert` (i.e. while open).
function settle(alert) {
  const now = Date.now();
  const due = timers.filter((x) => x.running && x.endsAt <= now);
  if (due.length) {
    const ids = new Set(due.map((x) => x.id));
    timers = timers.map((x) => (ids.has(x.id) && x.running ? finished(x) : x));
    save();
    if (alert) alertDone(due);
  }
  schedule();
  publish();
}

function schedule() {
  const hasRunning = timers.some((x) => x.running);
  if (hasRunning) keepAwake.acquire('timers'); else keepAwake.release('timers');
  if (hasRunning && foreground) {
    if (!tickHandle) tickHandle = setInterval(() => settle(true), 1000);
  } else if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function init() {
  timers = parseTimers(storage.get(KEY, []), Date.now());
  save();
  schedule();
}

function add(label, seconds) {
  const total = Math.max(1, Math.round(seconds));
  const start = Date.now();
  const id = start + Math.random();
  timers = timers.concat({ id, label: String(label || ''), totalSeconds: total, remaining: total, running: true, endsAt: start + total * 1000, startedAt: start });
  save();
  schedule();
  publish();
  return id;
}

function update(id, fn) {
  timers = timers.map((x) => (x.id === id ? fn(x) : x));
  save();
  schedule();
  publish();
}

function pause(id) {
  const at = Date.now();
  update(id, (x) => (x.running && x.endsAt > at ? Object.assign({}, x, { running: false, remaining: remainingOf(x, at), endsAt: null }) : x));
}

function resume(id) {
  const at = Date.now();
  update(id, (x) => (!x.running && !x.done && x.remaining > 0 ? Object.assign({}, x, { running: true, endsAt: at + x.remaining * 1000 }) : x));
}

function reset(id) {
  update(id, (x) => Object.assign({}, x, { running: false, done: false, remaining: x.totalSeconds, endsAt: null, finishedAt: null }));
}

function remove(id) {
  timers = timers.filter((x) => x.id !== id);
  save();
  schedule();
  publish();
}

function clearDone() {
  timers = timers.filter((x) => !(x.done || (!x.running && x.remaining <= 0)));
  save();
  schedule();
  publish();
}

// App.onShow / onHide
function wake() {
  foreground = true;
  keepAwake.reapply();
  settle(true);
}
function sleep() {
  foreground = false;
  schedule();
}

module.exports = {
  KEY, init, add, pause, resume, reset, remove, clearDone, list, runningCount, wake, sleep,
  // exported for tests
  _parseTimers: parseTimers, _remainingOf: remainingOf,
};
