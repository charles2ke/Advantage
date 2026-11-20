import { useEffect, useRef, type ReactNode } from 'react'

/** An inline confirmation step. It takes focus when it opens so keyboard users land on it. */
export function ConfirmPanel({
  label,
  children,
  actions,
}: {
  label: string
  children: ReactNode
  actions: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus()
  }, [])

  return (
    <div className="confirm" role="group" aria-label={label} tabIndex={-1} ref={panel}>
      {children}
      <div className="button-row">{actions}</div>
    </div>
  )
}
