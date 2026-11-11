// DESTINATION: src/app/orders/page.tsx  (replaces the existing file)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ReceiptText, Store, Truck } from 'lucide-react'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { buttonClass } from '@/components/ui/Button'
import { CUSTOMER_STATUS_LABELS, statusStyle } from '@/lib/orderStatus'

export default async function MyOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orders } = await supabase
    .from('orders')
    .select('*, shops(shop_name)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <SectionTitle icon={<ReceiptText size={28} />} count={orders?.length ?? 0}>My Orders</SectionTitle>

      {(!orders || orders.length === 0) && (
        <div className="card p-10 text-center">
          <p className="mb-4 text-muted">You haven&apos;t placed any orders yet.</p>
          <Link href="/search" className={buttonClass()}>Browse shops</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders?.map(order => (
          <Link key={order.id} href={`/orders/${order.id}`} className="card card-link group flex flex-col gap-3 p-5 no-underline">
            <div className="flex items-start justify-between gap-2">
              <strong className="text-base leading-snug">{(order.shops as { shop_name: string } | null)?.shop_name ?? 'Shop'}</strong>
              <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold" style={statusStyle(order.status)}>
                {CUSTOMER_STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted">
              {order.fulfillment_type === 'delivery' ? <Truck size={16} /> : <Store size={16} />}
              {order.fulfillment_type === 'delivery' ? 'Delivery' : 'Pickup'}
            </div>

            {(order.status === 'rejected' || order.status === 'cancelled') && order.shop_note && (
              <p className="text-sm font-semibold text-danger">Reason: {order.shop_note}</p>
            )}

            <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
              <div>
                <p className="font-display text-xl font-bold text-heading">₹{order.total_amount}</p>
                <p className="text-xs text-muted">
                  {new Date(order.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              <ChevronRight size={20} className="text-brand-2 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
