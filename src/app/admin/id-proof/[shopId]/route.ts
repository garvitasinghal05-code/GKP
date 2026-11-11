// DESTINATION: src/app/admin/id-proof/[shopId]/route.ts  (new folders: admin/id-proof/[shopId]/)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BUCKETS } from '@/lib/storage'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function plain(message: string, status: number) {
  return new NextResponse(message, { status, headers: { 'Cache-Control': 'no-store' } })
}

// Opens a shop's PRIVATE ID proof for an admin. The file itself never has a
// public address: this checks the caller is an admin, then hands out a link
// that stops working after one minute.
export async function GET(_request: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params
  if (!UUID.test(shopId)) return plain('Not found', 404)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return plain('Please log in.', 401)

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return plain('Only admins can open ID proofs.', 403)

  const { data: doc } = await supabase
    .from('shop_documents')
    .select('id_proof_path')
    .eq('shop_id', shopId)
    .maybeSingle()
  if (!doc) return plain('No ID proof has been uploaded for this shop.', 404)

  const { data, error } = await supabase.storage.from(BUCKETS.idProofs).createSignedUrl(doc.id_proof_path, 60)
  if (error || !data?.signedUrl) return plain('Could not open the file. Please try again.', 500)

  const res = NextResponse.redirect(data.signedUrl)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
