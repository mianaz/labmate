// Alerts for a finished timer: a chime, a vibration and a system notification.
//
// Two of these only work if they were set up inside a user gesture: iOS keeps an
// AudioContext created outside one suspended (silent), and Safari and Firefox
// ignore notification permission requests made outside one. So
// primeTimerAlerts() runs from the click that starts a timer, and
// alertTimerDone() runs later, from the timer engine.
import { t } from '../i18n/index.js';

let audioCtx = null;

function audioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new Ctx();
  return audioCtx;
}

// Audio only: safe to call from any tap (used after a reload restores timers).
export function unlockTimerAudio() {
  try {
    const ctx = audioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { /* no Web Audio */ }
}

// Call from the click that starts or resumes a timer.
export function primeTimerAlerts() {
  unlockTimerAudio();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const pending = Notification.requestPermission();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    }
  } catch { /* notifications unsupported */ }
}

function playChime() {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  [0, 0.3, 0.6].forEach(delay => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.15);
  });
}

async function showNotification(timer) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const lang = (document.documentElement.lang || '').startsWith('zh') ? 'zh' : 'en';
  const title = t('timerNotifyTitle', lang);
  const options = {
    body: timer.label,
    tag: `labmate-timer-${timer.id}`,
    renotify: true,
    requireInteraction: true,
    icon: `${import.meta.env.BASE_URL}favicon-192x192.png`,
  };
  // Chrome on Android has no page-level Notification constructor (it throws);
  // notifications have to go through the service worker there.
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, options);
      return;
    }
  } catch { /* fall back to the constructor */ }
  try { new Notification(title, options); } catch { /* not available here */ }
}

export function alertTimerDone(timer) {
  try { playChime(); } catch { /* audio blocked */ }
  try { if (typeof navigator.vibrate === 'function') navigator.vibrate([300, 150, 300, 150, 300]); } catch { /* no vibration */ }
  showNotification(timer).catch(() => {});
}

export function releaseTimerAudio() {
  if (!audioCtx) return;
  audioCtx.close().catch(() => {});
  audioCtx = null;
}
