import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

export const ToastContext = createContext({ show: () => {} });

// Callers pass either a glyph ('✓', '⚠') or a type name as the second argument;
// type names map to a glyph instead of being printed literally.
const TYPE_GLYPHS = { success: '✓', error: '⚠', warning: '⚠', info: '' };
const glyphFor = (icon) => (icon in TYPE_GLYPHS ? TYPE_GLYPHS[icon] : icon);
export function useToast() { return useContext(ToastContext); }

// ToastProvider sits above LangContext.Provider in the tree (see App.jsx), so it can't
// use useLang()/t() for toasts it generates itself (SW update, online/offline). Read the
// persisted language directly instead — same value useLocalStorage('lang', ...) maintains.
function currentLang() {
  try {
    const raw = localStorage.getItem('biolab_lang');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore parse errors, fall through to navigator default */ }
  return (navigator.language || '').startsWith('zh') ? 'zh' : 'en';
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timeoutsRef = useRef(new Set());
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => { timeouts.forEach(clearTimeout); timeouts.clear(); };
  }, []);

  // show(msg, icon, { actionLabel, onAction, duration }) — options is optional and
  // backward-compatible with the original 2-arg show(msg, icon) call sites.
  const show = useCallback((msg, icon = '', options = {}) => {
    const { actionLabel, onAction, duration = 3000 } = options;
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, msg, icon, actionLabel, onAction, duration }]);
    const handle = setTimeout(() => {
      timeoutsRef.current.delete(handle);
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    timeoutsRef.current.add(handle);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Service-worker update available: main.jsx dispatches this once a new SW is
  // installed-and-waiting behind an existing controller (i.e. a real update, not the
  // first install). Reload happens in main.jsx's controllerchange listener.
  useEffect(() => {
    function handleWaiting(e) {
      const worker = e.detail && e.detail.worker;
      if (!worker) return;
      const lang = currentLang();
      show(lang === 'zh' ? '有可用更新' : 'Update available', '⟳', {
        actionLabel: lang === 'zh' ? '刷新' : 'Reload',
        onAction: () => worker.postMessage({ type: 'SKIP_WAITING' }),
        duration: 15000,
      });
    }
    window.addEventListener('labmate-sw-waiting', handleWaiting);
    return () => window.removeEventListener('labmate-sw-waiting', handleWaiting);
  }, [show]);

  // Online/offline status toasts. online/offline only fire on actual transitions (not
  // on initial load), but guard against the first ~1.5s anyway in case a browser fires
  // a spurious event right after load.
  useEffect(() => {
    const mountedAt = Date.now();
    const settled = () => Date.now() - mountedAt > 1500;
    function handleOnline() {
      if (!settled()) return;
      const lang = currentLang();
      show(lang === 'zh' ? '已恢复在线' : 'Back online', '✓');
    }
    function handleOffline() {
      if (!settled()) return;
      const lang = currentLang();
      show(lang === 'zh' ? '您已离线——仅显示缓存数据' : "You're offline — cached data only", '⚠');
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [show]);

  // Memoized so a toast appearing or expiring doesn't re-render every useToast()
  // consumer (every RecipeCard in the list holds one).
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map(t => (
            <div
              key={t.id}
              className="toast"
              style={t.duration !== 3000
                ? { animation: `toastIn 0.22s var(--ease-out), toastOut 0.22s ease-in ${Math.max(t.duration - 220, 0) / 1000}s forwards` }
                : undefined}
            >
              {glyphFor(t.icon) && <span className="mono" aria-hidden="true" style={{ fontWeight: 700 }}>{glyphFor(t.icon)}</span>}
              <span>{t.msg}</span>
              {t.actionLabel && (
                <button
                  type="button"
                  className="mono"
                  onClick={() => { t.onAction?.(); dismiss(t.id); }}
                  style={{
                    marginLeft: '0.4rem',
                    flexShrink: 0,
                    background: 'var(--primary)',
                    color: 'var(--on-primary)',
                    border: '1px solid currentColor',
                    borderRadius: 0,
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
