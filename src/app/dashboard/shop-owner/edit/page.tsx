// DESTINATION: src/app/dashboard/shop-owner/edit/page.tsx  (replaces the existing file)
'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { CircleCheck, CircleX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LocationPicker } from '@/components/shop/LocationPicker'
import { HoursFields } from '@/components/shop/HoursFields'
import { hoursError } from '@/lib/shopHours'
import { FilePicker } from '@/components/ui/FilePicker'
import { BUCKETS, publicUrl, uploadForCurrentUser, removeFiles } from '@/lib/storage'
import { normalizeUpiId, upiIdError } from '@/lib/payment'

const CATEGORIES = [
  'Kirana / General Store', 'Electronics', 'Stationery', 'Pharmacy',
  'Bakery', 'Dairy', 'Vegetables & Fruits', 'Hardware', 'Other',
]

type LocationValue = { lat: number; lng: number; source: 'pin' | 'manual' }

export default function EditShopPage() {
  const supabase = createClient()
  const router = useRouter()

  const [leafletReady, setLeafletReady] = useState(false)
  const [loadingShop, setLoadingShop] = useState(true)
  const [shopId, setShopId] = useState('')
  const [shopName, setShopName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [upiId, setUpiId] = useState('')
  const [initialLat, setInitialLat] = useState(26.2183)
  const [initialLng, setInitialLng] = useState(78.1828)
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [locationTouched, setLocationTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [shopStatus, setShopStatus] = useState<'pending' | 'approved' | 'rejected'>('approved')
  const [rejectionNote, setRejectionNote] = useState('')
  const [savedPhotoPath, setSavedPhotoPath] = useState<string | null>(null)
  const [savedIdPath, setSavedIdPath] = useState<string | null>(null)
  const [savedIdName, setSavedIdName] = useState<string | null>(null)
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [newId, setNewId] = useState<File | null>(null)
  const [savedQrPath, setSavedQrPath] = useState<string | null>(null)
  const [newQr, setNewQr] = useState<File | null>(null)

  const messageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) setLeafletReady(true)
  }, [])

  // The message sits next to the Save button, and the page scrolls to it,
  // so a result (good or bad) can never be missed at the top of a long form.
  useEffect(() => {
    if (error || savedMsg) messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error, savedMsg])

  // Reads what is REALLY stored in the database (not what the screen remembers).
  async function loadStored(id: string) {
    const [photoRes, docRes] = await Promise.all([
      supabase.from('shops').select('shop_photo_url, upi_id, upi_qr_url').eq('id', id).maybeSingle(),
      supabase.from('shop_documents').select('id_proof_path, id_proof_name').eq('shop_id', id).maybeSingle(),
    ])
    const photoRow = photoRes.data
    const docRow = docRes.data
    setSavedPhotoPath(photoRow?.shop_photo_url ?? null)
    setUpiId(photoRow?.upi_id ?? '')
    setSavedQrPath(photoRow?.upi_qr_url ?? null)
    setSavedIdPath(docRow?.id_proof_path ?? null)
    setSavedIdName(docRow?.id_proof_name ?? null)
    return { photoRow, docRow, photoError: photoRes.error, docError: docRes.error }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data, error } = await supabase.rpc('get_my_shop')
      const shop = data?.[0]
      if (error || !shop) {
        setError('Could not load your shop.')
        setLoadingShop(false)
        return
      }
      setShopId(shop.id)
      setShopName(shop.shop_name)
      setCategory(shop.category)
      setDescription(shop.description ?? '')
      setArea(shop.area ?? '')
      setAddress(shop.address)
      setCity(shop.city)
      setPincode(shop.pincode)
      setInitialLat(shop.lat)
      setInitialLng(shop.lng)
      setOpensAt((shop.opens_at ?? '').slice(0, 5))
      setClosesAt((shop.closes_at ?? '').slice(0, 5))
      setShopStatus(shop.status)
      setRejectionNote(shop.rejection_note ?? '')

      const stored = await loadStored(shop.id)
      if (stored.photoError) setError(`Could not read your saved UPI / QR details: ${stored.photoError.message}`)
      else if (stored.docError) setError(`Could not read your saved ID proof: ${stored.docError.message}`)
      setLoadingShop(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSavedMsg('')
    const hoursProblem = hoursError(opensAt, closesAt)
    if (hoursProblem) return setError(hoursProblem)
    const upiProblem = upiIdError(upiId)
    if (upiProblem) return setError(upiProblem)
    setLoading(true)

    const updates: Record<string, unknown> = {
      shop_name: shopName,
      category,
      description,
      area,
      address,
      city,
      pincode,
      opens_at: opensAt || null,
      closes_at: closesAt || null,
      upi_id: upiId.trim() ? normalizeUpiId(upiId) : null,
    }
    if (locationTouched && location) {
      updates.location = `SRID=4326;POINT(${location.lng} ${location.lat})`
      updates.location_source = location.source
    }

    let uploadedPhoto: string | null = null
    let uploadedId: { path: string; name: string } | null = null
    let uploadedQr: string | null = null
    try {
      if (newPhoto) uploadedPhoto = (await uploadForCurrentUser(supabase, BUCKETS.shopPhotos, newPhoto)).path
      if (newQr) uploadedQr = (await uploadForCurrentUser(supabase, BUCKETS.shopPhotos, newQr)).path
      if (newId) uploadedId = await uploadForCurrentUser(supabase, BUCKETS.idProofs, newId)
    } catch (err) {
      await removeFiles(supabase, BUCKETS.shopPhotos, [uploadedPhoto, uploadedQr])
      await removeFiles(supabase, BUCKETS.idProofs, [uploadedId?.path])
      setLoading(false)
      return setError(err instanceof Error ? err.message : 'The upload failed. Please try again.')
    }
    if (uploadedPhoto) updates.shop_photo_url = uploadedPhoto
    if (uploadedQr) updates.upi_qr_url = uploadedQr

    // .select('id') lets us SEE whether a row was really changed. Without it, a
    // database permission block looks like success even though nothing was saved.
    const { data: changedRows, error } = await supabase.from('shops').update(updates).eq('id', shopId).select('id')
    if (error || !changedRows || changedRows.length === 0) {
      await removeFiles(supabase, BUCKETS.shopPhotos, [uploadedPhoto, uploadedQr])
      await removeFiles(supabase, BUCKETS.idProofs, [uploadedId?.path])
      setLoading(false)
      return setError(
        error
          ? `Could not save: ${error.message}`
          : 'Nothing was saved: the database did not allow this change (no update permission on your shop). Nothing was changed.'
      )
    }

    if (uploadedId) {
      const { error: docError } = await supabase
        .from('shop_documents')
        .upsert({ shop_id: shopId, id_proof_path: uploadedId.path, id_proof_name: uploadedId.name }, { onConflict: 'shop_id' })
      if (docError) {
        await removeFiles(supabase, BUCKETS.idProofs, [uploadedId.path])
        setLoading(false)
        return setError(`Your other changes were saved, but the ID proof could not be saved: ${docError.message}`)
      }
    }

    // Old files are removed only after everything above worked.
    if (uploadedPhoto) await removeFiles(supabase, BUCKETS.shopPhotos, [savedPhotoPath])
    if (uploadedQr) await removeFiles(supabase, BUCKETS.shopPhotos, [savedQrPath])
    if (uploadedId) await removeFiles(supabase, BUCKETS.idProofs, [savedIdPath])
    setNewPhoto(null)
    setNewId(null)
    setNewQr(null)

    // Re-read from the database and check that it really holds what we just saved.
    const stored = await loadStored(shopId)
    const problems: string[] = []
    if (uploadedQr && stored.photoRow?.upi_qr_url !== uploadedQr) problems.push('the QR code')
    if (upiId.trim() && stored.photoRow?.upi_id !== normalizeUpiId(upiId)) problems.push('the UPI ID')
    if (uploadedId && stored.docRow?.id_proof_path !== uploadedId.path) problems.push('the ID proof')
    if (problems.length > 0) {
      setLoading(false)
      return setError(`The save went through, but ${problems.join(' and ')} could not be read back from the database. Please tell your developer — a database rule may be hiding it.`)
    }

    if (shopStatus === 'rejected') {
      const { error: resubmitError } = await supabase.rpc('resubmit_shop')
      if (resubmitError) {
        setLoading(false)
        return setError(resubmitError.message)
      }
      setShopStatus('pending')
      setRejectionNote('')
      setSavedMsg('Saved and sent back for approval — the admin will review it again.')
    } else {
      setSavedMsg('Saved. Your changes are stored.')
    }
    setLoading(false)
    router.refresh()
  }

  if (loadingShop) {
    return <div className="p-8 text-center text-muted">Loading your shop…</div>
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" onLoad={() => setLeafletReady(true)} />

      <div className="card mx-4 my-10 max-w-xl p-6 shadow-sm sm:mx-auto sm:p-8">
        <h1 className="mb-1 text-2xl font-bold">
          {shopStatus === 'rejected' ? 'Fix and resubmit your shop' : 'Edit your shop'}
        </h1>
        <p className="mb-6 text-sm text-muted">
          {shopStatus === 'rejected'
            ? 'Update the details below, then resubmit for approval.'
            : shopStatus === 'pending'
              ? 'Your shop is waiting for admin approval. You can keep improving it meanwhile.'
              : 'Changes are visible to customers immediately — no re-approval needed.'}
        </p>

        {shopStatus === 'rejected' && (
          <div className="mb-5 rounded-xl border border-danger/40 bg-danger-bg p-3.5 text-danger">
            <p className="text-sm font-semibold">Your shop was not approved</p>
            <p className="mt-1 text-sm">Reason from the admin: {rejectionNote || 'No reason was given.'}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input label="Shop Name" required value={shopName} onChange={e => setShopName(e.target.value)} />

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold">Category</label>
            <select required value={category} onChange={e => setCategory(e.target.value)} className="field">
              <option value="">-- Select --</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Area / Locality" required value={area} onChange={e => setArea(e.target.value)} />
            <Input label="City" required value={city} onChange={e => setCity(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Address" required value={address} onChange={e => setAddress(e.target.value)} />
            <Input label="PIN Code" required maxLength={6} value={pincode} onChange={e => setPincode(e.target.value)} />
          </div>

          <HoursFields opensAt={opensAt} closesAt={closesAt} onOpensAt={setOpensAt} onClosesAt={setClosesAt} />

          <Input
            label="UPI ID (optional)"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
            placeholder="e.g. myshop@okhdfcbank or 9876543210@paytm"
          />
          <p className="-mt-2 mb-4 text-xs text-muted">
            Customers who choose pay-on-delivery / pay-at-shop will see your UPI ID and a QR, so they can pay you by UPI
            instead of cash — no fee, straight to your bank account. Leave empty if you only take cash. Find your UPI ID
            inside GPay / PhonePe / Paytm.
          </p>

          <FilePicker
            label="Your UPI QR code (optional)"
            hint="Upload the QR from your GPay / PhonePe / Paytm business or personal profile. Customers see it on the payment screen."
            kind="image"
            file={newQr}
            onFile={setNewQr}
            existingUrl={publicUrl(BUCKETS.shopPhotos, savedQrPath)}
            size={160}
          />

          <div className="my-5">
            <label className="mb-2 block text-sm font-semibold">Shop Location</label>
            <p className="mb-2 text-xs text-muted">Showing your current saved pin. Only touch this if the location is actually wrong.</p>
            {leafletReady ? (
              <LocationPicker
                initialLat={initialLat}
                initialLng={initialLng}
                onChange={v => { setLocation(v); setLocationTouched(true) }}
              />
            ) : (
              <p className="text-sm text-muted">Loading map…</p>
            )}
            {locationTouched && location && (
              <p className="mt-2 text-xs text-muted">Will update to {location.lat.toFixed(4)}, {location.lng.toFixed(4)} ({location.source})</p>
            )}
          </div>

          <FilePicker
            label="Photo of your shop"
            hint="A clear photo of the shop front. Customers will see this."
            kind="image"
            file={newPhoto}
            onFile={setNewPhoto}
            existingUrl={publicUrl(BUCKETS.shopPhotos, savedPhotoPath)}
          />
          <FilePicker
            label="ID proof"
            hint={
              savedIdPath
                ? 'On file. Choose a new file only if you want to replace it. Private: only you and the GKP admin can open it.'
                : 'Not uploaded yet — the admin needs this to verify your shop. A government ID or shop licence, photo or PDF. Private: only you and the GKP admin can open it.'
            }
            kind="image-or-pdf"
            file={newId}
            onFile={setNewId}
            existingNote={savedIdPath ? `On file${savedIdName ? `: ${savedIdName}` : ''}` : null}
          />

          {/* Result message — right above the Save button */}
          <div ref={messageRef}>
            {error && (
              <p className="mb-3 flex items-start gap-2 rounded-xl bg-danger-bg p-3 text-sm font-medium text-danger">
                <CircleX size={18} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}
            {savedMsg && (
              <p className="mb-3 flex items-start gap-2 rounded-xl bg-ok-bg p-3 text-sm font-medium text-ok">
                <CircleCheck size={18} className="mt-0.5 shrink-0" /> {savedMsg}
              </p>
            )}
          </div>

          <Button block disabled={loading}>
            {loading ? 'Saving…' : shopStatus === 'rejected' ? 'Save & Resubmit for Approval' : 'Save Changes'}
          </Button>
        </form>
      </div>
    </>
  )
}
