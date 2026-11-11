// FILE: src/app/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { approveShop, rejectShop } from './actions'
import { Button } from '@/components/ui/Button'
import { BUCKETS, publicUrl } from '@/lib/storage'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: shops } = await supabase
    .from('shops')
    .select('*, profiles(full_name, phone)')
    .order('created_at', { ascending: false })

  const all = shops ?? []
  const pending = all.filter(s => s.status === 'pending')
  const approved = all.filter(s => s.status === 'approved')
  const rejected = all.filter(s => s.status === 'rejected')

  // Which pending shops have an ID proof on file (the file itself stays private).
  const pendingIds = pending.map(s => s.id)
  const { data: docs } = pendingIds.length
    ? await supabase.from('shop_documents').select('shop_id, id_proof_name').in('shop_id', pendingIds)
    : { data: [] as { shop_id: string; id_proof_name: string | null }[] }
  const docByShop = new Map((docs ?? []).map(d => [d.shop_id, d]))

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Admin — Shop Approvals</h2>
      <p style={{ marginBottom: '1rem' }}><a href="/admin/refunds" style={{ color: '#0B4438', fontWeight: 600 }}>💸 Refunds →</a></p>


      <h3 style={{ marginBottom: '.75rem' }}>Pending ({pending.length})</h3>
      {pending.length === 0 && <p style={{ color: '#888', marginBottom: '1.5rem' }}>No pending shops.</p>}
      {pending.map(shop => (
        <div key={shop.id} style={{ border: '1px solid #e3e9e6', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ fontWeight: 700 }}>
            {shop.shop_name} <span style={{ fontWeight: 400, color: '#888' }}>({shop.category})</span>
            {shop.submission_count > 1 && (
              <span style={{ marginLeft: '.5rem', fontSize: '.72rem', fontWeight: 700, color: '#B8860B', background: '#FDF3D7', padding: '.15rem .5rem', borderRadius: 999 }}>
                Resubmitted · submission #{shop.submission_count}
              </span>
            )}
          </p>
          <p style={{ fontSize: '.85rem', color: '#666' }}>{shop.address}, {shop.city} — {shop.pincode}</p>
          <p style={{ fontSize: '.85rem', color: '#666' }}>
            Owner: {shop.profiles?.full_name ?? '—'} · {shop.profiles?.phone ?? '—'}
          </p>
          <p style={{ fontSize: '.8rem', color: '#999' }}>Location source: {shop.location_source}</p>

          <div style={{ display: 'flex', gap: '.9rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '.7rem' }}>
            {publicUrl(BUCKETS.shopPhotos, shop.shop_photo_url) ? (
              <a href={publicUrl(BUCKETS.shopPhotos, shop.shop_photo_url)!} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicUrl(BUCKETS.shopPhotos, shop.shop_photo_url)!}
                  alt={shop.shop_name}
                  style={{ width: 96, height: 96, borderRadius: 10, objectFit: 'cover', display: 'block' }}
                />
              </a>
            ) : (
              <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#B8860B', background: '#FDF3D7', padding: '.3rem .7rem', borderRadius: 8 }}>
                ⚠ No shop photo
              </span>
            )}
            {docByShop.get(shop.id) ? (
              <a
                href={`/admin/id-proof/${shop.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '.85rem', fontWeight: 600, color: '#0B4438', border: '1.5px solid #0B4438', borderRadius: 999, padding: '.4rem .9rem', textDecoration: 'none' }}
              >
                🪪 View ID proof{docByShop.get(shop.id)?.id_proof_name ? ` (${docByShop.get(shop.id)?.id_proof_name})` : ''}
              </a>
            ) : (
              <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#B8860B', background: '#FDF3D7', padding: '.3rem .7rem', borderRadius: 8 }}>
                ⚠ No ID proof uploaded
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '.6rem', marginTop: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <form action={approveShop}>
              <input type="hidden" name="shopId" value={shop.id} />
              <Button>Approve</Button>
            </form>
            <form action={rejectShop} style={{ display: 'flex', gap: '.5rem' }}>
              <input type="hidden" name="shopId" value={shop.id} />
              <input
                name="note"
                placeholder="Reason for rejection"
                required
                style={{ padding: '.4rem .7rem', border: '1px solid #ddd', borderRadius: 8, fontSize: '.85rem' }}
              />
              <Button variant="outline">Reject</Button>
            </form>
          </div>
        </div>
      ))}

      <h3 style={{ margin: '2rem 0 .75rem' }}>Approved ({approved.length})</h3>
      {approved.map(shop => (
        <p key={shop.id} style={{ fontSize: '.9rem', marginBottom: '.4rem' }}>✅ {shop.shop_name} — {shop.city}</p>
      ))}

      <h3 style={{ margin: '2rem 0 .75rem' }}>Rejected ({rejected.length})</h3>
      {rejected.map(shop => (
        <p key={shop.id} style={{ fontSize: '.9rem', marginBottom: '.4rem' }}>❌ {shop.shop_name} — {shop.rejection_note}</p>
      ))}
    </div>
  )
}
