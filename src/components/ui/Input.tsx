// DESTINATION: src/components/ui/Input.tsx  (replaces the existing file)
import { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: Props) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <input
        className={`field ${error ? '!border-danger' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
