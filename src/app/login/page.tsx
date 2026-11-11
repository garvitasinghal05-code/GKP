import { Suspense } from 'react'
// FILE: src/app/login/page.tsx
import { AuthCard } from '@/components/ui/AuthCard'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" subtitle="Log in to track orders, save addresses, and check out faster.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  )
}
