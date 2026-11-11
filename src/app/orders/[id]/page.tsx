// DESTINATION: src/app/orders/[id]/page.tsx  (replaces the existing file)
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, MapPin, Store, Truck } from 'lucide-react'
import { ReviewForm } from '@/components/shop/ReviewForm'
import { RealtimeRefresher } from '@/components/realtime/RealtimeRefresher'
import { RazorpayPayCard } from '@/components/payment/RazorpayPayCard'
import { UpiInfoCard } from '@/components/payment/UpiInfoCard'
import { UpiPayCard } from '@/components/payment/UpiPayCard'
import { BUCKETS, publicUrl } from '@/lib/storage'
import { methodLabel, paymentStatusLabel } from '@/lib/payment'
import { CUSTOMER_STATUS_LABELS, DEAD_STATUSES, statusStyle } from '@/lib/orderStatus'

const HEADINGS: Record<string, string> = {
  rejected: 'Order Rejected',
  cancelled: 'Order Cancelled',
  expired: 'Order Expired',
  completed: 'Order Completed',
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: order } = await supabase
    .from('orders')
    .select('*, shops(shop_name, upi_id, upi_qr_url)')
    .eq('id', id)
    .maybeSingle()

  if (!order) notFound()

  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id)

  let hasReviewed = false
  if (order.status === 'completed') {
    const { data: existingReview } = await supabase
      .from('reviews').select('id').eq('reviewer_id', user.id).eq('shop_id', order.shop_id).maybeSingle()
    hasReviewed = !!existingReview
  }

  const shop = order.shops as { shop_name: string; upi_id: string | null; upi_qr_url: string | null } | null
  const payBadge = paymentStatusLabel(order.payment_status)
  const isDead = DEAD_STATUSES.includes(order.status)
  const isOnline = order.payment_method === 'online'
  const isUpi = order.payment_method === 'upi'
  const shopHasUpi = !!(shop?.upi_id || shop?.upi_qr_url)
  const qrPublic = publicUrl(BUCKETS.shopPhotos, shop?.upi_qr_url)

  const needsOnlinePayment = isOnline && order.payment_status === 'pending' && order.status === 'placed'
  const needsUpiPayment = isUpi && order.payment_status === 'pending' && !isDead && order.status !== 'completed' && shopHasUpi
  const showUpiInfo = !isOnline && !isUpi && order.payment_status === 'pending' && !isDead && shopHasUpi
  const refundDue = isOnline && order.payment_status === 'paid' && isDead

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <RealtimeRefresher channelName={`order-${order.id}`} table="orders" filter={`id=eq.${order.id}`} />

      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-heading no-underline hover:underline">
        <ArrowLeft size={16} /> All orders
      </Link>

      <div className={`grid items-start gap-6 ${needsOnlinePayment || needsUpiPayment || showUpiInfo ? 'lg:grid-cols-2' : 'max-w-2xl'}`}>
        {/* Order details */}
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-extrabold">{HEADINGS[order.status] ?? 'Order Placed'}</h1>
              <p className="mt-1 text-muted">From <strong className="text-ink">{shop?.shop_name}</strong></p>
              <p className="text-xs text-muted">
                {new Date(order.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={statusStyle(order.status)}>
              {CUSTOMER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>

          <div className="mt-4 space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              {order.fulfillment_type === 'delivery' ? <Truck size={16} /> : <Store size={16} />}
              <strong>{order.fulfillment_type === 'delivery' ? 'Home delivery' : 'Self pickup'}</strong>
            </p>
            {order.fulfillment_type === 'delivery' && (
              <p className="flex items-start gap-2 text-muted"><MapPin size={16} className="mt-0.5 shrink-0" /> <span className="break-words">{order.delivery_address_text}</span></p>
            )}
            {order.fulfillment_type === 'pickup' && order.status === 'ready_for_pickup' && order.reservation_expires_at && (
              <p className="flex items-center gap-2 font-semibold text-warn">
                <Clock size={16} /> Pickup reserved until {new Date(order.reservation_expires_at).toLocaleTimeString()}
              </p>
            )}
          </div>

          {(order.status === 'rejected' || order.status === 'cancelled') && order.shop_note && (
            <p className="mt-3 font-semibold text-danger">Reason: {order.shop_note}</p>
          )}
          {order.status === 'expired' && (
            <p className="mt-3 text-sm text-muted">
              This wasn&apos;t collected within the 15-minute pickup window, so the items were automatically released back to stock.
            </p>
          )}

          <h2 className="mb-2 mt-6 text-lg font-bold">Items</h2>
          <div className="border-y border-dashed border-line py-2">
            {items?.map(item => (
              <div key={item.id} className="flex justify-between gap-3 py-1 text-sm">
                <span className="break-words">{item.product_name} <span className="text-muted">× {item.quantity}</span></span>
                <span className="shrink-0">₹{(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex justify-between text-lg font-extrabold"><span>Total</span><span>₹{order.total_amount}</span></p>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-mint p-3 text-sm">
            <span>Payment: <strong>{methodLabel(order.payment_method, order.fulfillment_type)}</strong></span>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: payBadge.bg, color: payBadge.color }}>{payBadge.text}</span>
          </div>

          {!isOnline && !isUpi && order.payment_status === 'pending' && !isDead && (
            <p className="mt-2 text-sm text-muted">
              Please keep ₹{order.total_amount} ready — {order.fulfillment_type === 'delivery' ? 'pay when it arrives.' : 'pay at the shop when you collect.'}
            </p>
          )}
          {isUpi && order.payment_status === 'paid' && (
            <p className="mt-2 text-sm text-ok">The shop confirmed your UPI payment{order.upi_txn_ref ? ` (transaction ID ${order.upi_txn_ref})` : ''}.</p>
          )}
          {isUpi && isDead && order.payment_status === 'paid' && (
            <p className="mt-2 text-sm font-semibold text-warn">
              This order won&apos;t be fulfilled. Please contact the shop to get your UPI payment returned.
            </p>
          )}
          {isUpi && isDead && order.payment_status === 'pending' && (
            <p className="mt-2 text-sm text-muted">This order was closed before payment was confirmed. If you did pay, contact the shop with your transaction ID.</p>
          )}
          {isOnline && order.payment_status === 'pending' && isDead && (
            <p className="mt-2 text-sm text-muted">This order was cancelled before it was paid, so nothing was charged.</p>
          )}
          {refundDue && (
            <p className="mt-2 text-sm font-semibold text-warn">This order won&apos;t be fulfilled. Your payment will be refunded to the account you paid from.</p>
          )}
          {order.payment_status === 'refunded' && (
            <p className="mt-2 text-sm text-muted">
              Your payment was refunded{order.refunded_at ? ` on ${new Date(order.refunded_at).toLocaleDateString()}` : ''}. Banks can take a few days to show it.
            </p>
          )}
        </div>

        {/* Payment cards */}
        {(needsOnlinePayment || needsUpiPayment || showUpiInfo) && (
          <div>
            {needsOnlinePayment && (
              <RazorpayPayCard orderId={order.id} shopName={shop?.shop_name ?? 'the shop'} amount={Number(order.total_amount)} />
            )}
            {needsUpiPayment && (
              <UpiPayCard
                orderId={order.id}
                shopName={shop!.shop_name}
                upiId={shop!.upi_id}
                qrUrl={qrPublic}
                amount={Number(order.total_amount)}
                submittedRef={order.upi_txn_ref ?? null}
              />
            )}
            {showUpiInfo && (
              <UpiInfoCard orderId={order.id} shopName={shop!.shop_name} upiId={shop!.upi_id} amount={Number(order.total_amount)} qrUrl={qrPublic} />
            )}
          </div>
        )}
      </div>

      {order.status === 'completed' && !hasReviewed && <div className="max-w-2xl"><ReviewForm shopId={order.shop_id} /></div>}
      {order.status === 'completed' && hasReviewed && (
        <p className="mt-6 text-sm text-muted">You&apos;ve already reviewed this shop for this order. Thanks!</p>
      )}
    </div>
  )
}
