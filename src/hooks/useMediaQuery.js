import { useState, useEffect } from 'react';

// matchMedia is missing in some environments (jsdom in tests) — treat as no match.
function matches(query) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia(query).matches;
}

export function useMediaQuery(query) {
  const [isMatch, setIsMatch] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const handler = (e) => setIsMatch(e.matches);
    setIsMatch(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return isMatch;
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)');
}

// ≥1024px: the sidebar layout (matches Tailwind's lg breakpoint used by the shell).
export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}
