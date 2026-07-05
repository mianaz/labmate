import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const ToastContext = createContext({ show: () => {} });
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

  // show(msg, icon, { actionLabel, onAction, duration }) — options is optional and
  // backward-compatible with the original 2-arg show(msg, icon) call sites.
  const show = useCallback((msg, icon = '', options = {}) => {
    const { actionLabel, onAction, duration = 3000 } = options;
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, msg, icon, actionLabel, onAction, duration }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
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

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div className="toast-container">
          {toasts.map(t => (
            <div
              key={t.id}
              className="toast"
              style={t.duration !== 3000
                ? { animation: `toastIn 0.22s var(--ease-out), toastOut 0.22s ease-in ${Math.max(t.duration - 220, 0) / 1000}s forwards` }
                : undefined}
            >
              {t.icon && <span>{t.icon}</span>} {t.msg}
              {t.actionLabel && (
                <button
                  type="button"
                  className="mono"
                  onClick={() => { t.onAction?.(); dismiss(t.id); }}
                  style={{
                    marginLeft: '0.4rem',
                    flexShrink: 0,
                    background: 'transparent',
                    color: 'var(--primary)',
                    border: '2px solid var(--border-strong)',
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
