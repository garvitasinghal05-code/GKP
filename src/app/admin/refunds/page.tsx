// DESTINATION: src/app/admin/refunds/page.tsx  (new folder: admin/refunds/)
// line 59: <strong>₹{o.total_amount}</strong>
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { refundOrder } from './actions'
import { Button } from '@/components/ui/Button'

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>
}) {
  const { error, done } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  // Paid online, but the order ended up rejected / cancelled / expired.
  const { data: due } = await supabase
    .from('orders')
    .select('id, total_amount, status, shop_note, paid_at, shops(shop_name)')
    .eq('payment_method', 'online')
    .eq('payment_status', 'paid')
    .in('status', ['rejected', 'cancelled', 'expired'])
    .order('paid_at', { ascending: true })

  const { data: recent } = await supabase
    .from('orders')
    .select('id, total_amount, refund_ref, refunded_at, shops(shop_name)')
    .eq('payment_status', 'refunded')
    .order('refunded_at', { ascending: false })
    .limit(10)

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '.4rem' }}>Admin — Refunds</h2>
      <p style={{ fontSize: '.88rem', color: '#666', marginBottom: '1.2rem' }}>
        Customers who paid online for orders that will not be fulfilled. The button returns the full amount to them through Razorpay.
      </p>

      {error && <p style={{ color: '#C1440E', fontSize: '.9rem', marginBottom: '1rem' }}>{error}</p>}
      {done && <p style={{ color: '#1E8E5A', fontSize: '.9rem', marginBottom: '1rem' }}>{done}</p>}

      <h3 style={{ marginBottom: '.75rem' }}>Refund due ({due?.length ?? 0})</h3>
      {(!due || due.length === 0) && <p style={{ color: '#888', marginBottom: '1.5rem' }}>Nothing to refund.</p>}
      {due?.map(o => (
        <div key={o.id} style={{ border: '1px solid #e3e9e6', borderRadius: 12, padding: '1rem', marginBottom: '.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong>Order #{o.id.slice(0, 8)}</strong> · {(o.shops as unknown as { shop_name: string } | null)?.shop_name ?? 'Shop'}
              <p style={{ fontSize: '.82rem', color: '#666', marginTop: '.2rem' }}>
                {o.status}{o.shop_note ? ` — ${o.shop_note}` : ''} · paid {o.paid_at ? new Date(o.paid_at).toLocaleString() : ''}
              </p>
            </div>
            <form action={refundOrder} style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
              <input type="hidden" name="orderId" value={o.id} />
              
              <Button>Refund ₹{o.total_amount}</Button>
            </form>
          </div>
        </div>
      ))}

      <h3 style={{ margin: '2rem 0 .75rem' }}>Recently refunded</h3>
      {(!recent || recent.length === 0) && <p style={{ color: '#888' }}>None yet.</p>}
      {recent?.map(o => (
        <p key={o.id} style={{ fontSize: '.88rem', marginBottom: '.4rem' }}>
          ↩️ #{o.id.slice(0, 8)} · ₹{o.total_amount} · {(o.shops as unknown as { shop_name: string } | null)?.shop_name ?? 'Shop'} · ref {o.refund_ref}
        </p>
      ))}
    </div>
  )
}
