// InstallPrompt — slim dismissible "Add to Home Screen" chip (mobile only).
// Self-contained: no props. Handles both the standard beforeinstallprompt flow
// (Chrome/Edge/Android) and the iOS Safari fallback (no native prompt event there).
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../i18n/index.js';

const DISMISS_KEY = 'labmate-install-dismissed';
const VISITS_KEY = 'labmate-install-visits';
const SESSION_VISIT_FLAG = 'labmate-install-visit-counted';
const DISMISS_DAYS = 30; // re-offer after 30 days, not permanently
const SHOW_DELAY_MS = 4000; // don't nag immediately on paint
const MIN_VISITS = 2; // only show from the 2nd tab-session onward

function isStandalone() {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isSafari() {
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|crios|fxios|edgios|android/i.test(ua);
}

function isDismissedRecently() {
  const at = parseInt(localStorage.getItem(DISMISS_KEY), 10);
  return !!at && (Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000);
}

function isEligible() {
  if (isStandalone()) return false;
  if (isDismissedRecently()) return false;
  const visits = parseInt(localStorage.getItem(VISITS_KEY), 10) || 0;
  return visits >= MIN_VISITS;
}

export default function InstallPrompt() {
  const lang = useLang();
  const deferredRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return undefined;

    // Count this visit once per tab session (sessionStorage guards against
    // double-counting on remounts / React StrictMode double-invoke in dev).
    if (!window.sessionStorage.getItem(SESSION_VISIT_FLAG)) {
      const v = parseInt(localStorage.getItem(VISITS_KEY), 10) || 0;
      localStorage.setItem(VISITS_KEY, String(v + 1));
      window.sessionStorage.setItem(SESSION_VISIT_FLAG, '1');
    }

    let timer = null;
    function scheduleShow() {
      if (timer) return;
      timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }

    function handleBeforeInstall(e) {
      e.preventDefault();
      deferredRef.current = e;
      if (isEligible()) scheduleShow();
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS Safari never fires beforeinstallprompt — offer the manual-steps hint instead.
    if (isIOS() && isSafari() && isEligible()) {
      setIosHint(true);
      scheduleShow();
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  const handleInstall = useCallback(async () => {
    const promptEvent = deferredRef.current;
    if (!promptEvent) return;
    promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } catch {
      /* user dismissed the native prompt — ignore */
    }
    deferredRef.current = null;
    setVisible(false);
  }, []);

  if (!visible || isStandalone()) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-40 flex lg:hidden mono"
      style={{
        bottom: 'calc(var(--fab-b) + 0.5rem)',
        left: '1rem',
        maxWidth: 'calc(100vw - 2rem)',
        alignItems: 'center',
        gap: '0.6rem',
        background: 'var(--card)',
        color: 'var(--text)',
        border: '2px solid var(--border-strong)',
        borderRadius: 0,
        boxShadow: 'var(--shadow)',
        padding: '0.55rem 0.7rem',
        fontSize: '0.78rem',
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.3 }}>
        {iosHint
          ? (lang === 'zh' ? '添加到主屏幕：点击"分享" → "添加到主屏幕"' : 'Add to Home Screen: Share → Add to Home Screen')
          : (lang === 'zh' ? '安装 LabMate' : 'Install LabMate')}
      </span>
      {!iosHint && (
        <button
          type="button"
          onClick={handleInstall}
          className="btn-primary"
          style={{ padding: '4px 10px', fontSize: '0.72rem', flexShrink: 0 }}
        >
          {lang === 'zh' ? '安装' : 'Install'}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={lang === 'zh' ? '关闭' : 'Dismiss'}
        style={{
          fontWeight: 700,
          fontSize: '1rem',
          lineHeight: 1,
          color: 'var(--text-muted)',
          padding: '0 0.15rem',
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
