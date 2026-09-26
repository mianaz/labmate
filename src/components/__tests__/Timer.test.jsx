import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

vi.mock('../../lib/timerAlerts.js', () => ({
  primeTimerAlerts: vi.fn(),
  unlockTimerAudio: vi.fn(),
  alertTimerDone: vi.fn(),
  releaseTimerAudio: vi.fn(),
}));

const alerts = await import('../../lib/timerAlerts.js');
const { TimerProvider, useTimers, TIMERS_KEY } = await import('../Timer.jsx');

const START = new Date('2026-09-26T10:00:00Z').getTime();

function Harness() {
  const { timers, addTimer, pauseTimer, resumeTimer } = useTimers();
  const first = timers[0];
  return (
    <div>
      <button type="button" onClick={() => addTimer('Blocking', 60)}>start</button>
      {first && <button type="button" onClick={() => pauseTimer(first.id)}>pause</button>}
      {first && <button type="button" onClick={() => resumeTimer(first.id)}>resume</button>}
      <ul>
        {timers.map(tm => (
          <li key={tm.id} data-testid="timer">
            {tm.label}|{tm.remaining}|{tm.running ? 'running' : tm.done ? 'done' : 'paused'}
          </li>
        ))}
      </ul>
    </div>
  );
}

const mount = () => render(<TimerProvider><Harness /></TimerProvider>);
const shown = () => screen.queryAllByTestId('timer').map(el => el.textContent);
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
// A suspended page or throttled tab: the clock moves on, no timer callback runs.
const suspendFor = (ms) => act(() => { vi.setSystemTime(Date.now() + ms); });
const showPage = () => act(() => { document.dispatchEvent(new window.Event('visibilitychange')); });

beforeEach(() => {
  vi.useFakeTimers({ now: START });
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('timer engine', () => {
  it('counts down against the end time', () => {
    mount();
    fireEvent.click(screen.getByText('start'));
    expect(shown()).toEqual(['Blocking|60|running']);
    advance(10_010);
    expect(shown()).toEqual(['Blocking|50|running']);
    expect(alerts.primeTimerAlerts).toHaveBeenCalledTimes(1);
  });

  it('keeps real time while the page is suspended and alerts once it ends', () => {
    mount();
    fireEvent.click(screen.getByText('start'));
    suspendFor(45_000);
    showPage();
    expect(shown()).toEqual(['Blocking|15|running']);
    expect(alerts.alertTimerDone).not.toHaveBeenCalled();

    suspendFor(20_000);
    showPage();
    expect(shown()).toEqual(['Blocking|0|done']);
    expect(alerts.alertTimerDone).toHaveBeenCalledTimes(1);
    expect(alerts.alertTimerDone.mock.calls[0][0]).toMatchObject({ label: 'Blocking' });
  });

  it('fires from its own end-time timeout', () => {
    mount();
    fireEvent.click(screen.getByText('start'));
    advance(60_010);
    expect(shown()).toEqual(['Blocking|0|done']);
    advance(5_000);
    expect(alerts.alertTimerDone).toHaveBeenCalledTimes(1);
  });

  it('pausing freezes the remaining time and resuming continues it', () => {
    mount();
    fireEvent.click(screen.getByText('start'));
    advance(10_010);
    fireEvent.click(screen.getByText('pause'));
    suspendFor(120_000);
    advance(1_000);
    expect(shown()).toEqual(['Blocking|50|paused']);
    fireEvent.click(screen.getByText('resume'));
    advance(49_010);
    expect(shown()).toEqual(['Blocking|1|running']);
    advance(1_000);
    expect(shown()).toEqual(['Blocking|0|done']);
    expect(alerts.alertTimerDone).toHaveBeenCalledTimes(1);
  });
});

describe('timer persistence', () => {
  it('survives a reload', () => {
    mount();
    fireEvent.click(screen.getByText('start'));
    advance(5_000);
    cleanup();
    expect(JSON.parse(localStorage.getItem(TIMERS_KEY))).toHaveLength(1);

    suspendFor(20_000);
    mount();
    expect(shown()).toEqual(['Blocking|35|running']);
  });

  it('brings back a timer that ended while closed as finished, without an alarm', () => {
    mount();
    fireEvent.click(screen.getByText('start'));
    cleanup();
    suspendFor(5 * 60_000);
    mount();
    expect(shown()).toEqual(['Blocking|0|done']);
    advance(2_000);
    expect(alerts.alertTimerDone).not.toHaveBeenCalled();
  });

  it('follows timers started in another tab', () => {
    mount();
    const other = [{ id: 7, label: 'Wash', totalSeconds: 300, remaining: 300, running: true, endsAt: START + 300_000 }];
    act(() => {
      window.dispatchEvent(new window.StorageEvent('storage', { key: TIMERS_KEY, newValue: JSON.stringify(other) }));
    });
    expect(shown()).toEqual(['Wash|300|running']);
  });

  it('ignores malformed stored data', () => {
    localStorage.setItem(TIMERS_KEY, '{"not":"a list"}');
    mount();
    expect(shown()).toEqual([]);
    cleanup();
    localStorage.setItem(TIMERS_KEY, JSON.stringify([{ id: 1, label: 'x' }, null, 'junk']));
    mount();
    expect(shown()).toEqual([]);
  });
});

describe('screen wake lock', () => {
  let sentinel;
  beforeEach(() => {
    sentinel = { released: false, release: vi.fn(() => { sentinel.released = true; return Promise.resolve(); }) };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: vi.fn(() => Promise.resolve(sentinel)) } });
    window.matchMedia = (query) => ({ matches: query === '(pointer: coarse)', addEventListener() {}, removeEventListener() {} });
  });
  afterEach(() => {
    delete navigator.wakeLock;
    delete window.matchMedia;
  });

  it('keeps a touch screen on while a timer runs and lets it sleep afterwards', async () => {
    mount();
    expect(navigator.wakeLock.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('start'));
    await act(async () => {});
    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    advance(60_010);
    await act(async () => {});
    expect(sentinel.release).toHaveBeenCalled();
  });
});
