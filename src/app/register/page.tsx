import { Suspense } from 'react'
// FILE: src/app/register/page.tsx
import { AuthCard } from '@/components/ui/AuthCard'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <AuthCard title="Create your account" subtitle="Choose how you'll use GKP — pick one role per account.">
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  )
}
