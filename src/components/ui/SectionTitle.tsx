// DESTINATION: src/components/ui/SectionTitle.tsx  (new file)
import { ReactNode } from 'react'

// Big, easy-to-spot section heading with a gold marker bar and optional icon + count.
export function SectionTitle({
  children, icon, count, className = '',
}: { children: ReactNode; icon?: ReactNode; count?: number; className?: string }) {
  return (
    <h2 className={`mb-4 flex items-center gap-3 text-2xl font-extrabold sm:text-3xl ${className}`}>
      <span className="h-7 w-1.5 shrink-0 rounded-full bg-gold" />
      {icon && <span className="text-brand-2">{icon}</span>}
      <span>{children}</span>
      {count !== undefined && (
        <span className="rounded-full bg-mint px-3 py-0.5 text-sm font-bold text-heading">{count}</span>
      )}
    </h2>
  )
}
