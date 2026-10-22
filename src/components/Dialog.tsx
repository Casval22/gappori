import { useEffect, useRef, type ReactNode } from 'react'
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      dialog = ref.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-label={title}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="quiet" onClick={onClose}>
          閉じる ×
        </button>
      </div>
      {children}
    </dialog>
  )
}
