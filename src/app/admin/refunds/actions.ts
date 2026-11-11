// DESTINATION: src/app/admin/refunds/actions.ts  (new folder: admin/refunds/)
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rzp } from '@/lib/razorpay'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function back(kind: 'error' | 'done', text: string): never {
  redirect(`/admin/refunds?${kind}=${encodeURIComponent(text)}`)
}

// Sends the customer's money back through Razorpay, then records it.
export async function refundOrder(formData: FormData): Promise<void> {
  const orderId = formData.get('orderId') as string
  if (!orderId || !UUID.test(orderId)) back('error', 'Invalid order.')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') back('error', 'Only admins can issue refunds.')

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, payment_method, payment_status, status, payment_ref, total_amount')
    .eq('id', orderId)
    .maybeSingle()

  if (
    !order || order.payment_method !== 'online' || order.payment_status !== 'paid' ||
    !['rejected', 'cancelled', 'expired'].includes(order.status) || !order.payment_ref
  ) {
    back('error', 'This order is not due a refund.')
  }

  const refund = await rzp(`/payments/${encodeURIComponent(order!.payment_ref!)}/refund`, {
    method: 'POST',
    body: { amount: Math.round(Number(order!.total_amount) * 100), notes: { order_id: order!.id } },
  })
  if (!refund.ok || !refund.data?.id) {
    back('error', refund.data?.error?.description ?? 'Razorpay could not process the refund.')
  }

  const { error } = await admin.rpc('mark_order_refunded', { p_order_id: order!.id, p_refund_ref: refund.data.id })
  if (error) {
    back('error', `Razorpay refunded the money (ref ${refund.data.id}) but saving it failed: ${error.message}`)
  }

  revalidatePath('/admin/refunds')
  back('done', `Refund sent (ref ${refund.data.id}).`)
}
