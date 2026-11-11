// DESTINATION: src/app/page.tsx  (replaces the existing file)
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ArrowRight, Carrot, Croissant, Milk, Package, PenLine, Pill, Plug, Receipt, Search,
  ShieldCheck, ShoppingBasket, Store, Truck, Wrench, MapPin, Settings, CircleDollarSign, Users,
} from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { CUSTOMER_STATUS_LABELS, statusStyle } from '@/lib/orderStatus'
import { BUCKETS, publicUrl } from '@/lib/storage'

const CATEGORIES = [
  { label: 'Kirana', q: 'Kirana', icon: <ShoppingBasket size={24} /> },
  { label: 'Dairy', q: 'Dairy', icon: <Milk size={24} /> },
  { label: 'Vegetables & Fruits', q: 'Vegetables', icon: <Carrot size={24} /> },
  { label: 'Bakery', q: 'Bakery', icon: <Croissant size={24} /> },
  { label: 'Pharmacy', q: 'Pharmacy', icon: <Pill size={24} /> },
  { label: 'Stationery', q: 'Stationery', icon: <PenLine size={24} /> },
  { label: 'Electronics', q: 'Electronics', icon: <Plug size={24} /> },
  { label: 'Hardware', q: 'Hardware', icon: <Wrench size={24} /> },
]

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  /* ───────────── Not logged in: welcome page ───────────── */
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="hero-bg relative overflow-hidden rounded-3xl px-6 py-14 text-white shadow-md sm:px-12 sm:py-20">
          <span className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rounded-full bg-gold/15" />
          <span className="pointer-events-none absolute -bottom-20 right-24 h-56 w-56 rounded-full bg-white/5" />
          <div className="relative max-w-2xl">
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">
              Your neighbourhood shops, <span className="text-gold">one search away.</span>
            </h1>
            <p className="mt-4 text-lg text-white/85">
              See which nearby shop has what you need, at what price, and whether it&apos;s in stock — before you step out.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/search" className={buttonClass({ variant: 'accent', className: '!px-7 !py-3 !text-base' })}>
                <Search size={18} /> Find shops near me
              </Link>
              <Link href="/register" className="inline-flex items-center rounded-full border-[1.5px] border-white/60 px-7 py-3 text-base font-semibold text-white no-underline transition-colors hover:bg-white/10">
                Create an account
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: <Search size={24} />, t: 'Search a product', d: 'Type what you need and compare nearby shops by price and stock.' },
            { icon: <Truck size={24} />, t: 'Delivery or pickup', d: 'Get it at home, or collect it from the shop within 15 minutes.' },
            { icon: <ShieldCheck size={24} />, t: 'Verified local shops', d: 'Every shop is checked by an admin before it goes live.' },
          ].map(f => (
            <div key={f.t} className="card p-6">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-brand-2">{f.icon}</span>
              <h3 className="text-lg font-bold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const firstName = (profile?.full_name ?? '').trim().split(' ')[0] || 'there'

  /* ───────────── Admin dashboard ───────────── */
  if (profile?.role === 'admin') {
    const { count: pendingShops } = await supabase.from('shops').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    const { count: refundsDue } = await supabase
      .from('orders').select('id', { count: 'exact', head: true })
      .eq('payment_method', 'online').eq('payment_status', 'paid').in('status', ['rejected', 'cancelled', 'expired'])

    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="hero-bg rounded-3xl p-6 text-white shadow-md sm:p-10">
          <p className="text-sm text-white/75">{user.email}</p>
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">Admin dashboard</h1>
        </section>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link href="/admin" className="card card-link flex items-center gap-4 p-6 no-underline">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-brand-2"><Store size={28} /></span>
            <div><p className="font-display text-3xl font-extrabold">{pendingShops ?? 0}</p><p className="text-muted">Shops waiting for approval</p></div>
          </Link>
          <Link href="/admin/refunds" className="card card-link flex items-center gap-4 p-6 no-underline">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warn-bg text-warn"><CircleDollarSign size={28} /></span>
            <div><p className="font-display text-3xl font-extrabold">{refundsDue ?? 0}</p><p className="text-muted">Refunds due</p></div>
          </Link>
        </div>
      </div>
    )
  }

  /* ───────────── Customer / shop-owner dashboard ───────────── */
  const { data: shop } = await supabase.from('shops').select('id, shop_name, status, is_open').eq('owner_id', user.id).maybeSingle()

  const { count: totalOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', user.id)
  const { count: activeOrders } = await supabase
    .from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', user.id)
    .not('status', 'in', '(completed,rejected,cancelled,expired)')
  const { count: addressCount } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('customer_id', user.id)

  const { data: recent } = await supabase
    .from('orders')
    .select('id, status, total_amount, created_at, fulfillment_type, shops(shop_name)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(4)

  const { data: newShops } = await supabase
    .from('shops')
    .select('id, shop_name, category, city, shop_photo_url')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(4)

  const stats = [
    { label: 'Total orders', value: totalOrders ?? 0, icon: <Receipt size={22} />, href: '/orders' },
    { label: 'Active orders', value: activeOrders ?? 0, icon: <Package size={22} />, href: '/orders' },
    { label: 'Saved addresses', value: addressCount ?? 0, icon: <MapPin size={22} />, href: '/addresses' },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Welcome */}
      <section className="hero-bg relative overflow-hidden rounded-3xl p-6 text-white shadow-md sm:p-10">
        <span className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-gold/15" />
        <div className="relative">
          <p className="text-sm text-white/75">Welcome back</p>
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-5xl">Hi, {firstName}</h1>
          <p className="mt-2 max-w-lg text-white/85">What are you looking for today? Compare nearby shops by price and stock.</p>
          <Link href="/search" className={buttonClass({ variant: 'accent', className: 'mt-5 !px-6 !py-3' })}>
            <Search size={18} /> Find shops near me
          </Link>
        </div>
      </section>

      {/* Quick stats */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="card card-link flex items-center gap-4 p-4 no-underline">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-brand-2">{s.icon}</span>
            <div className="leading-tight">
              <p className="font-display text-3xl font-extrabold">{s.value}</p>
              <p className="text-sm text-muted">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {/* Categories */}
          <section>
            <SectionTitle icon={<ShoppingBasket size={26} />}>Shop by category</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CATEGORIES.map(c => (
                <Link key={c.label} href={`/search?q=${encodeURIComponent(c.q)}`} className="card card-link flex flex-col items-center gap-2 p-4 text-center no-underline">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-brand-2">{c.icon}</span>
                  <span className="text-sm font-semibold">{c.label}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent activity */}
          <section>
            <SectionTitle icon={<Receipt size={26} />}>Recent orders</SectionTitle>
            {(!recent || recent.length === 0) && (
              <div className="card p-8 text-center text-muted">No orders yet — your first one will show up here.</div>
            )}
            <div className="grid gap-3">
              {recent?.map(o => (
                <Link key={o.id} href={`/orders/${o.id}`} className="card card-link flex flex-wrap items-center justify-between gap-3 p-4 no-underline">
                  <div>
                    <p className="font-semibold">{(o.shops as unknown as { shop_name: string } | null)?.shop_name ?? 'Shop'}</p>
                    <p className="text-xs text-muted">
                      {new Date(o.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ₹{o.total_amount}
                    </p>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={statusStyle(o.status)}>
                    {CUSTOMER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </Link>
              ))}
            </div>
            {recent && recent.length > 0 && (
              <Link href="/orders" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-heading underline">
                See all orders <ArrowRight size={14} />
              </Link>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Shop owner card */}
          {shop ? (
            <section className="hero-bg rounded-3xl p-6 text-white shadow-md">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Store size={24} /></span>
              <p className="text-sm text-white/75">Your shop</p>
              <h2 className="font-display text-2xl font-extrabold text-white">{shop.shop_name}</h2>
              <p className="mt-1 text-sm text-white/80">
                {shop.status === 'approved' ? (shop.is_open ? 'Live and taking orders' : 'Live — currently not taking orders')
                  : shop.status === 'pending' ? 'Waiting for admin approval' : 'Needs changes — see details'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/dashboard/shop-owner" className={buttonClass({ variant: 'accent' })}>Visit your shop</Link>
                <Link href="/dashboard/shop-owner/orders" className="inline-flex items-center rounded-full border-[1.5px] border-white/60 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-white/10">
                  <Settings size={15} className="mr-1.5" /> Orders
                </Link>
              </div>
            </section>
          ) : (
            <section className="card relative overflow-hidden p-6">
              <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold/25" />
              <span className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-brand-2"><Store size={24} /></span>
              <h2 className="relative text-xl font-bold">Own a shop?</h2>
              <p className="relative mt-1 text-sm text-muted">
                Sell on GharKePaas and let neighbours find you. Set up with this same account — an admin reviews it before it goes live.
              </p>
              <Link href="/dashboard/shop-owner/onboarding" className={buttonClass({ className: 'relative mt-4' })}>
                Become a Shop Owner <ArrowRight size={15} />
              </Link>
            </section>
          )}

          {/* New shops */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Users size={20} className="text-brand-2" /> New on GharKePaas</h2>
            <div className="grid gap-3">
              {(!newShops || newShops.length === 0) && <div className="card p-5 text-sm text-muted">No shops yet — check back soon.</div>}
              {newShops?.map(s => {
                const photo = publicUrl(BUCKETS.shopPhotos, s.shop_photo_url)
                return (
                  <Link key={s.id} href={`/shop/${s.id}`} className="card card-link flex items-center gap-3 p-3 no-underline">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={s.shop_name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="hero-bg font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl font-extrabold text-white">
                        {s.shop_name.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.shop_name}</p>
                      <p className="truncate text-xs text-muted">{s.category} · {s.city}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
