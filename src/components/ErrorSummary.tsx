import { useEffect, useRef } from 'react'

/**
 * Accessible summary of validation errors: it is announced by screen readers and
 * takes focus whenever the list of errors changes, so the problems are never missed.
 */
export function ErrorSummary({ title, errors }: { title: string; errors: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const signature = errors.join('|')

  useEffect(() => {
    if (signature.length > 0) {
      ref.current?.focus()
    }
  }, [signature])

  if (errors.length === 0) {
    return null
  }

  return (
    <div className="alert alert--error" role="alert" tabIndex={-1} ref={ref}>
      <strong>{title}</strong>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  )
}
