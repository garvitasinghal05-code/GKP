// DESTINATION: src/components/layout/CartLink.tsx  (replaces the existing file)
'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/lib/cart/CartContext'

export function CartLink() {
  const { items } = useCart()
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <Link href="/cart" className="nav-link inline-flex items-center gap-1.5">
      <ShoppingCart size={17} />
      Cart
      {count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-bold text-[#0B4438]">
          {count}
        </span>
      )}
    </Link>
  )
}
