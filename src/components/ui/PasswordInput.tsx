// DESTINATION: src/components/ui/PasswordInput.tsx
'use client'

import { useState, InputHTMLAttributes } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export function PasswordInput({ label, className = '', ...props }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-1.5">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={visible ? 'text' : 'password'}
          className={`w-full px-3.5 py-2.5 pr-14 border-[1.5px] border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[var(--teal-2)] ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          style={{
            position: 'absolute', right: '.7rem', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600, color: '#0B4438',
          }}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}
