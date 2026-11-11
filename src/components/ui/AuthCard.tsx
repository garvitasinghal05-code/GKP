// DESTINATION: src/components/ui/AuthCard.tsx  (replaces the existing file)
import { ReactNode } from 'react'

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="card mx-4 mt-12 max-w-md p-8 shadow-sm sm:mx-auto">
      <h1 className="mb-1 text-3xl font-bold">{title}</h1>
      <p className="mb-6 text-sm text-muted">{subtitle}</p>
      {children}
    </div>
  )
}
