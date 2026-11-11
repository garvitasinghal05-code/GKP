'use server'
// FILE: src/app/admin/actions.ts

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function approveShop(formData: FormData) {
  const shopId = formData.get('shopId') as string
  const supabase = await createClient()
  await supabase
    .from('shops')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', shopId)
  revalidatePath('/admin')
}

export async function rejectShop(formData: FormData) {
  const shopId = formData.get('shopId') as string
  const note = formData.get('note') as string
  const supabase = await createClient()
  await supabase
    .from('shops')
    .update({ status: 'rejected', rejection_note: note })
    .eq('id', shopId)
  revalidatePath('/admin')
}
