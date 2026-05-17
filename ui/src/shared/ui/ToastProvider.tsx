import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Toast = { id: number; kind: 'success' | 'error' | 'info'; message: string }

type ToastContextType = {
  pushToast: (kind: Toast['kind'], message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section className="toast-stack" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <article key={toast.id} className={`toast ${toast.kind}`}>
            {toast.message}
          </article>
        ))}
      </section>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider')
  }
  return ctx
}
