// DESTINATION: src/app/api/razorpay/webhook/route.ts  (new folder: api/razorpay/webhook/)
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { webhookSignatureOk } from '@/lib/razorpay'

// Razorpay calls this by itself when a payment is captured — so an order is
// still marked paid if the customer closed the tab right after paying.
// Setup: Razorpay Dashboard -> Settings -> Webhooks -> Add:
//   URL    https://YOUR-DOMAIN/api/razorpay/webhook   (on localhost use a tunnel such as ngrok)
//   Event  payment.captured
//   Secret any long random text; put the same text in RAZORPAY_WEBHOOK_SECRET
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return new NextResponse('Webhook not configured', { status: 500 })

  const raw = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''
  if (!signature || !webhookSignatureOk(raw, signature, secret)) {
    return new NextResponse('Bad signature', { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    return new NextResponse('Bad body', { status: 400 })
  }

  if (event?.event !== 'payment.captured') return NextResponse.json({ ok: true, ignored: true })

  const pay = event?.payload?.payment?.entity
  if (!pay?.id || !pay?.order_id || typeof pay.amount !== 'number') return NextResponse.json({ ok: true, ignored: true })

  const admin = createAdminClient()
  const { data: order, error: findError } = await admin
    .from('orders')
    .select('id')
    .eq('razorpay_order_id', pay.order_id)
    .maybeSingle()
  if (findError) return new NextResponse('Database error', { status: 500 }) // Razorpay will retry
  if (!order) return NextResponse.json({ ok: true, ignored: true })

  const { error } = await admin.rpc('mark_order_paid', {
    p_order_id: order.id,
    p_razorpay_order_id: pay.order_id,
    p_payment_id: pay.id,
    p_amount_paise: pay.amount,
  })
  if (error) {
    // e.g. amount mismatch or already refunded: retrying will not help, so log and acknowledge.
    console.error('mark_order_paid failed for order', order.id, error.message)
  }
  return NextResponse.json({ ok: true })
}
