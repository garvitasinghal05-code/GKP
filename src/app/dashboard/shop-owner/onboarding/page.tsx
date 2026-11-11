'use client'
// FILE: src/app/dashboard/shop-owner/onboarding/page.tsx

import { useState, useEffect, FormEvent } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LocationPicker } from '@/components/shop/LocationPicker'
import { HoursFields } from '@/components/shop/HoursFields'
import { FilePicker } from '@/components/ui/FilePicker'
import { BUCKETS, uploadForCurrentUser, removeFiles } from '@/lib/storage'
import { hoursError } from '@/lib/shopHours'

const CATEGORIES = [
  'Kirana / General Store', 'Electronics', 'Stationery', 'Pharmacy',
  'Bakery', 'Dairy', 'Vegetables & Fruits', 'Hardware', 'Other',
]

type LocationValue = { lat: number; lng: number; source: 'pin' | 'manual' }

export default function ShopOnboardingPage() {
  const supabase = createClient()
  const router = useRouter()

  const [leafletReady, setLeafletReady] = useState(false)

  // If Leaflet was already loaded by an earlier page this session, the
  // <Script> below won't fire onLoad again — so check directly too.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) setLeafletReady(true)
  }, [])

  const [shopName, setShopName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [shopPhoto, setShopPhoto] = useState<File | null>(null)
  const [idProof, setIdProof] = useState<File | null>(null)
  const [closesAt, setClosesAt] = useState('')
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Anyone can land here directly by URL — make sure they're actually logged in.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login')
    })
  }, [supabase, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!location) return setError('Please set your shop location first.')
    const hoursProblem = hoursError(opensAt, closesAt)
    if (hoursProblem) return setError(hoursProblem)
    if (!shopPhoto) return setError('Please add a photo of your shop.')
    if (!idProof) return setError('Please add your ID proof so the admin can verify your shop.')

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return setError('You must be logged in.')
    }

    // 1. Upload both files first (shrunk in the browser). If either fails,
    //    nothing has been saved yet, so there is nothing half-finished.
    let photoPath = ''
    let idPath = ''
    let idName = ''
    try {
      photoPath = (await uploadForCurrentUser(supabase, BUCKETS.shopPhotos, shopPhoto)).path
      const id = await uploadForCurrentUser(supabase, BUCKETS.idProofs, idProof)
      idPath = id.path
      idName = id.name
    } catch (err) {
      await removeFiles(supabase, BUCKETS.shopPhotos, [photoPath])
      setLoading(false)
      return setError(err instanceof Error ? err.message : 'The upload failed. Please try again.')
    }

    // 2. Create the shop.
    const { data: shop, error } = await supabase
      .from('shops')
      .insert({
        owner_id: user.id,
        shop_name: shopName,
        category,
        description,
        area,
        address,
        city,
        pincode,
        opens_at: opensAt || null,
        closes_at: closesAt || null,
        shop_photo_url: photoPath,
        location: `SRID=4326;POINT(${location.lng} ${location.lat})`,
        location_source: location.source,
      })
      .select('id')
      .single()

    if (error || !shop) {
      await removeFiles(supabase, BUCKETS.shopPhotos, [photoPath])
      await removeFiles(supabase, BUCKETS.idProofs, [idPath])
      setLoading(false)
      return setError(error?.message ?? 'Could not create your shop. Please try again.')
    }

    // 3. Record the private ID proof. If only this step fails the shop still
    //    exists, and the dashboard will clearly ask for the ID to be added.
    const { error: docError } = await supabase
      .from('shop_documents')
      .insert({ shop_id: shop.id, id_proof_path: idPath, id_proof_name: idName })
    if (docError) await removeFiles(supabase, BUCKETS.idProofs, [idPath])

    setLoading(false)
    router.push('/dashboard/shop-owner')
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
        onLoad={() => setLeafletReady(true)}
      />

      <div className="max-w-xl mx-auto mt-10 mb-16 bg-white border border-gray-200 rounded-xl p-8">
        <h2 className="text-2xl font-bold mb-1">Set up your shop</h2>
        <p className="text-gray-500 text-sm mb-6">
          Fill in your shop&apos;s details — an admin reviews new shops before they go live.
        </p>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <Input label="Shop Name" required value={shopName} onChange={e => setShopName(e.target.value)} />

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1.5">Category</label>
            <select
              required
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm"
            >
              <option value="">-- Select --</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Area / Locality"
              required
              value={area}
              onChange={e => setArea(e.target.value)}
              placeholder="e.g. Kanti Nagar, Thatipur"
            />
            <Input label="City" required value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <p className="text-xs text-gray-500 -mt-2 mb-4">
            Customers can find your shop by typing this area name directly — spell it the way people actually search for it.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Address" required value={address} onChange={e => setAddress(e.target.value)} />
            <Input label="PIN Code" required maxLength={6} value={pincode} onChange={e => setPincode(e.target.value)} />
          </div>

          <HoursFields opensAt={opensAt} closesAt={closesAt} onOpensAt={setOpensAt} onClosesAt={setClosesAt} />

          <div className="my-5">
            <label className="block text-sm font-semibold mb-2">Shop Location</label>
            {leafletReady ? (
              <LocationPicker autoLocate onChange={setLocation} />
            ) : (
              <p className="text-sm text-gray-400">Loading map…</p>
            )}
            {location && (
              <p className="text-xs text-gray-500 mt-2">
                Set to {location.lat.toFixed(4)}, {location.lng.toFixed(4)} ({location.source})
              </p>
            )}
          </div>

          <FilePicker
            label="Photo of your shop"
            hint="A clear photo of the shop front. Customers will see this."
            kind="image"
            file={shopPhoto}
            onFile={setShopPhoto}
            required
          />
          <FilePicker
            label="ID proof"
            hint="A government ID or shop licence — photo or PDF. This is private: only you and the GKP admin can open it, and customers never see it."
            kind="image-or-pdf"
            file={idProof}
            onFile={setIdProof}
            required
          />

          <Button block disabled={loading}>{loading ? 'Uploading & submitting…' : 'Submit for Approval'}</Button>
        </form>
      </div>
    </>
  )
}
