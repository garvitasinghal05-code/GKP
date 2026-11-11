// DESTINATION: src/components/layout/MiniCartBar.tsx  (replaces the existing file)
'use client'

import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/cart/CartContext'

export function MiniCartBar() {
  const { items, shopName, total } = useCart()
  const count = items.reduce((sum, i) => sum + i.quantity, 0)
  if (count === 0) return null

  return (
    <Link
      href="/cart"
      className="fixed bottom-5 left-1/2 z-[100] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white no-underline shadow-xl transition-colors hover:bg-brand-2"
    >
      <ShoppingBag size={18} />
      <span className="truncate">{count} item{count > 1 ? 's' : ''} · {shopName}</span>
      <span className="whitespace-nowrap rounded-full bg-gold px-3 py-1 text-[#0B4438]">
        ₹{total.toFixed(2)} · View Cart
      </span>
    </Link>
  )
}
