// DESTINATION: src/components/payment/UpiPayCard.tsx  (new file)
'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Check, CircleCheck, Copy, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { buildUpiLink, upiTxnRefError } from '@/lib/payment'

type Props = {
  orderId: string
  shopName: string
  upiId: string | null          // the shop's UPI ID (may be empty if they only uploaded a QR)
  qrUrl: string | null          // the shop's own uploaded QR picture
  amount: number
  submittedRef: string | null   // transaction ID already sent for this order, if any
}

// "Pay the shop directly by UPI" — free, no gateway. The customer pays from their own
// UPI app, then types the transaction ID so the shop can match it to their bank/UPI app.
export function UpiPayCard({ orderId, shopName, upiId, qrUrl, amount, submittedRef }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const [ref, setRef] = useState('')
  const [sentRef, setSentRef] = useState<string | null>(submittedRef)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const link = upiId ? buildUpiLink({ upiId, name: shopName, amount, note: `GKP order ${orderId.slice(0, 8)}` }) : ''

  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(link, { width: 260, margin: 2 }).then(setQr).catch(() => setQr(''))
  }, [link])

  async function copyId() {
    if (!upiId) return
    try {
      await navigator.clipboard.writeText(upiId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* the ID is visible on screen anyway */ }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const problem = upiTxnRefError(ref)
    if (problem) return setError(problem)
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('submit_upi_payment', { p_order_id: orderId, p_txn_ref: ref.trim() })
    setBusy(false)
    if (rpcError) return setError(rpcError.message)
    setSentRef(ref.trim())
    setEditing(false)
    setRef('')
    router.refresh()
  }

  return (
    <div className="card border-[1.5px] !border-brand p-5">
      <p className="text-lg font-bold text-heading">Pay ₹{amount.toFixed(2)} by UPI</p>
      <p className="mt-1 text-sm text-muted">
        Free — the money goes straight to {shopName}&apos;s bank account. Pay the exact amount, then send the shop your transaction ID.
      </p>

      <div className="my-4 flex flex-wrap items-start gap-6">
        {qr && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="UPI QR code with the amount filled in" className="h-44 w-44 rounded-xl border border-line bg-white p-1" />
            <p className="mt-1 text-xs text-muted">Scan with any UPI app<br />(₹{amount.toFixed(2)} filled in)</p>
          </div>
        )}
        {qrUrl && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="The shop's own UPI QR code" className="h-44 w-44 rounded-xl border border-line bg-white object-contain p-1" />
            <p className="mt-1 text-xs text-muted">{shopName}&apos;s own QR<br />(type ₹{amount.toFixed(2)} yourself)</p>
          </div>
        )}
        {upiId && (
          <div className="flex min-w-[200px] flex-col gap-2">
            <p className="text-sm text-muted">UPI ID</p>
            <p className="break-all text-lg font-bold">{upiId}</p>
            <Button type="button" variant="outline" size="sm" onClick={copyId}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy UPI ID</>}
            </Button>
            <a href={link} className="no-underline">
              <Button type="button" variant="ghost" size="sm" className="w-full"><Smartphone size={14} /> Open my UPI app</Button>
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-line pt-4">
        {sentRef && !editing ? (
          <div className="flex items-start gap-3 rounded-xl bg-ok-bg p-3 text-sm text-ok">
            <CircleCheck size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Transaction ID sent: {sentRef}</p>
              <p>The shop will check it in their UPI app and confirm your payment.</p>
              <button type="button" onClick={() => setEditing(true)} className="mt-1 cursor-pointer font-semibold underline">
                Wrong ID? Send a different one
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="mb-1.5 block text-sm font-semibold">After paying, enter the UPI transaction ID</label>
            <p className="mb-2 text-xs text-muted">
              You&apos;ll find it in your UPI app under the payment details — it is called &ldquo;UPI transaction ID&rdquo;, &ldquo;UTR&rdquo; or &ldquo;reference number&rdquo; (usually 12 digits).
            </p>
            <div className="flex flex-wrap gap-2">
              <input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. 412345678901" className="field flex-1" inputMode="text" autoComplete="off" />
              <Button disabled={busy}>{busy ? 'Sending…' : 'I have paid — send to shop'}</Button>
              {editing && <Button type="button" variant="outline" onClick={() => { setEditing(false); setError('') }}>Cancel</Button>}
            </div>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
