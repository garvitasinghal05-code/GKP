// DESTINATION: src/components/shop/AddToCartButton.tsx  (replaces the existing file)
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { useCart } from '@/lib/cart/CartContext'
import { Button } from '@/components/ui/Button'

type Props = {
  productId: string
  name: string
  price: number
  unit: string
  shopId: string
  shopName: string
  isLoggedIn: boolean
  stockQty: number
  shopOpen: boolean
}

const step = 'inline-flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-brand text-heading transition-colors hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40'

export function AddToCartButton({ productId, name, price, unit, shopId, shopName, isLoggedIn, stockQty, shopOpen }: Props) {
  const router = useRouter()
  const { items, addItem, updateQuantity } = useCart()
  const [showMax, setShowMax] = useState(false)

  const cartItem = items.find(i => i.productId === productId)
  const quantity = cartItem?.quantity ?? 0
  const atMax = quantity >= stockQty

  function handleAdd() {
    if (!isLoggedIn) {
      router.push(`/login?next=/shop/${shopId}`)
      return
    }
    addItem({ productId, name, price, unit, shopId, shopName })
  }

  function handleIncrement() {
    if (atMax) {
      setShowMax(true)
      setTimeout(() => setShowMax(false), 1800)
      return
    }
    updateQuantity(productId, quantity + 1)
  }

  if (quantity > 0) {
    return (
      <div className="text-right">
        <div className="flex items-center justify-end gap-2.5">
          <button type="button" aria-label="Remove one" onClick={() => updateQuantity(productId, quantity - 1)} className={step}>
            <Minus size={15} />
          </button>
          <span className="min-w-5 text-center text-base font-bold">{quantity}</span>
          <button type="button" aria-label="Add one more" onClick={handleIncrement} className={step} style={atMax ? { opacity: 0.45 } : undefined}>
            <Plus size={15} />
          </button>
        </div>
        {showMax && <p className="mt-1 text-xs text-danger">Only {stockQty} available</p>}
      </div>
    )
  }

  // A closed shop can't take new orders. Items already in the cart keep their
  // stepper above (so they can still be reduced); only NEW adds are blocked.
  if (!shopOpen) {
    return <Button disabled size="sm">Shop closed</Button>
  }

  return (
    <Button onClick={handleAdd} size="sm">
      <ShoppingCart size={14} /> Add to Cart
    </Button>
  )
}
