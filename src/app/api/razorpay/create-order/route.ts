// DESTINATION: src/app/api/razorpay/create-order/route.ts  (new folders: api/razorpay/create-order/)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { razorpayKeys, rzp } from '@/lib/razorpay'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

// Opens (or re-opens) the Razorpay payment for one of THIS customer's orders.
// The amount comes from our database, never from the browser.
export async function POST(request: Request) {
  const keys = razorpayKeys()
  if (!keys) return fail('Online payments are not set up yet.', 500)

  const body = await request.json().catch(() => null)
  const orderId = body?.orderId as string | undefined
  if (!orderId || !UUID.test(orderId)) return fail('Invalid order.', 400)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('Please log in again.', 401)

  const { data: order } = await supabase
    .from('orders')
    .select('id, total_amount, status, payment_method, payment_status, razorpay_order_id')
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .maybeSingle()

  if (!order) return fail('Order not found.', 404)
  if (order.payment_method !== 'online') return fail('This order is not an online-payment order.', 400)
  if (order.payment_status !== 'pending' || order.status !== 'placed') {
    return fail('This order is no longer waiting for payment.', 400)
  }

  const amount = Math.round(Number(order.total_amount) * 100) // paise

  // Already opened before (e.g. the customer closed the window)? Reuse it.
  if (order.razorpay_order_id) {
    return NextResponse.json(
      { keyId: keys.keyId, razorpayOrderId: order.razorpay_order_id, amount, currency: 'INR' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const created = await rzp('/orders', {
    method: 'POST',
    body: { amount, currency: 'INR', receipt: order.id.slice(0, 40), notes: { order_id: order.id } },
  })
  if (!created.ok || !created.data?.id) return fail('Could not start the payment. Please try again.', 502)

  const admin = createAdminClient()
  const { error } = await admin.rpc('attach_gateway_order', {
    p_order_id: order.id,
    p_razorpay_order_id: created.data.id,
  })
  if (error) return fail('Could not start the payment. Please try again.', 409)

  return NextResponse.json(
    { keyId: keys.keyId, razorpayOrderId: created.data.id, amount, currency: 'INR' },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
