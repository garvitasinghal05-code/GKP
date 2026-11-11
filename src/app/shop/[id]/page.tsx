// DESTINATION: src/app/shop/[id]/page.tsx  (replaces the existing file)
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Clock, MapPin, Package, Star, Tag } from 'lucide-react'
import { AddToCartButton } from '@/components/shop/AddToCartButton'
import { MiniCartBar } from '@/components/layout/MiniCartBar'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { hoursLabel, openStatus } from '@/lib/shopHours'
import { BUCKETS, publicUrl } from '@/lib/storage'

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  const { data: shop } = await supabase.from('shops').select('*').eq('id', id).eq('status', 'approved').maybeSingle()
  if (!shop) notFound()

  const { data: openNowData, error: openNowError } = await supabase.rpc('shop_is_open_now', {
    p_is_open: shop.is_open,
    p_opens_at: shop.opens_at,
    p_closes_at: shop.closes_at,
  })
  const shopOpen = openNowError ? !!shop.is_open : openNowData === true
  const status = openStatus({ switchOn: !!shop.is_open, openNow: shopOpen, opens: shop.opens_at, closes: shop.closes_at })
  const hours = hoursLabel(shop.opens_at, shop.closes_at)

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shop.id)
    .order('is_available', { ascending: false })
    .order('name')

  // Only rating/comment/date — never the reviewer's identity.
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, created_at')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  const reviewCount = reviews?.length ?? 0
  const avgRating = reviewCount > 0 ? reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0

  const shopPhoto = publicUrl(BUCKETS.shopPhotos, shop.shop_photo_url)
  const initial = shop.shop_name.trim().charAt(0).toUpperCase()

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6">
      {/* ── Banner photo ── */}
      <div className="hero-bg relative h-44 overflow-hidden rounded-3xl sm:h-60">
        {shopPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shopPhoto} alt={shop.shop_name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display absolute -right-2 -top-8 select-none text-[12rem] font-extrabold leading-none text-white/10">
            {initial}
          </span>
        )}
      </div>

      {/* ── Shop identity card, overlapping the banner ── */}
      <section className="card relative -mt-12 mb-8 ml-3 mr-3 flex flex-wrap items-center gap-x-5 gap-y-3 p-5 shadow-lg sm:mx-6 sm:p-6">
        <div className="hero-bg font-display flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-extrabold text-white sm:h-20 sm:w-20 sm:text-4xl">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                shopOpen ? 'bg-gold text-[#0B4438]' : 'bg-danger-bg text-danger'
              }`}
            >
              {status.label}
            </span>
            <span className="rounded-full bg-mint px-3 py-0.5 text-xs font-semibold text-heading">{shop.category}</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{shop.shop_name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <MapPin size={15} className="shrink-0" /> {shop.address}, {shop.city}
          </p>
        </div>
        {reviewCount > 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-mint px-4 py-2.5">
            <Star size={20} className="fill-[var(--gold)] text-[var(--gold)]" />
            <div className="leading-tight">
              <p className="text-lg font-extrabold">{avgRating.toFixed(1)}</p>
              <p className="text-xs text-muted">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}
      </section>

      {!shopOpen && (
        <div className="mb-6 rounded-2xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          This shop is closed right now, so ordering is paused. You can still look around
          {status.detail.startsWith('Opens') ? ` — it ${status.detail.toLowerCase()}.` : '.'}
        </div>
      )}

      {/* ── Main column + info sidebar (uses the full width on desktop) ── */}
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <SectionTitle icon={<Package size={26} />} count={products?.length ?? 0}>Products</SectionTitle>
          {(!products || products.length === 0) && (
            <div className="card p-6 text-muted">This shop hasn&apos;t listed any products yet.</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products?.map(p => {
              const inStock = p.is_available && p.stock_qty > 0
              const isLow = inStock && p.stock_qty <= 4
              const img = publicUrl(BUCKETS.productImages, p.image_url)

              return (
                <article key={p.id} className={`card flex flex-col overflow-hidden ${inStock ? '' : 'opacity-60'}`}>
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-mint">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={40} className="text-brand-2/60" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-snug">{p.name}</h3>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{
                          color: !inStock ? 'var(--danger)' : isLow ? 'var(--warn)' : 'var(--ok)',
                          background: !inStock ? 'var(--danger-bg)' : isLow ? 'var(--warn-bg)' : 'var(--ok-bg)',
                        }}
                      >
                        {!inStock ? 'Out of stock' : isLow ? `Only ${p.stock_qty} left` : 'In stock'}
                      </span>
                    </div>
                    <p>
                      <span className="font-display text-2xl font-bold text-heading">₹{p.price}</span>
                      <span className="text-sm text-muted"> / {p.unit}</span>
                    </p>
                    {inStock && (
                      <div className="mt-auto flex justify-end pt-2">
                        <AddToCartButton
                          productId={p.id}
                          name={p.name}
                          price={p.price}
                          unit={p.unit}
                          shopId={shop.id}
                          shopName={shop.shop_name}
                          isLoggedIn={isLoggedIn}
                          stockQty={p.stock_qty}
                          shopOpen={shopOpen}
                        />
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-12">
            <SectionTitle icon={<Star size={26} />} count={reviewCount}>Reviews</SectionTitle>
            {reviewCount === 0 && <div className="card p-6 text-muted">No reviews yet.</div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {reviews?.map((r, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={16} className={n <= r.rating ? 'fill-[var(--gold)] text-[var(--gold)]' : 'text-line'} />
                      ))}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(r.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                  <p className="mt-2 text-xs text-muted">Anonymous customer</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="card p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-bold">About this shop</h2>
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3">
              <Tag size={18} className="mt-0.5 shrink-0 text-brand-2" />
              <div><p className="font-semibold">Category</p><p className="text-muted">{shop.category}</p></div>
            </li>
            <li className="flex gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-brand-2" />
              <div>
                <p className="font-semibold">Address</p>
                <p className="text-muted">{shop.address}, {shop.city} — {shop.pincode}</p>
              </div>
            </li>
            <li className="flex gap-3">
              <Clock size={18} className="mt-0.5 shrink-0 text-brand-2" />
              <div>
                <p className="font-semibold">{status.label}</p>
                <p className="text-muted">
                  {[status.detail, hours ? `Hours: ${hours}` : 'No fixed hours'].filter(Boolean).join(' · ')}
                </p>
              </div>
            </li>
          </ul>
        </aside>
      </div>

      <MiniCartBar />
    </div>
  )
}
