// DESTINATION: src/app/dashboard/shop-owner/orders/page.tsx  (replaces the existing file)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCheck, Clock, CreditCard, Hourglass, MapPin, Phone, QrCode, Store, Truck, Wallet, CircleX, Ban } from 'lucide-react'
import { updateOrderStatus, confirmUpiPayment } from './actions'
import { Button } from '@/components/ui/Button'
import { RealtimeRefresher } from '@/components/realtime/RealtimeRefresher'
import { methodLabel, paymentStatusLabel } from '@/lib/payment'
import { CLOSED_STATUSES, DEAD_STATUSES, SHOP_STATUS_LABELS, statusStyle } from '@/lib/orderStatus'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

type OrderItem = { product_name: string; quantity: number; unit_price: number }
type Customer = { full_name: string; phone: string } | null

type PayOrder = {
  id: string
  status: string
  fulfillment_type: string
  total_amount: number
  payment_method: string | null
  payment_status: string
  payment_ref: string | null
  upi_txn_ref: string | null
  upi_submitted_at: string | null
}

function PaymentBlock({ order }: { order: PayOrder }) {
  const badge = paymentStatusLabel(order.payment_status)
  const isOnline = order.payment_method === 'online'
  const dead = DEAD_STATUSES.includes(order.status)

  return (
    <div className="rounded-xl bg-mint p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {isOnline ? <CreditCard size={16} /> : order.payment_method === 'upi' ? <QrCode size={16} /> : <Wallet size={16} />}
          {methodLabel(order.payment_method, order.fulfillment_type)}
        </span>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: badge.bg, color: badge.color }}>
          {badge.text}
        </span>
      </div>
      {!isOnline && order.payment_status === 'pending' && !dead && (
        <p className="mt-1.5 text-sm text-muted">Collect ₹{order.total_amount} (cash or UPI). It is marked paid automatically when you complete the order.</p>
      )}
      {isOnline && order.payment_status === 'pending' && !dead && (
        <p className="mt-1.5 text-sm font-semibold text-warn">Waiting for the customer to pay online. You can accept the order once it turns Paid (unpaid orders cancel themselves after 20 minutes).</p>
      )}
      {isOnline && order.payment_status === 'paid' && !dead && (
        <p className="mt-1.5 text-sm text-ok">Already paid online — the customer owes you nothing at the door.</p>
      )}
      {isOnline && order.payment_status === 'paid' && dead && (
        <p className="mt-1.5 text-sm text-warn">Customer paid online but this order was not fulfilled — the admin will refund them.</p>
      )}

      {/* Direct UPI (free): customer pays your UPI ID, then sends you the transaction ID */}
      {order.payment_method === 'upi' && order.payment_status === 'pending' && !dead && (
        <div className="mt-2">
          {order.upi_txn_ref ? (
            <p className="text-sm">
              Customer says they paid ₹{order.total_amount} by UPI. Transaction ID:{' '}
              <strong className="break-all">{order.upi_txn_ref}</strong>. Open your UPI app, find this ID and amount, then confirm.
            </p>
          ) : (
            <p className="text-sm text-warn">Waiting for the customer to pay by UPI and send you the transaction ID.</p>
          )}
          <form action={confirmUpiPayment} className="mt-2">
            <input type="hidden" name="orderId" value={order.id} />
            <Button size="sm" variant="ghost"><CheckCheck size={14} /> Payment received</Button>
          </form>
        </div>
      )}
      {order.payment_method === 'upi' && order.payment_status === 'paid' && !dead && (
        <p className="mt-1.5 text-sm text-ok">UPI payment confirmed{order.upi_txn_ref ? ` (ID ${order.upi_txn_ref})` : ''}.</p>
      )}
      {order.payment_method === 'upi' && dead && order.payment_status === 'paid' && (
        <p className="mt-1.5 text-sm text-warn">This order was not fulfilled — please return the customer&apos;s UPI payment yourself.</p>
      )}
    </div>
  )
}

function OrderCard({ order, items, past }: { order: any; items: OrderItem[]; past: boolean }) {
  const customer = order.profiles as Customer
  const st = statusStyle(order.status)

  return (
    <article className="card flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">Order #{order.id.slice(0, 8)}</p>
          <p className="text-sm text-muted">{formatDateTime(order.created_at)}</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-bold" style={st}>{SHOP_STATUS_LABELS[order.status] ?? order.status}</span>
      </div>

      {/* Customer */}
      <div className="space-y-1.5 text-sm">
        <p className="font-semibold">{customer?.full_name ?? 'Customer'}</p>
        <p className="flex items-center gap-2 text-muted"><Phone size={15} className="shrink-0" /> {customer?.phone ?? '—'}</p>
        <p className="flex items-center gap-2 text-muted">
          {order.fulfillment_type === 'delivery' ? <Truck size={15} className="shrink-0" /> : <Store size={15} className="shrink-0" />}
          {order.fulfillment_type === 'delivery' ? 'Home delivery' : 'Self pickup'}
        </p>
        {order.fulfillment_type === 'delivery' && order.delivery_address_text && (
          <p className="flex items-start gap-2 text-muted"><MapPin size={15} className="mt-0.5 shrink-0" /> <span className="break-words">{order.delivery_address_text}</span></p>
        )}
      </div>

      {/* Bill */}
      <div className="rounded-xl border border-dashed border-line p-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-3 py-1 text-sm">
            <span className="min-w-0 break-words">{item.product_name} <span className="text-muted">× {item.quantity}</span></span>
            <span className="shrink-0 font-medium">₹{(item.unit_price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-base font-bold">
          <span>Total</span>
          <span>₹{order.total_amount}</span>
        </div>
      </div>

      {order.status === 'ready_for_pickup' && order.reservation_expires_at && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-warn">
          <Clock size={15} /> Reserved until {new Date(order.reservation_expires_at).toLocaleTimeString()}
        </p>
      )}
      {past && (order.status === 'rejected' || order.status === 'cancelled') && order.shop_note && (
        <p className="text-sm font-semibold text-danger">Reason: {order.shop_note}</p>
      )}
      {past && order.status === 'expired' && (
        <p className="text-sm text-muted">Not collected within the 15-minute pickup window — stock was returned automatically.</p>
      )}

      <PaymentBlock order={order as PayOrder} />

      {/* Actions (active orders only) */}
      {!past && (
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {order.status === 'placed' && (
            <>
              {order.payment_method === 'online' && order.payment_status !== 'paid' ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-warn"><Hourglass size={15} /> Waiting for payment</p>
              ) : (
                <form action={updateOrderStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="newStatus" value="confirmed" />
                  <Button>Accept</Button>
                </form>
              )}
              <form action={updateOrderStatus} className="flex flex-wrap gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="newStatus" value="rejected" />
                <input name="note" placeholder="Reason" required className="field !w-40 !py-1.5 !text-sm" />
                <Button variant="danger">Reject</Button>
              </form>
            </>
          )}
          {order.status === 'confirmed' && order.fulfillment_type === 'delivery' && (
            <form action={updateOrderStatus}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="newStatus" value="out_for_delivery" />
              <Button><Truck size={16} /> Mark Out for Delivery</Button>
            </form>
          )}
          {order.status === 'confirmed' && order.fulfillment_type === 'pickup' && (
            <form action={updateOrderStatus}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="newStatus" value="ready_for_pickup" />
              <Button><Store size={16} /> Mark Ready for Pickup</Button>
            </form>
          )}
          {(order.status === 'out_for_delivery' || order.status === 'ready_for_pickup') && (
            <form action={updateOrderStatus}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="newStatus" value="completed" />
              <Button><CheckCheck size={16} /> Mark Completed</Button>
            </form>
          )}
        </div>
      )}
    </article>
  )
}

const FILTERS = ['all', 'completed', 'rejected', 'expired', 'cancelled'] as const

export default async function ShopOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>
}) {
  const { tab, filter } = await searchParams
  const showPast = tab === 'past'
  const activeFilter = (FILTERS as readonly string[]).includes(filter ?? '') ? (filter as string) : 'all'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shop } = await supabase.from('shops').select('id, shop_name').eq('owner_id', user.id).maybeSingle()
  if (!shop) redirect('/dashboard/shop-owner/onboarding')

  const { data: orders } = await supabase
    .from('orders')
    .select('*, profiles(full_name, phone)')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  const all = orders ?? []
  const active = all.filter(o => !CLOSED_STATUSES.includes(o.status))
  const past = all.filter(o => CLOSED_STATUSES.includes(o.status))
  const countOf = (s: string) => past.filter(o => o.status === s).length

  const pastShown = activeFilter === 'all' ? past : past.filter(o => o.status === activeFilter)
  const list = showPast ? pastShown : active

  const orderIds = list.map(o => o.id)
  const { data: allItems } =
    orderIds.length > 0
      ? await supabase.from('order_items').select('*').in('order_id', orderIds)
      : { data: [] as (OrderItem & { order_id: string })[] }

  const itemsByOrder: Record<string, OrderItem[]> = {}
  allItems?.forEach(item => {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
    itemsByOrder[item.order_id].push(item)
  })

  const tabCls = (on: boolean) =>
    `flex-1 rounded-full px-5 py-2.5 text-center text-sm font-bold no-underline transition-colors sm:flex-none ${
      on ? 'bg-brand text-white' : 'text-muted hover:text-ink'
    }`

  const stats = [
    { key: 'completed', label: 'Completed', icon: <CheckCheck size={22} />, color: 'var(--ok)', bg: 'var(--ok-bg)' },
    { key: 'rejected', label: 'Rejected', icon: <CircleX size={22} />, color: 'var(--danger)', bg: 'var(--danger-bg)' },
    { key: 'expired', label: 'Expired', icon: <Clock size={22} />, color: 'var(--muted)', bg: 'var(--mint)' },
    { key: 'cancelled', label: 'Cancelled', icon: <Ban size={22} />, color: 'var(--warn)', bg: 'var(--warn-bg)' },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <RealtimeRefresher channelName={`shop-orders-${shop.id}`} table="orders" filter={`shop_id=eq.${shop.id}`} />

      <h1 className="text-3xl font-extrabold">Orders</h1>
      <p className="mb-5 text-muted">{shop.shop_name}</p>

      {/* Tab switcher */}
      <div className="mb-6 flex w-full gap-1 rounded-full bg-mint p-1 sm:inline-flex sm:w-auto">
        <Link href="/dashboard/shop-owner/orders" className={tabCls(!showPast)}>Active Orders ({active.length})</Link>
        <Link href="/dashboard/shop-owner/orders?tab=past" className={tabCls(showPast)}>Past Orders ({past.length})</Link>
      </div>

      {showPast && (
        <>
          {/* Statistics */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(s => (
              <div key={s.key} className="card flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color: s.color, background: s.bg }}>{s.icon}</span>
                <div className="leading-tight">
                  <p className="font-display text-2xl font-extrabold">{countOf(s.key)}</p>
                  <p className="text-sm text-muted">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="mb-6 flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <Link
                key={f}
                href={`/dashboard/shop-owner/orders?tab=past${f === 'all' ? '' : `&filter=${f}`}`}
                className={`chip no-underline ${activeFilter === f ? 'is-active' : ''}`}
              >
                {f === 'all' ? `All (${past.length})` : `${f[0].toUpperCase() + f.slice(1)} (${countOf(f)})`}
              </Link>
            ))}
          </div>
        </>
      )}

      {list.length === 0 && (
        <div className="card p-8 text-center text-muted">
          {showPast ? 'No past orders match this filter.' : 'No active orders right now. New orders appear here by themselves.'}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map(order => (
          <OrderCard key={order.id} order={order} items={itemsByOrder[order.id] ?? []} past={showPast} />
        ))}
      </div>
    </div>
  )
}
