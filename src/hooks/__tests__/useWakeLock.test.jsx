import { render, act, cleanup } from '@testing-library/react';
import { useWakeLock } from '../useWakeLock.js';

function Probe({ active }) {
  useWakeLock(active);
  return null;
}

function installWakeLock() {
  const sentinels = [];
  const request = vi.fn(() => {
    const s = { released: false, release: vi.fn(() => { s.released = true; return Promise.resolve(); }) };
    sentinels.push(s);
    return Promise.resolve(s);
  });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return { request, sentinels };
}

afterEach(() => {
  cleanup();
  delete navigator.wakeLock;
});

describe('useWakeLock', () => {
  it('holds the screen while active and lets go when switched off', async () => {
    const { request, sentinels } = installWakeLock();
    const { rerender } = render(<Probe active={false} />);
    expect(request).not.toHaveBeenCalled();
    rerender(<Probe active />);
    await act(async () => {});
    expect(request).toHaveBeenCalledWith('screen');
    rerender(<Probe active={false} />);
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it('asks again when the page is shown after the browser dropped the lock', async () => {
    const { request, sentinels } = installWakeLock();
    render(<Probe active />);
    await act(async () => {});
    sentinels[0].released = true; // browsers release the lock when the page is hidden
    await act(async () => { document.dispatchEvent(new window.Event('visibilitychange')); });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing where the API is missing', () => {
    expect(() => render(<Probe active />)).not.toThrow();
  });
});
