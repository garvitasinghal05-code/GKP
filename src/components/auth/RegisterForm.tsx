'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'

export function RegisterForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  // Keep the visitor's place if they arrived from e.g. "Add to Cart" on a shop page.
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  // "intent" only decides where we send the user after verifying —
  // it does NOT create a different kind of account. Every account is
  // the same; owning a shop is a separate, addable thing.
  const [intent, setIntent] = useState<'customer' | 'owner'>('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'details' | 'verify'>('details')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignUp(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    })

    setLoading(false)
    if (error) return setError(error.message)

    // Supabase returns a fake "success" with no identities and sends no
    // email when the address is already registered (this hides whether
    // an email exists, for privacy). This is how we detect that case.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('An account with this email already exists. Please log in instead.')
      return
    }

    setStep('verify')
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
    setLoading(false)
    if (error) return setError(error.message)
    // A "become a shop owner" intent takes priority; otherwise send them
    // back wherever they came from (e.g. the shop page they were adding
    // items from), falling back to the homepage.
    router.push(intent === 'owner' ? '/dashboard/shop-owner/onboarding' : next || '/')
    router.refresh()
  }

  if (step === 'verify') {
    return (
      <form onSubmit={handleVerify}>
        <p className="text-sm text-gray-500 mb-4">
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to finish creating your account.
        </p>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <Input label="6-digit code" required maxLength={6} value={code} onChange={e => setCode(e.target.value)} />
        <Button block disabled={loading}>{loading ? 'Verifying…' : 'Verify & Create Account'}</Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSignUp}>
      <div className="flex gap-3 mb-5">
        <button
          type="button"
          onClick={() => setIntent('customer')}
          className={`flex-1 border-[1.5px] rounded-lg p-3 text-sm font-semibold text-center transition ${
            intent === 'customer' ? 'border-[var(--teal-1)] bg-[#EFF7F3] text-[var(--teal-1)]' : 'border-gray-200'
          }`}
        >
          🛍️<br />I&apos;m a Customer
        </button>
        <button
          type="button"
          onClick={() => setIntent('owner')}
          className={`flex-1 border-[1.5px] rounded-lg p-3 text-sm font-semibold text-center transition ${
            intent === 'owner' ? 'border-[var(--teal-1)] bg-[#EFF7F3] text-[var(--teal-1)]' : 'border-gray-200'
          }`}
        >
          🏪<br />I own a Shop
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        This is one account either way — you can set up a shop later from a customer account too.
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <Input label="Full Name" required value={fullName} onChange={e => setFullName(e.target.value)} />
      <Input label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
      <Input label="Phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} />
      <PasswordInput label="Password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />

      <Button block disabled={loading}>
        {loading ? 'Creating account…' : intent === 'owner' ? 'Create Account & Set Up My Shop' : 'Create Customer Account'}
      </Button>

      <p className="text-center text-sm text-gray-500 mt-5">
        Already have an account?{' '}
        <Link href={loginHref} className="text-[var(--teal-1)] font-semibold">
          Log in
        </Link>
      </p>
    </form>
  )
}
