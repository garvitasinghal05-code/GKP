'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export type CartItem = {
  productId: string
  name: string
  price: number
  unit: string
  quantity: number
  shopId: string
  shopName: string
}

type CartContextValue = {
  items: CartItem[]
  shopName: string | null
  addItem: (item: Omit<CartItem, 'quantity'>) => 'added' | 'blocked'
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  total: number
}

const CartContext = createContext<CartContextValue | null>(null)

function storageKeyFor(userId: string | null) {
  // Each account gets its own storage slot, so logging out and back in
  // as someone else never shows a stranger's leftover cart.
  return userId ? `gkp_cart_${userId}` : 'gkp_cart_guest'
}

export function CartProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  // Track who's actually logged in, and react immediately to login/logout.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      setReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [supabase])

  // Whenever the logged-in user changes (including login/logout), load
  // THAT account's saved cart — never the previous person's.
  useEffect(() => {
    if (!ready) return
    const key = storageKeyFor(userId)
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        setItems(JSON.parse(saved))
      } catch {
        setItems([])
      }
    } else {
      setItems([])
    }
  }, [userId, ready])

  // Save under the CURRENT user's key only.
  useEffect(() => {
    if (!ready) return
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(items))
  }, [items, userId, ready])

  const shopName = items[0]?.shopName ?? null

  function addItem(item: Omit<CartItem, 'quantity'>): 'added' | 'blocked' {
    if (items.length > 0 && items[0].shopId !== item.shopId) {
      const confirmSwitch = window.confirm(
        `Your cart has items from "${items[0].shopName}". You can only order from one shop at a time.\n\nClear your cart and add this item from "${item.shopName}" instead?`
      )
      if (!confirmSwitch) return 'blocked'
      setItems([{ ...item, quantity: 1 }])
      return 'added'
    }

    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId)
      if (existing) {
        return prev.map(i => (i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { ...item, quantity: 1 }]
    })
    return 'added'
  }

  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) return removeItem(productId)
    setItems(prev => prev.map(i => (i.productId === productId ? { ...i, quantity } : i)))
  }

  function clearCart() {
    setItems([])
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, shopName, addItem, removeItem, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
