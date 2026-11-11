// DESTINATION: src/components/shop/AddProductForm.tsx  (replaces the existing file)
'use client'

import { useState, FormEvent } from 'react'
import { CircleCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BUCKETS, uploadForCurrentUser, removeFiles } from '@/lib/storage'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FilePicker } from '@/components/ui/FilePicker'

type Props = {
  shopId: string
  addProduct: (formData: FormData) => Promise<{ error?: string }>
}

export function AddProductForm({ shopId, addProduct }: Props) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('')
  const [stock, setStock] = useState('0')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justAdded, setJustAdded] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setJustAdded(false)
    setSaving(true)

    let imagePath = ''
    try {
      if (photo) imagePath = (await uploadForCurrentUser(supabase, BUCKETS.productImages, photo)).path

      const fd = new FormData()
      fd.set('shopId', shopId)
      fd.set('name', name)
      fd.set('price', price)
      fd.set('unit', unit)
      fd.set('stock_qty', stock)
      fd.set('image_path', imagePath)

      const result = await addProduct(fd)
      if (result?.error) {
        setError(result.error)
        return
      }
      setName(''); setPrice(''); setUnit(''); setStock('0'); setPhoto(null)
      setJustAdded(true)
    } catch (err) {
      if (imagePath) await removeFiles(supabase, BUCKETS.productImages, [imagePath])
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // The surrounding card is drawn by the page, so the form itself has no border.
  return (
    <form onSubmit={handleSubmit}>
      <Input label="Product Name" required value={name} onChange={e => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Price (₹)" type="number" step="0.01" min="0" required value={price} onChange={e => setPrice(e.target.value)} />
        <Input label="Unit (kg, piece)" required value={unit} onChange={e => setUnit(e.target.value)} />
      </div>
      <Input label="Stock Quantity" type="number" min="0" step="1" value={stock} onChange={e => setStock(e.target.value)} />
      <FilePicker
        label="Product photo (optional)"
        hint="A clear photo helps customers recognise it. Photos are shrunk automatically."
        kind="image"
        file={photo}
        onFile={setPhoto}
        size={96}
      />
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {justAdded && (
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ok">
          <CircleCheck size={16} /> Product added
        </p>
      )}
      <Button block disabled={saving}>{saving ? 'Adding…' : 'Add Product'}</Button>
    </form>
  )
}
