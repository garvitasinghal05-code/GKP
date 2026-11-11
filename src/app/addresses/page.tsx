// DESTINATION: src/app/addresses/page.tsx  (replaces the existing file)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Plus, Star, Trash2 } from 'lucide-react'
import { deleteAddress, setDefaultAddress } from './actions'
import { Button, buttonClass } from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/SectionTitle'

export default async function AddressesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: addresses } = await supabase
    .from('addresses')
    .select('*')
    .eq('customer_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon={<MapPin size={28} />} count={addresses?.length ?? 0} className="!mb-0">My Addresses</SectionTitle>
        <Link href="/addresses/new" className={buttonClass()}><Plus size={16} /> Add Address</Link>
      </div>

      {(!addresses || addresses.length === 0) && (
        <div className="card mt-4 p-10 text-center text-muted">No saved addresses yet. Add one to check out faster.</div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {addresses?.map(addr => (
          <article
            key={addr.id}
            className={`card flex flex-col gap-3 p-5 ${addr.is_default ? '!border-2 !border-ok' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-lg">{addr.label}</strong>
              {addr.is_default && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-0.5 text-xs font-bold text-ok">
                  <Star size={12} className="fill-current" /> Default
                </span>
              )}
            </div>
            <p className="flex items-start gap-2 text-sm text-muted">
              <MapPin size={16} className="mt-0.5 shrink-0" /> <span className="break-words">{addr.full_address}</span>
            </p>

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {!addr.is_default && (
                <form action={setDefaultAddress}>
                  <input type="hidden" name="addressId" value={addr.id} />
                  <Button variant="outline" size="sm">Set as Default</Button>
                </form>
              )}
              <form action={deleteAddress}>
                <input type="hidden" name="addressId" value={addr.id} />
                <Button variant="danger" size="sm"><Trash2 size={13} /> Delete</Button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
