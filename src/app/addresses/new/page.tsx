// DESTINATION: src/app/addresses/new/page.tsx  (new folders: addresses/new/)
'use client'

import { useState, FormEvent, Suspense, useEffect } from 'react'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LocationPicker } from '@/components/shop/LocationPicker'

type LocationValue = { lat: number; lng: number; source: 'pin' | 'manual' }

function NewAddressForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/addresses'

  const [leafletReady, setLeafletReady] = useState(false)

  // If Leaflet was already loaded by an earlier page this session, the
  // <Script> below won't fire onLoad again — so check directly too.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) setLeafletReady(true)
  }, [])
  const [label, setLabel] = useState('Home')
  const [fullAddress, setFullAddress] = useState('')
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!location) return setError('Please set the location on the map first.')

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      router.push(`/login?next=/addresses/new`)
      return
    }

    const { data: existing } = await supabase.from('addresses').select('id').eq('customer_id', user.id)
    const isFirstAddress = !existing || existing.length === 0

    const { error } = await supabase.from('addresses').insert({
      customer_id: user.id,
      label,
      full_address: fullAddress,
      location: `SRID=4326;POINT(${location.lng} ${location.lat})`,
      is_default: isFirstAddress, // first address saved becomes the default automatically
    })

    setLoading(false)
    if (error) return setError(error.message)
    router.push(next)
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
        onLoad={() => setLeafletReady(true)}
      />

      <div style={{ maxWidth: 500, margin: '2rem auto', background: '#fff', border: '1px solid #e3e9e6', borderRadius: 12, padding: '1.6rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '.3rem' }}>Add a Delivery Address</h2>
        <p style={{ color: '#888', fontSize: '.88rem', marginBottom: '1.2rem' }}>
          Pin the exact spot, or type coordinates if you're not comfortable with maps.
        </p>

        {error && <p style={{ color: '#C1440E', fontSize: '.9rem', marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <Input label="Label (e.g. Home, Work)" value={label} onChange={e => setLabel(e.target.value)} required />
          <Input
            label="Full Address"
            value={fullAddress}
            onChange={e => setFullAddress(e.target.value)}
            placeholder="House no., street, landmark, city"
            required
          />

          <div style={{ margin: '1rem 0' }}>
            <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, marginBottom: '.4rem' }}>
              Pin the Location
            </label>
            {leafletReady ? (
              <LocationPicker autoLocate onChange={setLocation} />
            ) : (
              <p style={{ fontSize: '.85rem', color: '#999' }}>Loading map…</p>
            )}
          </div>

          <Button block disabled={loading}>{loading ? 'Saving…' : 'Save Address'}</Button>
        </form>
      </div>
    </>
  )
}

export default function NewAddressPage() {
  return (
    <Suspense fallback={null}>
      <NewAddressForm />
    </Suspense>
  )
}
