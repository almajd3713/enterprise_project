import { Toaster, toast } from 'sonner'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors position="bottom-right" />
    </>
  )
}

export function useToast() {
  return {
    pushToast: (kind: 'success' | 'error' | 'info', message: string) => {
      if (kind === 'success') toast.success(message)
      else if (kind === 'error') toast.error(message)
      else toast(message)
    },
  }
}
