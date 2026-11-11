// DESTINATION: src/app/cart/page.tsx  (replaces the existing file)
'use client'

import Link from 'next/link'
import { ArrowRight, Minus, Plus, Search, ShoppingCart, Store, Trash2 } from 'lucide-react'
import { useCart } from '@/lib/cart/CartContext'
import { Button, buttonClass } from '@/components/ui/Button'
import { EmptyCartArt } from '@/components/ui/EmptyCartArt'
import { SectionTitle } from '@/components/ui/SectionTitle'

export default function CartPage() {
  const { items, shopName, updateQuantity, removeItem, clearCart, total } = useCart()

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="card flex flex-col items-center px-6 py-10 text-center shadow-sm sm:px-12">
          <EmptyCartArt className="mb-4 h-48 w-auto" />
          <h1 className="text-3xl font-extrabold">Your cart is empty</h1>
          <p className="mt-2 max-w-md text-muted">
            Nothing here yet. Find a shop near you, pick what you need, and add it to your cart — it takes less than a minute.
          </p>
          <Link href="/search" className={buttonClass({ className: 'mt-6 !px-7 !py-3 !text-base' })}>
            <Search size={18} /> Explore shops
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[#0B4438]"><ArrowRight size={14} /></span>
          </Link>
        </div>
      </div>
    )
  }

  const count = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <SectionTitle icon={<ShoppingCart size={28} />} count={count}>Your Cart</SectionTitle>
      <p className="-mt-2 mb-5 flex items-center gap-2 text-muted"><Store size={16} /> All items from <strong className="text-ink">{shopName}</strong></p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-3">
          {items.map(item => (
            <div key={item.productId} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <strong className="block break-words">{item.name}</strong>
                <p className="text-sm text-muted">₹{item.price} / {item.unit}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Remove one" onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-brand text-heading transition-colors hover:bg-brand hover:text-white"><Minus size={15} /></button>
                  <span className="min-w-6 text-center font-bold">{item.quantity}</span>
                  <button type="button" aria-label="Add one more" onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-brand text-heading transition-colors hover:bg-brand hover:text-white"><Plus size={15} /></button>
                </div>
                <span className="w-24 text-right font-bold">₹{(item.price * item.quantity).toFixed(2)}</span>
                <button type="button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.productId)}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--danger-solid)] hover:text-white"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>

        <aside className="card p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-bold">Summary</h2>
          <div className="flex justify-between text-sm text-muted"><span>Items ({count})</span><span>₹{total.toFixed(2)}</span></div>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-extrabold"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
          <Link href="/checkout" className={buttonClass({ variant: 'accent', block: true, className: 'mt-5 !py-3' })}>
            Proceed to Checkout <ArrowRight size={16} />
          </Link>
          <Button variant="danger" block className="mt-3" onClick={clearCart}><Trash2 size={14} /> Clear Cart</Button>
        </aside>
      </div>
    </div>
  )
}
