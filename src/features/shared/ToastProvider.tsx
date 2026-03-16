import { createContext, useContext, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface ToastContextValue {
  show: (msg: string, icon?: string) => void
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; icon: string }[]>([])
  const idRef = useRef(0)

  const show = useCallback((msg: string, icon = '\u2705') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, msg, icon }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className="toast">
              <span>{t.icon}</span> {t.msg}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
