// DESTINATION: src/lib/payment.ts  (replaces the existing file)

// 'on_receipt' = pay cash (or UPI) when the order arrives / is collected
// 'online'     = paid in the app through Razorpay
// 'upi'        = paid straight to the shop's own UPI ID / QR (free); customer enters the transaction ID
export type PaymentMethod = 'on_receipt' | 'online' | 'upi'

const UPI_RE = /^[a-zA-Z0-9._-]{2,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$/

export function normalizeUpiId(v: string): string {
  return v.trim().toLowerCase()
}

export function upiIdError(v: string): string | null {
  if (!v.trim()) return null
  return UPI_RE.test(v.trim()) ? null : 'Enter a valid UPI ID, like shopname@okhdfcbank or 9876543210@paytm.'
}

export function buildUpiLink(args: { upiId: string; name: string; amount: number; note: string }): string {
  const enc = encodeURIComponent
  return `upi://pay?pa=${args.upiId}&pn=${enc(args.name)}&am=${args.amount.toFixed(2)}&cu=INR&tn=${enc(args.note)}`
}

// Transaction IDs (UTR) from UPI apps are letters/numbers, usually 12 digits.
export function upiTxnRefError(v: string): string | null {
  return /^[A-Za-z0-9]{8,30}$/.test(v.trim())
    ? null
    : 'Enter the transaction ID from your UPI app (8 to 30 letters or numbers, no spaces).'
}

export function methodLabel(method: string | null | undefined, fulfillment: string): string {
  if (method === 'online') return 'Paid online'
  if (method === 'upi') return 'UPI to shop'
  return fulfillment === 'delivery' ? 'Pay on delivery' : 'Pay at shop'
}

export function paymentStatusLabel(status: string): { text: string; color: string; bg: string } {
  switch (status) {
    case 'paid': return { text: 'Paid', color: '#1E8E5A', bg: '#E6F5EC' }
    case 'refunded': return { text: 'Refunded', color: '#888', bg: '#F2F2F2' }
    case 'failed': return { text: 'Payment failed', color: '#D14343', bg: '#FBE6DD' }
    default: return { text: 'Payment pending', color: '#B8860B', bg: '#FDF3D7' }
  }
}
