// DESTINATION: src/components/shop/ProductRow.tsx  (replaces the existing file)
'use client'

import { useState, FormEvent } from 'react'
import { Eye, EyeOff, Package, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BUCKETS, publicUrl, uploadForCurrentUser, removeFiles } from '@/lib/storage'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FilePicker } from '@/components/ui/FilePicker'

type Product = {
  id: string
  name: string
  price: number
  unit: string
  stock_qty: number
  is_available: boolean
  image_url: string | null
}

type Props = {
  product: Product
  editProduct: (formData: FormData) => Promise<{ error?: string }>
  toggleAvailability: (formData: FormData) => void | Promise<void>
  deleteProduct: (formData: FormData) => void | Promise<void>
}

// One product as a card. It sits inside a grid, so the edit form spans the full row.
export function ProductRow({ product, editProduct, toggleAvailability, deleteProduct }: Props) {
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const imageUrl = publicUrl(BUCKETS.productImages, product.image_url)
  const outOfStock = product.stock_qty <= 0

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    let uploaded = ''
    try {
      if (photo) {
        uploaded = (await uploadForCurrentUser(supabase, BUCKETS.productImages, photo)).path
        fd.set('image_path', uploaded)
      }
      const result = await editProduct(fd)
      if (result?.error) {
        setError(result.error)
        return
      }
      setPhoto(null)
      setIsEditing(false)
    } catch (err) {
      if (uploaded) await removeFiles(supabase, BUCKETS.productImages, [uploaded])
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className="card col-span-full border-[1.5px] !border-brand bg-mint/40 p-4">
        <input type="hidden" name="productId" value={product.id} />
        <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-4">
          <div className="col-span-2"><Input label="Name" name="name" defaultValue={product.name} required /></div>
          <Input label="Price (₹)" name="price" type="number" step="0.01" min="0" defaultValue={product.price} required />
          <Input label="Unit" name="unit" defaultValue={product.unit} required />
          <Input label="Stock" name="stock_qty" type="number" min="0" step="1" defaultValue={product.stock_qty} required />
        </div>
        <FilePicker
          label="Product photo"
          hint="Choose a new photo to replace the current one."
          kind="image"
          file={photo}
          onFile={setPhoto}
          existingUrl={imageUrl}
          size={88}
        />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => { setIsEditing(false); setPhoto(null); setError('') }}>
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <article className={`card flex flex-col overflow-hidden ${product.is_available && !outOfStock ? '' : 'opacity-70'}`}>
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-mint">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <Package size={38} className="text-brand-2/60" />
        )}
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={
            outOfStock
              ? { color: 'var(--danger)', background: 'var(--danger-bg)' }
              : product.is_available
                ? { color: 'var(--ok)', background: 'var(--ok-bg)' }
                : { color: 'var(--muted)', background: 'var(--surface)' }
          }
        >
          {outOfStock ? 'Out of stock' : product.is_available ? 'Available' : 'Hidden'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-semibold leading-snug">{product.name}</h3>
          <p className="mt-0.5">
            <span className="font-display text-xl font-bold text-heading">₹{product.price}</span>
            <span className="text-sm text-muted"> / {product.unit}</span>
          </p>
          <p className="text-sm text-muted">Stock: <strong className="text-ink">{product.stock_qty}</strong></p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil size={13} /> Edit
          </Button>

          <form action={toggleAvailability}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="current" value={String(product.is_available)} />
            <Button
              variant="outline"
              size="sm"
              disabled={outOfStock}
              title={outOfStock ? 'Add stock first — products with no stock stay unavailable' : undefined}
            >
              {product.is_available ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}
            </Button>
          </form>

          {/* Turns red on hover, and asks before deleting */}
          <form
            action={deleteProduct}
            onSubmit={e => {
              if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) e.preventDefault()
            }}
          >
            <input type="hidden" name="productId" value={product.id} />
            <Button variant="danger" size="sm"><Trash2 size={13} /> Delete</Button>
          </form>
        </div>
      </div>
    </article>
  )
}
