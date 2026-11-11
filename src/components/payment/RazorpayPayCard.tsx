// DESTINATION: src/components/payment/RazorpayPayCard.tsx  (replaces the existing file)
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleCheck, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'

declare global {
  interface Window { Razorpay: any }
}

type Props = { orderId: string; shopName: string; amount: number }

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export function RazorpayPayCard({ orderId, shopName, amount }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function pay() {
    setError('')
    setBusy(true)

    const ok = await loadRazorpayScript()
    if (!ok) {
      setBusy(false)
      return setError('Could not load the payment window. Check your internet and try again.')
    }

    const res = await fetch('/api/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.razorpayOrderId) {
      setBusy(false)
      router.refresh()
      return setError(data?.error ?? 'Could not start the payment.')
    }

    const rzp = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.razorpayOrderId,
      name: 'GharKePaas',
      description: `Order from ${shopName}`,
      theme: { color: '#0B4438' },
      handler: async (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        const v = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, ...resp }),
        })
        const vd = await v.json().catch(() => null)
        setBusy(false)
        if (!v.ok) {
          router.refresh()
          return setError(vd?.error ?? 'Payment could not be verified.')
        }
        if (vd?.result === 'paid_after_cancel') {
          router.refresh()
          return setError('Your payment arrived after this order was cancelled. The amount will be refunded to you.')
        }
        setDone(true)
        router.refresh()
      },
      modal: { ondismiss: () => setBusy(false) },
    })
    rzp.on('payment.failed', () => {
      setBusy(false)
      setError('The payment failed. You can try again.')
    })
    rzp.open()
  }

  if (done) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border-[1.5px] border-ok bg-ok-bg p-4">
        <CircleCheck size={24} className="text-ok" />
        <p className="font-bold text-ok">Payment of ₹{amount.toFixed(2)} received</p>
      </div>
    )
  }

  return (
    <div className="card mt-4 border-[1.5px] !border-brand p-5">
      <p className="text-lg font-bold text-heading">Pay ₹{amount.toFixed(2)} online</p>
      <p className="my-2 text-sm text-muted">
        UPI, cards or net banking — confirmed automatically. The shop sees your order only once it is paid, and an
        unpaid order is cancelled by itself after 20 minutes.
      </p>
      <Button type="button" onClick={pay} disabled={busy}>
        <CreditCard size={16} /> {busy ? 'Please wait…' : 'Pay now'}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
