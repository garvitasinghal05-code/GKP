// DESTINATION: src/components/ui/ThemeToggle.tsx  (new file)
'use client'

import { Moon, Sun } from 'lucide-react'

// Flips <html data-theme="light|dark"> and remembers the choice on this device.
// Which icon shows is decided by CSS (see globals.css), so there is no flicker.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    root.setAttribute('data-theme', next)
    try { localStorage.setItem('gkp-theme', next) } catch { /* private mode: still works for this visit */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      title="Light / dark mode"
      className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-mint"
    >
      <Moon size={18} className="theme-icon-light" />
      <Sun size={18} className="theme-icon-dark" />
    </button>
  )
}
