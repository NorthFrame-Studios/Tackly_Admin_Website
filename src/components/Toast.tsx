import { CheckCircle2, X, XCircle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { ToastContext, type ToastType } from './toastContext'

interface ToastItem { id: number; message: string; type: ToastType }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, type }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500)
  }, [])
  const value = useMemo(() => ({ showToast }), [showToast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`} role="status">
            {toast.type === 'success' ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
            <span>{toast.message}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Luk besked"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
