import { useEffect } from 'react';

export function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

// Keeps the screen on while `active` (Screen Wake Lock API). Browsers drop the
// lock whenever the page is hidden, so it is requested again when the page is
// shown. Best effort: without support, in battery saver or when the request is
// refused, the screen keeps its normal timeout.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !isWakeLockSupported()) return undefined;
    let sentinel = null;
    let pending = false;
    let disposed = false;
    const acquire = () => {
      if (disposed || pending || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      pending = true;
      navigator.wakeLock.request('screen')
        .then(s => {
          if (disposed) s.release().catch(() => {});
          else sentinel = s;
        })
        .catch(() => {})
        .finally(() => { pending = false; });
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      if (sentinel && !sentinel.released) sentinel.release().catch(() => {});
    };
  }, [active]);
}
