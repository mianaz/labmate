import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { alertTimerDone, primeTimerAlerts } from '../timerAlerts.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function installNotification({ permission, throws = false }) {
  const calls = [];
  function FakeNotification(title, options) {
    if (throws) throw new TypeError("Failed to construct 'Notification': Illegal constructor.");
    calls.push({ title, options });
  }
  FakeNotification.permission = permission;
  FakeNotification.requestPermission = vi.fn(() => Promise.resolve('granted'));
  vi.stubGlobal('Notification', FakeNotification);
  return { calls, Notification: FakeNotification };
}

function installServiceWorker(registration) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn(() => Promise.resolve(registration)) },
  });
}

beforeEach(() => { document.documentElement.lang = 'en'; });
afterEach(() => {
  vi.unstubAllGlobals();
  delete navigator.serviceWorker;
});

describe('timer alerts', () => {
  it('notifies through the service worker when there is one (Chrome on Android has no constructor)', async () => {
    installNotification({ permission: 'granted', throws: true });
    const showNotification = vi.fn(() => Promise.resolve());
    installServiceWorker({ showNotification });

    expect(() => alertTimerDone({ id: 3, label: 'Primary antibody' })).not.toThrow();
    await flush();

    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = showNotification.mock.calls[0];
    expect(title).toBe('Timer done');
    expect(options).toMatchObject({ body: 'Primary antibody', tag: 'labmate-timer-3', requireInteraction: true });
  });

  it('falls back to the Notification constructor without a service worker', async () => {
    const { calls } = installNotification({ permission: 'granted' });
    document.documentElement.lang = 'zh-CN';
    alertTimerDone({ id: 4, label: '封闭' });
    await flush();
    expect(calls).toEqual([expect.objectContaining({ title: '计时结束', options: expect.objectContaining({ body: '封闭' }) })]);
  });

  it('never throws when notifications are unavailable', async () => {
    installNotification({ permission: 'granted', throws: true });
    expect(() => alertTimerDone({ id: 5, label: 'Wash' })).not.toThrow();
    await flush();
  });

  it('asks for notification permission only while the choice is undecided', () => {
    const undecided = installNotification({ permission: 'default' });
    primeTimerAlerts();
    expect(undecided.Notification.requestPermission).toHaveBeenCalledTimes(1);

    const denied = installNotification({ permission: 'denied' });
    primeTimerAlerts();
    expect(denied.Notification.requestPermission).not.toHaveBeenCalled();
  });
});
