// DESTINATION: src/app/dashboard/shop-owner/page.tsx  (replaces the existing file)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, CircleCheck, CircleX, Eye, Hourglass, Package, Pencil, PlusCircle, Store, TriangleAlert } from 'lucide-react'
import { addProduct, editProduct, toggleAvailability, deleteProduct, toggleShopOpen } from './actions'
import { buttonClass } from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { ProductRow } from '@/components/shop/ProductRow'
import { AddProductForm } from '@/components/shop/AddProductForm'
import { BUCKETS, publicUrl } from '@/lib/storage'
import { hoursLabel, openStatus } from '@/lib/shopHours'

export default async function ShopOwnerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shop } = await supabase.from('shops').select('*').eq('owner_id', user.id).maybeSingle()

  if (!shop) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Store size={44} className="mx-auto mb-4 text-brand-2" />
        <h1 className="mb-2 text-2xl font-bold">You haven&apos;t set up a shop yet</h1>
        <p className="mb-6 text-muted">It takes a few minutes. An admin reviews new shops before they go live.</p>
        <Link href="/dashboard/shop-owner/onboarding" className={buttonClass()}>Set up my shop</Link>
      </div>
    )
  }

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  const { data: openNowData, error: openNowError } = await supabase.rpc('shop_is_open_now', {
    p_is_open: shop.is_open,
    p_opens_at: shop.opens_at,
    p_closes_at: shop.closes_at,
  })
  const openNow = openNowError ? shop.is_open : openNowData === true
  const status = openStatus({ switchOn: shop.is_open, openNow, opens: shop.opens_at, closes: shop.closes_at })
  const hours = hoursLabel(shop.opens_at, shop.closes_at)

  const { data: doc } = await supabase.from('shop_documents').select('id_proof_name').eq('shop_id', shop.id).maybeSingle()
  const shopPhoto = publicUrl(BUCKETS.shopPhotos, shop.shop_photo_url)
  const missing = [!shopPhoto && 'a shop photo', !doc && 'your ID proof'].filter(Boolean) as string[]
  const initial = shop.shop_name.trim().charAt(0).toUpperCase()

  const approvalBadge =
    shop.status === 'approved'
      ? { label: 'Approved', icon: <CircleCheck size={14} />, cls: 'bg-ok-bg text-ok' }
      : shop.status === 'pending'
        ? { label: 'Pending approval', icon: <Hourglass size={14} />, cls: 'bg-warn-bg text-warn' }
        : { label: 'Not approved', icon: <CircleX size={14} />, cls: 'bg-danger-bg text-danger' }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* ── Profile header ── */}
      <section className="hero-bg relative overflow-hidden rounded-3xl p-5 text-white shadow-md sm:p-8">
        <span className="font-display pointer-events-none absolute -right-4 -top-10 select-none text-[12rem] font-extrabold leading-none text-white/[0.06]">
          {initial}
        </span>
        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-5">
          {shopPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shopPhoto} alt={shop.shop_name} className="h-24 w-24 shrink-0 rounded-full object-cover ring-4 ring-white/30 sm:h-28 sm:w-28" />
          ) : (
            <div className="font-display flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white/15 text-5xl font-extrabold ring-4 ring-white/30 sm:h-28 sm:w-28">
              {initial}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <span className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${approvalBadge.cls}`}>
              {approvalBadge.icon} {approvalBadge.label}
            </span>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">{shop.shop_name}</h1>
            <p className="mt-1 text-sm text-white/80">{shop.category} · {shop.city}</p>
          </div>

          {/* Open / closed switch */}
          {shop.status === 'approved' && (
            <form action={toggleShopOpen} className="w-full sm:w-auto">
              <input type="hidden" name="shopId" value={shop.id} />
              <input type="hidden" name="current" value={String(shop.is_open)} />
              <button
                type="submit"
                aria-label={shop.is_open ? 'Stop taking orders' : 'Start taking orders'}
                className="flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-white/12 px-5 py-4 text-left backdrop-blur transition-colors hover:bg-white/20 sm:w-auto"
              >
                <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${status.isOpen ? 'bg-gold' : 'bg-white/30'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${shop.is_open ? 'left-6' : 'left-1'}`} />
                </span>
                <span className="leading-tight">
                  <span className="block text-base font-bold">{status.isOpen ? 'Currently Open' : 'Currently Closed'}</span>
                  <span className="block text-xs text-white/75">
                    {shop.is_open ? 'Tap to stop taking orders' : 'Tap to start taking orders'}
                  </span>
                </span>
              </button>
            </form>
          )}
        </div>

        {shop.status === 'approved' && (
          <p className="relative mt-4 flex flex-wrap items-center gap-x-2 text-sm text-white/80">
            <Clock size={15} />
            {[status.detail, hours ? `Hours: ${hours}` : 'No fixed hours'].filter(Boolean).join(' · ')}
            <Link href="/dashboard/shop-owner/edit" className="ml-1 font-semibold text-gold underline">Change hours</Link>
          </p>
        )}
      </section>

      {/* ── Action buttons ── */}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/dashboard/shop-owner/orders" className={buttonClass({ variant: 'primary' })}>
          <Package size={17} /> View Orders
        </Link>
        <Link href="/dashboard/shop-owner/edit" className={buttonClass({ variant: 'ghost' })}>
          <Pencil size={17} /> Edit Shop Details
        </Link>
        {shop.status === 'approved' && (
          <Link href={`/shop/${shop.id}`} className={buttonClass({ variant: 'outline' })}>
            <Eye size={17} /> See Customer View
          </Link>
        )}
      </div>

      {/* ── Notices ── */}
      {shop.status === 'pending' && (
        <div className="mt-5 flex gap-3 rounded-2xl bg-warn-bg p-4 text-sm text-warn">
          <Hourglass size={20} className="mt-0.5 shrink-0" />
          <p>
            {shop.submission_count > 1 ? 'Your shop was resubmitted and is awaiting admin approval again. ' : 'Your shop is awaiting admin approval. '}
            You can still add products now — they&apos;ll be visible once approved.
          </p>
        </div>
      )}

      {shop.status !== 'approved' && missing.length > 0 && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-warn-bg p-4 text-sm text-warn">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">The admin still needs {missing.join(' and ')}</p>
            <p className="mt-1">Shops can&apos;t be verified without them. Your ID proof is private — only you and the GKP admin can open it.</p>
            <Link href="/dashboard/shop-owner/edit" className="mt-1 inline-block font-semibold underline">Add them in Edit Shop Details</Link>
          </div>
        </div>
      )}

      {shop.status === 'rejected' && (
        <div className="mt-4 rounded-2xl border border-danger/40 bg-danger-bg p-5 text-danger">
          <p className="flex items-center gap-2 font-bold"><CircleX size={18} /> Your shop was not approved</p>
          <p className="mt-1 text-sm">Reason from the admin: {shop.rejection_note || 'No reason was given.'}</p>
          <Link href="/dashboard/shop-owner/edit" className={buttonClass({ className: 'mt-3' })}>Fix details &amp; resubmit</Link>
        </div>
      )}

      {/* ── Products: grid on the left, sticky add-form on the right ── */}
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        <section className="lg:order-2 lg:sticky lg:top-24">
          <SectionTitle icon={<PlusCircle size={26} />}>Add Product</SectionTitle>
          <div className="card p-5 shadow-sm">
            <AddProductForm shopId={shop.id} addProduct={addProduct} />
          </div>
        </section>

        <section className="lg:order-1">
          <SectionTitle icon={<Package size={26} />} count={products?.length ?? 0}>Your Products</SectionTitle>
          {(!products || products.length === 0) && (
            <div className="card p-6 text-muted">No products yet — add your first one using the form.</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {products?.map(p => (
              <ProductRow key={p.id} product={p} editProduct={editProduct} toggleAvailability={toggleAvailability} deleteProduct={deleteProduct} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
