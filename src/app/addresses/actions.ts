// DESTINATION: src/app/addresses/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteAddress(formData: FormData) {
  const addressId = formData.get('addressId') as string
  const supabase = await createClient()
  await supabase.from('addresses').delete().eq('id', addressId)
  revalidatePath('/addresses')
}

export async function setDefaultAddress(formData: FormData) {
  const addressId = formData.get('addressId') as string
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Only one address can be default at a time, so clear the rest first.
  await supabase.from('addresses').update({ is_default: false }).eq('customer_id', user.id)
  await supabase.from('addresses').update({ is_default: true }).eq('id', addressId)
  revalidatePath('/addresses')
}
