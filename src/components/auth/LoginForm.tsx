'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'

export function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'
  const registerHref = next !== '/' ? `/register?next=${encodeURIComponent(next)}` : '/register'

  const [mode, setMode] = useState<'password' | 'otp'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    router.push(next)
    router.refresh()
  }

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    // shouldCreateUser: false — a login screen should only ever log
    // someone in. Without this, an unknown email would silently create
    // a blank account here (no name/phone captured), which is worse
    // than telling them plainly to sign up first.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      setError('No account found with this email. Please create an account first.')
      return
    }
    setOtpSent(true)
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' })
    setLoading(false)
    if (error) return setError(error.message)
    router.push(next)
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2 bg-gray-100 p-1 rounded-full mb-5">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
            mode === 'password' ? 'bg-white shadow text-[var(--teal-1)]' : 'text-gray-500'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode('otp')}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
            mode === 'otp' ? 'bg-white shadow text-[var(--teal-1)]' : 'text-gray-500'
          }`}
        >
          Email OTP
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {mode === 'password' && (
        <form onSubmit={handlePasswordLogin}>
          <Input label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <PasswordInput label="Password" required value={password} onChange={e => setPassword(e.target.value)} />
          <Button block disabled={loading}>{loading ? 'Logging in…' : 'Log In'}</Button>
        </form>
      )}

      {mode === 'otp' && !otpSent && (
        <form onSubmit={handleSendOtp}>
          <Input label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <Button block disabled={loading}>{loading ? 'Sending…' : 'Send Code'}</Button>
        </form>
      )}

      {mode === 'otp' && otpSent && (
        <form onSubmit={handleVerifyOtp}>
          <p className="text-sm text-gray-500 mb-3">Enter the 6-digit code sent to <strong>{email}</strong>.</p>
          <Input label="6-digit code" required maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value)} />
          <Button block disabled={loading}>{loading ? 'Verifying…' : 'Verify & Log In'}</Button>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 mt-5">
        Don&apos;t have an account?{' '}
        <Link href={registerHref} className="text-[var(--teal-1)] font-semibold">
          Create one
        </Link>
      </p>
    </div>
  )
}
