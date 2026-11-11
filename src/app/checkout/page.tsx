// DESTINATION: src/app/checkout/page.tsx  (replaces the existing file)
'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import {
  Check, CircleCheck, Copy, CreditCard, House, MapPin, PenLine, QrCode, Receipt, Store, Truck, Wallet,
} from 'lucide-react'
import { useCart } from '@/lib/cart/CartContext'
import { createClient } from '@/lib/supabase/client'
import { Button, buttonClass } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LocationPicker } from '@/components/shop/LocationPicker'
import { UpiInfoCard } from '@/components/payment/UpiInfoCard'
import { UpiPayCard } from '@/components/payment/UpiPayCard'
import { RazorpayPayCard } from '@/components/payment/RazorpayPayCard'
import { type PaymentMethod } from '@/lib/payment'
import { BUCKETS, publicUrl } from '@/lib/storage'

declare global {
  interface Window { L: any }
}

const ONLINE_ON = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === 'true'

type SavedAddress = { id: string; label: string; full_address: string; is_default: boolean }
type AddressMethod = 'saved' | 'map' | 'manual'

type PlacedOrder = {
  id: string
  fulfillment_type: 'delivery' | 'pickup'
  delivery_address_text: string | null
  total_amount: number
  shopName: string
  payment_method: PaymentMethod
  upi_id: string | null
  upi_qr_url: string | null
  items: { name: string; price: number; quantity: number }[]
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
    const data = await res.json()
    return data?.display_name ?? ''
  } catch {
    return ''
  }
}

export default function CheckoutPage() {
  const { items, shopName, total, clearCart } = useCart()
  const supabase = createClient()
  const router = useRouter()

  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery')
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[] | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [method, setMethod] = useState<AddressMethod>('saved')
  const [manualAddress, setManualAddress] = useState('')
  const [leafletReady, setLeafletReady] = useState(false)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('on_receipt')
  const [shopUpi, setShopUpi] = useState<string | null>(null)
  const [shopQr, setShopQr] = useState<string | null>(null)
  const [acceptedTotal, setAcceptedTotal] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null)

  const cartShopId = items[0]?.shopId

  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) setLeafletReady(true)
  }, [])

  useEffect(() => {
    if (!cartShopId) return
    supabase
      .from('shops')
      .select('upi_id, upi_qr_url')
      .eq('id', cartShopId)
      .maybeSingle()
      .then(({ data }) => {
        setShopUpi(data?.upi_id ?? null)
        setShopQr(data?.upi_qr_url ?? null)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartShopId])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('addresses')
        .select('id, label, full_address, is_default')
        .eq('customer_id', user.id)
        .order('is_default', { ascending: false })
      setSavedAddresses(data ?? [])
      const def = data?.find(a => a.is_default)
      if (def) setSelectedAddressId(def.id)
      else if (!data || data.length === 0) setMethod('manual')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePinDrop(v: { lat: number; lng: number }) {
    const text = await reverseGeocode(v.lat, v.lng)
    setManualAddress(text)
  }

  async function copyUpi() {
    if (!shopUpi) return
    try {
      await navigator.clipboard.writeText(shopUpi)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* visible on screen anyway */ }
  }

  /* ───────────── ORDER PLACED: receipt ───────────── */
  if (placedOrder) {
    const online = placedOrder.payment_method === 'online'
    const upi = placedOrder.payment_method === 'upi'
    const hasPayCard = online || upi || !!placedOrder.upi_id || !!placedOrder.upi_qr_url
    const qrPublic = publicUrl(BUCKETS.shopPhotos, placedOrder.upi_qr_url)

    return (
      <div className={`mx-auto px-4 py-8 sm:px-6 ${hasPayCard ? 'max-w-5xl' : 'max-w-xl'}`}>
        <div className={`grid items-start gap-6 ${hasPayCard ? 'md:grid-cols-2' : ''}`}>
          {/* Receipt: white paper, green border */}
          <div className="rounded-2xl border-2 border-ok bg-surface p-6 shadow-lg">
            <div className="mb-5 text-center">
              <span className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-ok-bg text-ok">
                {online || upi ? <Receipt size={28} /> : <CircleCheck size={30} />}
              </span>
              <h1 className="text-2xl font-extrabold">
                {online ? 'Order created — payment pending' : upi ? 'Order placed — now pay by UPI' : 'Order Placed'}
              </h1>
              <p className="text-sm text-muted">From {placedOrder.shopName}</p>
              <p className="mt-1 text-xs text-muted">Order #{placedOrder.id.slice(0, 8)}</p>
            </div>

            <div className="border-y border-dashed border-line py-3">
              {placedOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between gap-3 py-1 text-sm">
                  <span className="break-words">{item.name} × {item.quantity}</span>
                  <span className="shrink-0">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between py-3 text-lg font-extrabold">
              <span>Total</span>
              <span>₹{placedOrder.total_amount.toFixed(2)}</span>
            </div>

            <div className="space-y-2 rounded-xl bg-mint p-3 text-sm">
              <p className="flex items-start gap-2">
                {placedOrder.fulfillment_type === 'delivery'
                  ? <><Truck size={16} className="mt-0.5 shrink-0" /> <span>Delivering to: {placedOrder.delivery_address_text}</span></>
                  : <><Store size={16} className="mt-0.5 shrink-0" /> <span>Self pickup — you&rsquo;ll be notified once it&rsquo;s ready</span></>}
              </p>
              <p className="flex items-start gap-2">
                {online ? (
                  <><CreditCard size={16} className="mt-0.5 shrink-0" /> <span>Payment: online — please pay now</span></>
                ) : upi ? (
                  <><QrCode size={16} className="mt-0.5 shrink-0" /> <span>Payment: UPI to the shop — pay using the QR / UPI ID, then send the transaction ID</span></>
                ) : (
                  <><Wallet size={16} className="mt-0.5 shrink-0" /> <span>
                    {placedOrder.fulfillment_type === 'delivery' ? 'Payment: on delivery (cash or UPI)' : 'Payment: at the shop (cash or UPI)'}
                  </span></>
                )}
              </p>
            </div>

            <div className="mt-5 flex gap-3">
              <Link href={`/orders/${placedOrder.id}`} className={buttonClass({ block: true })}>Track this Order</Link>
              <Link href="/search" className={buttonClass({ variant: 'outline', block: true })}>Keep Browsing</Link>
            </div>
          </div>

          {hasPayCard && (
            <div>
              {online && <RazorpayPayCard orderId={placedOrder.id} shopName={placedOrder.shopName} amount={placedOrder.total_amount} />}
              {upi && (
                <UpiPayCard
                  orderId={placedOrder.id}
                  shopName={placedOrder.shopName}
                  upiId={placedOrder.upi_id}
                  qrUrl={qrPublic}
                  amount={placedOrder.total_amount}
                  submittedRef={null}
                />
              )}
              {!online && !upi && (placedOrder.upi_id || placedOrder.upi_qr_url) && (
                <UpiInfoCard
                  orderId={placedOrder.id}
                  shopName={placedOrder.shopName}
                  upiId={placedOrder.upi_id}
                  amount={placedOrder.total_amount}
                  qrUrl={qrPublic}
                />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="mx-auto max-w-md px-4 py-24 text-center text-muted">Placing your order…</div>
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-2xl font-bold">Your cart is empty</h1>
        <Link href="/search" className={buttonClass({ className: 'mt-3' })}>Browse shops</Link>
      </div>
    )
  }

  const hasUpi = !!(shopUpi || shopQr)
  const qrPreview = publicUrl(BUCKETS.shopPhotos, shopQr)

  async function handlePlaceOrder(e: FormEvent) {
    e.preventDefault()
    setError('')

    const chosenAddress = savedAddresses?.find(a => a.id === selectedAddressId)
    const finalAddressText = method === 'saved' ? chosenAddress?.full_address ?? '' : manualAddress.trim()

    if (fulfillment === 'delivery' && !finalAddressText) {
      setError('Please choose or enter a delivery address.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      router.push('/login?next=/checkout')
      return
    }

    const chosenPayment: PaymentMethod =
      paymentMethod === 'online' && ONLINE_ON ? 'online'
      : paymentMethod === 'upi' && hasUpi ? 'upi'
      : 'on_receipt'

    const { data: rows, error: rpcError } = await supabase.rpc('place_order', {
      p_shop_id: items[0].shopId,
      p_fulfillment: fulfillment,
      p_items: items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
      p_address_id: fulfillment === 'delivery' && method === 'saved' ? selectedAddressId || null : null,
      p_address_text: fulfillment === 'delivery' && method !== 'saved' ? manualAddress.trim() : null,
      p_payment_method: chosenPayment,
      p_expected_total: acceptedTotal ?? Number(total.toFixed(2)),
    })

    if (rpcError) {
      setLoading(false)
      const m = rpcError.message.match(/PRICE_CHANGED\|([0-9.]+)/)
      if (m) {
        const newTotal = Number(m[1])
        setAcceptedTotal(newTotal)
        setError(`The shop's prices have changed. The new total is ₹${newTotal.toFixed(2)}. Press “Place Order” again to accept it.`)
      } else {
        setError(rpcError.message)
      }
      return
    }

    const created = rows?.[0]
    if (!created?.new_order_id) {
      setLoading(false)
      setError('Could not place order. Please try again.')
      return
    }

    const { data: savedItems } = await supabase
      .from('order_items')
      .select('product_name, unit_price, quantity')
      .eq('order_id', created.new_order_id)

    setPlacedOrder({
      id: created.new_order_id,
      fulfillment_type: fulfillment,
      delivery_address_text: fulfillment === 'delivery' ? finalAddressText : null,
      total_amount: Number(created.new_total),
      shopName: shopName ?? '',
      payment_method: chosenPayment,
      upi_id: shopUpi,
      upi_qr_url: shopQr,
      items: (savedItems ?? []).map(i => ({ name: i.product_name, price: Number(i.unit_price), quantity: i.quantity })),
    })
    clearCart()
    setLoading(false)
  }

  const hasSaved = savedAddresses && savedAddresses.length > 0
  const addressMethods: { key: AddressMethod; label: string; icon: React.ReactNode }[] = [
    ...(hasSaved ? [{ key: 'saved' as AddressMethod, label: 'Saved address', icon: <House size={15} /> }] : []),
    { key: 'map', label: 'Choose on map', icon: <MapPin size={15} /> },
    { key: 'manual', label: 'Type address', icon: <PenLine size={15} /> },
  ]

  const effective: PaymentMethod =
    paymentMethod === 'online' && !ONLINE_ON ? 'on_receipt'
    : paymentMethod === 'upi' && !hasUpi ? 'on_receipt'
    : paymentMethod
  const shownTotal = acceptedTotal ?? total

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" onLoad={() => setLeafletReady(true)} />

      <h1 className="text-3xl font-extrabold">Checkout</h1>
      <p className="mb-6 text-muted">Ordering from <strong className="text-ink">{shopName}</strong></p>

      <form onSubmit={handlePlaceOrder} className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        {/* ───── LEFT: how, where, pay ───── */}
        <div className="grid gap-6">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">1. How do you want it?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setFulfillment('delivery')} className={`pick-card flex items-center gap-3 p-4 ${fulfillment === 'delivery' ? 'is-selected' : ''}`}>
                <Truck size={24} />
                <span><strong className="block">Home Delivery</strong><span className="text-muted text-xs">Shop brings it to you</span></span>
              </button>
              <button type="button" onClick={() => setFulfillment('pickup')} className={`pick-card flex items-center gap-3 p-4 ${fulfillment === 'pickup' ? 'is-selected' : ''}`}>
                <Store size={24} />
                <span><strong className="block">Self Pickup</strong><span className="text-muted text-xs">Collect from the shop</span></span>
              </button>
            </div>
          </section>

          {fulfillment === 'delivery' ? (
            <section className="card p-5">
              <h2 className="mb-3 text-lg font-bold">2. Delivery address</h2>
              <div className="mb-4 flex flex-wrap gap-2">
                {addressMethods.map(m => (
                  <button key={m.key} type="button" onClick={() => setMethod(m.key)} aria-pressed={method === m.key} className="chip">
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              {method === 'saved' && hasSaved && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedAddresses!.map(addr => (
                    <button key={addr.id} type="button" onClick={() => setSelectedAddressId(addr.id)}
                      className={`pick-card p-3 text-sm ${selectedAddressId === addr.id ? 'is-selected' : ''}`}>
                      <strong className="block">{addr.label}</strong>
                      <span className="text-muted break-words">{addr.full_address}</span>
                    </button>
                  ))}
                </div>
              )}

              {method === 'map' && (
                <div className="mb-3">
                  {leafletReady ? <LocationPicker autoLocate onChange={handlePinDrop} /> : <p className="text-sm text-muted">Loading map…</p>}
                </div>
              )}

              {(method === 'map' || method === 'manual') && (
                <>
                  <Input label="Address" value={manualAddress} onChange={e => setManualAddress(e.target.value)} placeholder="Full address with landmark" />
                  {method !== 'manual' && <p className="-mt-2 text-xs text-muted">Filled in from the map — feel free to edit it before ordering.</p>}
                </>
              )}
            </section>
          ) : (
            <section className="card p-5 text-sm text-muted">
              You&apos;ll have 15 minutes to collect your order once the shop marks it as ready for pickup — after that it&apos;s automatically released back to stock.
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">{fulfillment === 'delivery' ? '3' : '2'}. How will you pay?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setPaymentMethod('on_receipt')} className={`pick-card flex items-center gap-3 p-4 ${effective === 'on_receipt' ? 'is-selected' : ''}`}>
                <Wallet size={24} />
                <span>
                  <strong className="block">{fulfillment === 'delivery' ? 'Pay on delivery' : 'Pay at shop'}</strong>
                  <span className="text-muted text-xs">Cash{hasUpi ? ' or UPI to the shop' : ''}</span>
                </span>
              </button>

              {hasUpi && (
                <button type="button" onClick={() => setPaymentMethod('upi')} className={`pick-card flex items-center gap-3 p-4 ${effective === 'upi' ? 'is-selected' : ''}`}>
                  <QrCode size={24} />
                  <span><strong className="block">Pay by UPI</strong><span className="text-muted text-xs">QR or UPI ID — free</span></span>
                </button>
              )}

              {ONLINE_ON && (
                <button type="button" onClick={() => setPaymentMethod('online')} className={`pick-card flex items-center gap-3 p-4 ${effective === 'online' ? 'is-selected' : ''}`}>
                  <CreditCard size={24} />
                  <span><strong className="block">Pay online now</strong><span className="text-muted text-xs">Card, netbanking, wallet</span></span>
                </button>
              )}
            </div>

            {effective === 'upi' && (
              <div className="mt-4 rounded-xl border border-line bg-mint p-4">
                <p className="mb-3 text-sm font-semibold">Pay {shopName} directly by UPI — free, straight to the shop&apos;s bank account</p>
                <div className="flex flex-wrap items-center gap-5">
                  {qrPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrPreview} alt="The shop's UPI QR code" className="h-36 w-36 rounded-xl border border-line bg-white object-contain p-1" />
                  )}
                  <div className="min-w-0 text-sm">
                    {shopUpi && (
                      <>
                        <p className="text-muted">UPI ID</p>
                        <p className="break-all text-base font-bold">{shopUpi}</p>
                        <Button type="button" variant="outline" size="sm" className="mt-1.5" onClick={copyUpi}>
                          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy UPI ID</>}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-muted">
                  <li>Press <strong className="text-ink">Place Order</strong> — your items are reserved first.</li>
                  <li>On the next screen, pay the exact amount (scan the QR or use the UPI ID).</li>
                  <li>Type the UPI transaction ID so the shop can confirm your payment.</li>
                </ol>
              </div>
            )}

            {effective === 'online' && (
              <p className="mt-3 text-xs text-muted">
                You&apos;ll pay on the next screen. The shop sees the order once it&apos;s paid, and an unpaid order is cancelled automatically after 20 minutes.
              </p>
            )}
          </section>
        </div>

        {/* ───── RIGHT: order summary ───── */}
        <aside className="card p-5 shadow-sm lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-bold">Order summary</h2>
          <div className="mb-3 space-y-2 border-b border-dashed border-line pb-3">
            {items.map(i => (
              <div key={i.productId} className="flex justify-between gap-3 text-sm">
                <span className="break-words">{i.name} <span className="text-muted">× {i.quantity}</span></span>
                <span className="shrink-0">₹{(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-lg font-extrabold">
            <span>Total</span>
            <span>₹{shownTotal.toFixed(2)}</span>
          </div>

          {error && <p className="mt-3 rounded-lg bg-danger-bg p-3 text-sm text-danger">{error}</p>}

          <Button variant="accent" block className="mt-4 !py-3 !text-base">Place Order</Button>
        </aside>
      </form>
    </div>
  )
}
