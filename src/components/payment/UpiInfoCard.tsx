// DESTINATION: src/components/payment/UpiInfoCard.tsx  (replaces the existing file)
'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { buildUpiLink } from '@/lib/payment'

type Props = {
  orderId: string
  shopName: string
  upiId: string | null        // may be empty if the shop only uploaded a QR picture
  amount: number
  qrUrl?: string | null       // the shop owner's own uploaded QR picture
}

// For "pay on delivery / at shop" orders: lets the customer pay the shop by UPI
// instead of cash. Nothing is recorded here — the order is marked paid when the shop completes it.
export function UpiInfoCard({ orderId, shopName, upiId, amount, qrUrl }: Props) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const link = upiId ? buildUpiLink({ upiId, name: shopName, amount, note: `GKP order ${orderId.slice(0, 8)}` }) : ''

  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(link, { width: 240, margin: 2 }).then(setQr).catch(() => setQr(''))
  }, [link])

  async function copyId() {
    if (!upiId) return
    try {
      await navigator.clipboard.writeText(upiId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* the ID is visible on screen anyway */
    }
  }

  return (
    <div className="card mt-4 p-5">
      <p className="text-lg font-bold text-heading">Prefer UPI to cash?</p>
      <p className="mt-1 text-sm text-muted">
        You can pay {shopName} directly by UPI when the order arrives — no fee, nothing to confirm here.
      </p>

      <div className="my-4 flex flex-wrap items-start gap-6">
        {/* QR made for this exact amount */}
        {qr && (
          <div className="text-center">
            {/* White frame so the QR stays scannable in dark mode */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="UPI QR code" className="h-40 w-40 rounded-xl border border-line bg-white p-1" />
            <p className="mt-1 text-xs text-muted">Scan with any UPI app<br />(₹{amount.toFixed(2)} filled in)</p>
          </div>
        )}

        {/* The shop's own uploaded QR — always visible, not hidden */}
        {qrUrl && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="The shop's own UPI QR code" className="h-40 w-40 rounded-xl border border-line bg-white object-contain p-1" />
            <p className="mt-1 text-xs text-muted">{shopName}&apos;s own QR<br />(type ₹{amount.toFixed(2)} in your app)</p>
          </div>
        )}

        {upiId && (
          <div className="flex flex-col gap-2">
            <a href={link} className="no-underline">
              <Button type="button" variant="ghost"><Smartphone size={16} /> Open my UPI app</Button>
            </a>
            <Button type="button" variant="outline" onClick={copyId}>
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy UPI ID</>}
            </Button>
            <p className="text-xs text-muted">UPI ID: <strong className="text-ink">{upiId}</strong></p>
          </div>
        )}
      </div>
    </div>
  )
}
