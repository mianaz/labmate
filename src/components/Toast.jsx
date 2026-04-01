import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export const ToastContext = createContext({ show: () => {} });
export function useToast() { return useContext(ToastContext); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const show = useCallback((msg, icon = '') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, msg, icon }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div className="toast-container">
          {toasts.map(t => <div key={t.id} className="toast">{t.icon && <span>{t.icon}</span>} {t.msg}</div>)}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
