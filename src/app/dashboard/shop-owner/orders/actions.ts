// DESTINATION: src/app/dashboard/shop-owner/orders/actions.ts  (replaces the existing file)
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Payment is no longer touched here: the database marks pay-on-receipt orders
// paid when they are completed, and online orders are marked paid by the server.
// A shop also cannot accept an online order before it has been paid (the
// database refuses it).
export async function updateOrderStatus(formData: FormData) {
  const orderId = formData.get('orderId') as string
  const newStatus = formData.get('newStatus') as string
  const note = formData.get('note') as string | null

  const supabase = await createClient()
  const updates: Record<string, unknown> = { status: newStatus }
  if (note) updates.shop_note = note

  // The 15-minute pickup window starts the moment the shop marks the
  // order ready — NOT when the customer originally placed it.
  if (newStatus === 'ready_for_pickup') {
    updates.reservation_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  }

  const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
  if (error) {
    revalidatePath('/dashboard/shop-owner/orders')
    return
  }

  if (newStatus === 'ready_for_pickup') {
    await supabase.rpc('deduct_order_stock', { p_order_id: orderId })
  }

  if (newStatus === 'rejected' || newStatus === 'cancelled') {
    await supabase.rpc('restore_order_stock', { p_order_id: orderId })
  }

  revalidatePath('/dashboard/shop-owner/orders')
}

// The shop checked its own UPI app and saw the money: mark the order paid.
export async function confirmUpiPayment(formData: FormData) {
  const orderId = formData.get('orderId') as string
  const supabase = await createClient()
  await supabase.rpc('confirm_upi_payment', { p_order_id: orderId })
  revalidatePath('/dashboard/shop-owner/orders')
}
