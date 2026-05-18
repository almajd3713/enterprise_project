import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/button'

type EntityDrawerProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function EntityDrawer({ open, title, description, onClose, children, footer }: EntityDrawerProps) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const firstFocusable = panelRef.current
      ?.querySelector<HTMLElement>('.drawer-body input,.drawer-body select,.drawer-body textarea,.drawer-body button,.drawer-body [tabindex]:not([tabindex="-1"])')
    firstFocusable?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
            {description ? <p id={descId} className="text-sm text-muted-foreground mt-1">{description}</p> : null}
          </div>
          <Button type="button" variant="secondary" onClick={onClose} aria-label="Close panel">Close</Button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer ? <footer className="drawer-footer">{footer}</footer> : null}
      </aside>
    </div>
  )
}
