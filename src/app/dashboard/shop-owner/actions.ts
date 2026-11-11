'use server'
// DESTINATION: src/app/dashboard/shop-owner/actions.ts  (replaces the existing file)

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseProductFields } from '@/lib/productInput'
import { BUCKETS } from '@/lib/storage'

export type ActionResult = { error?: string }

// The picture was uploaded by the browser before this runs; if anything goes
// wrong here, remove it again so no orphan files pile up.
async function dropImage(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null | undefined) {
  if (!path) return
  try {
    await supabase.storage.from(BUCKETS.productImages).remove([path])
  } catch {
    // best effort
  }
}

export async function addProduct(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in again.' }

  const parsed = parseProductFields(k => formData.get(k) as string | null, user.id)
  if (!parsed.ok) {
    await dropImage(supabase, (formData.get('image_path') as string | null)?.startsWith(user.id + '/') ? (formData.get('image_path') as string) : null)
    return { error: parsed.error }
  }
  const f = parsed.value

  const { error } = await supabase.from('products').insert({
    shop_id: formData.get('shopId') as string,
    name: f.name,
    price: f.price,
    unit: f.unit,
    stock_qty: f.stock_qty,
    image_url: f.imagePath,
    is_available: true,
  })
  if (error) {
    await dropImage(supabase, f.imagePath)
    return { error: 'Could not add the product. Please try again.' }
  }
  revalidatePath('/dashboard/shop-owner')
  return {}
}

export async function editProduct(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in again.' }

  const parsed = parseProductFields(k => formData.get(k) as string | null, user.id)
  if (!parsed.ok) {
    await dropImage(supabase, (formData.get('image_path') as string | null)?.startsWith(user.id + '/') ? (formData.get('image_path') as string) : null)
    return { error: parsed.error }
  }
  const f = parsed.value
  const productId = formData.get('productId') as string

  const { data: existing } = await supabase.from('products').select('image_url').eq('id', productId).maybeSingle()
  if (!existing) {
    await dropImage(supabase, f.imagePath)
    return { error: 'That product was not found.' }
  }

  const updates: Record<string, unknown> = { name: f.name, price: f.price, unit: f.unit, stock_qty: f.stock_qty }
  if (f.imagePath) updates.image_url = f.imagePath

  const { data: updated, error } = await supabase.from('products').update(updates).eq('id', productId).select('id')
  if (error || !updated || updated.length === 0) {
    await dropImage(supabase, f.imagePath)
    return { error: 'Could not save the changes. Please try again.' }
  }

  // The old picture is replaced — remove it now that the new one is saved.
  if (f.imagePath && existing.image_url && existing.image_url !== f.imagePath) {
    await dropImage(supabase, existing.image_url)
  }
  revalidatePath('/dashboard/shop-owner')
  return {}
}

export async function toggleAvailability(formData: FormData) {
  const productId = formData.get('productId') as string
  const current = formData.get('current') as string // 'true' | 'false'
  const supabase = await createClient()
  await supabase.from('products').update({ is_available: current !== 'true' }).eq('id', productId)
  revalidatePath('/dashboard/shop-owner')
}

export async function deleteProduct(formData: FormData) {
  const productId = formData.get('productId') as string
  const supabase = await createClient()
  const { data: existing } = await supabase.from('products').select('image_url').eq('id', productId).maybeSingle()
  const { data: deleted } = await supabase.from('products').delete().eq('id', productId).select('id')
  if (deleted && deleted.length > 0) await dropImage(supabase, existing?.image_url)
  revalidatePath('/dashboard/shop-owner')
}

// The "accepting orders" switch. Turning it off stops new orders at once
// (e.g. lunch break, holiday); the database also refuses orders while off.
export async function toggleShopOpen(formData: FormData) {
  const shopId = formData.get('shopId') as string
  const current = formData.get('current') as string // 'true' | 'false'
  const supabase = await createClient()
  await supabase.from('shops').update({ is_open: current !== 'true' }).eq('id', shopId)
  revalidatePath('/dashboard/shop-owner')
  revalidatePath(`/shop/${shopId}`)
}
