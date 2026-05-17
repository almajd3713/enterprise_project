export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmText: string
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </section>
    </div>
  )
}
