// DESTINATION: src/app/api/razorpay/verify/route.ts  (new folder: api/razorpay/verify/)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { razorpayKeys, rzp, checkoutSignatureOk } from '@/lib/razorpay'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

// Called by the browser right after Razorpay says "paid". We trust nothing it
// says: signature check + ask Razorpay directly + the database re-checks the amount.
export async function POST(request: Request) {
  const keys = razorpayKeys()
  if (!keys) return fail('Online payments are not set up yet.', 500)

  const body = await request.json().catch(() => null)
  const orderId = body?.orderId as string | undefined
  const paymentId = body?.razorpay_payment_id as string | undefined
  const rzpOrderId = body?.razorpay_order_id as string | undefined
  const signature = body?.razorpay_signature as string | undefined
  if (!orderId || !UUID.test(orderId) || !paymentId || !rzpOrderId || !signature) return fail('Invalid request.', 400)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('Please log in again.', 401)

  const { data: order } = await supabase
    .from('orders')
    .select('id, razorpay_order_id, payment_method')
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .maybeSingle()
  if (!order || order.payment_method !== 'online' || order.razorpay_order_id !== rzpOrderId) {
    return fail('This payment does not match the order.', 400)
  }

  if (!checkoutSignatureOk(rzpOrderId, paymentId, signature, keys.keySecret)) {
    return fail('Payment could not be verified.', 400)
  }

  const payment = await rzp(`/payments/${encodeURIComponent(paymentId)}`)
  if (!payment.ok || payment.data?.order_id !== rzpOrderId) return fail('Payment could not be verified.', 400)
  if (payment.data?.status !== 'captured') {
    // The webhook will finish the job as soon as the bank confirms.
    return fail('Your payment is still being confirmed. This page will update by itself in a moment.', 409)
  }

  const admin = createAdminClient()
  const { data: result, error } = await admin.rpc('mark_order_paid', {
    p_order_id: order.id,
    p_razorpay_order_id: rzpOrderId,
    p_payment_id: paymentId,
    p_amount_paise: payment.data.amount,
  })
  if (error) return fail('Payment received but could not be recorded. Please contact the shop.', 500)

  return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } })
}
