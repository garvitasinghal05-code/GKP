// DESTINATION: src/components/ui/Button.tsx  (replaces the existing file)
import { ButtonHTMLAttributes } from 'react'

// primary : solid teal
// accent  : gold — keep for the ONE key action on a screen
// ghost   : teal outline
// outline : quiet neutral button
// danger  : neutral until hovered, then turns red (delete actions)
export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'outline' | 'danger'
export type ButtonSize = 'md' | 'sm'

const styles: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-2',
  accent: 'bg-gold text-[#0B4438] hover:brightness-95',
  ghost: 'bg-transparent border-[1.5px] border-brand text-heading hover:bg-mint',
  outline: 'bg-surface border border-line text-ink hover:bg-mint',
  danger:
    'bg-surface border border-line text-danger hover:bg-[var(--danger-solid)] hover:border-[var(--danger-solid)] hover:text-white',
}

const sizes: Record<ButtonSize, string> = {
  md: 'text-sm px-5 py-2.5',
  sm: 'text-xs px-3.5 py-1.5',
}

// Also usable on <Link>: <Link className={buttonClass({ variant: 'primary' })}>
export function buttonClass(o: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  const { variant = 'primary', size = 'md', block, className = '' } = o
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold no-underline transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${styles[variant]} ${block ? 'w-full' : ''} ${className}`
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}

export function Button({ variant = 'primary', size = 'md', block, className = '', ...props }: Props) {
  return <button className={buttonClass({ variant, size, block, className })} {...props} />
}
