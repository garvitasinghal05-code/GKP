// DESTINATION: src/lib/razorpay.ts  (new file, SERVER ONLY — import it only from route handlers and server actions)
import crypto from 'crypto'

export function razorpayKeys(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  return keyId && keySecret ? { keyId, keySecret } : null
}

// Small wrapper around Razorpay's REST API (no SDK needed).
export async function rzp(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const keys = razorpayKeys()
  if (!keys) return { ok: false, status: 500, data: { error: { description: 'Razorpay keys are not set.' } } }
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString('base64'),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// What the browser hands back after a successful payment.
export function checkoutSignatureOk(rzpOrderId: string, paymentId: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(`${rzpOrderId}|${paymentId}`).digest('hex')
  return safeEqual(expected, signature)
}

// What Razorpay's server sends to our webhook (signed over the raw body).
export function webhookSignatureOk(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqual(expected, signature)
}
