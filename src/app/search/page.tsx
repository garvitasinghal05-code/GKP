// DESTINATION: src/app/search/page.tsx  (replaces the existing file)
'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { Building2, House, MapPin, Navigation, Search as SearchIcon, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  type ShopResult,
  type SortBy,
  applyFiltersAndSort,
  escapeHtml,
  formatPrice,
  hasProductMatches as anyProductMatches,
  resolveSort,
  stockInfo,
} from '@/lib/searchResults'
import { BUCKETS, publicUrl } from '@/lib/storage'

type ViewMode = 'grid' | 'map' | 'split'

type SearchContext =
  | { kind: 'coords'; label: string; lat: number; lng: number }
  | { kind: 'area'; label: string }
  | null

declare global {
  interface Window { L: any }
}

function ResultCard({ shop }: { shop: ShopResult }) {
  const best = shop.matched_products?.[0]
  const more = (shop.match_count ?? 0) - 1
  const stock = best ? stockInfo(best) : null
  const shopPhoto = publicUrl(BUCKETS.shopPhotos, shop.shop_photo_url)
  const productImage = publicUrl(BUCKETS.productImages, best?.image_url)
  const initial = shop.shop_name.trim().charAt(0).toUpperCase()

  return (
    <Link href={`/shop/${shop.shop_id}`} className="card card-link flex h-full flex-col overflow-hidden no-underline">
      <div className="hero-bg relative h-32 overflow-hidden">
        {shopPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shopPhoto} alt={shop.shop_name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display absolute inset-0 flex select-none items-center justify-center text-6xl font-extrabold text-white/20">
            {initial}
          </span>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${
            shop.is_open ? 'bg-gold text-[#0B4438]' : 'bg-white/90 text-[#C1440E]'
          }`}
        >
          {shop.is_open ? 'Open' : 'Closed'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-bold leading-tight">{shop.shop_name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {shop.category}
            {shop.distance_km != null && ` · ${shop.distance_km} km away`}
            {' · ★ '}{shop.rating ? shop.rating.toFixed(1) : '—'}
          </p>
        </div>

        {best && stock && (
          <div className="mt-auto flex items-center gap-3 rounded-xl bg-mint p-3">
            {productImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productImage} alt={best.name} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{best.name}</span>
                <span className="whitespace-nowrap text-base font-bold text-heading">
                  {formatPrice(best.price)}
                  <span className="text-xs font-medium text-muted"> / {best.unit}</span>
                </span>
              </div>
              <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: stock.color, background: stock.bg }}>
                {stock.text}
              </span>
              {more > 0 && <span className="ml-2 text-xs text-muted">+{more} more matching item{more > 1 ? 's' : ''}</span>}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

export default function SearchPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [searchedTerm, setSearchedTerm] = useState('')

  const [searchContext, setSearchContext] = useState<SearchContext>(null)
  const [activePanel, setActivePanel] = useState<'area' | 'saved' | null>(null)
  const [areaText, setAreaText] = useState('')
  const [savedAddresses, setSavedAddresses] = useState<
    { id: string; label: string; full_address: string; lat: number; lng: number }[]
  >([])

  const [radiusKm, setRadiusKm] = useState(5)
  const [sortBy, setSortBy] = useState<SortBy>('distance')
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [results, setResults] = useState<ShopResult[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<ViewMode>('grid')
  const [leafletReady, setLeafletReady] = useState(false)

  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) setLeafletReady(true)
  }, [])

  // Category shortcuts on the home page link here as /search?q=Bakery
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setQuery(q)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.rpc('get_my_addresses')
      setSavedAddresses(data ?? [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function shareMyLocation() {
    setError('')
    setActivePanel(null)
    setSearchContext(null)
    if (!navigator.geolocation) {
      setError('Your browser does not support location detection.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => setSearchContext({ kind: 'coords', label: 'Current location', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('Could not get your location. Please allow location access in your browser and try again.')
    )
  }

  function useThisArea() {
    if (!areaText.trim()) return
    setError('')
    setSearchContext({ kind: 'area', label: areaText.trim() })
    setActivePanel(null)
  }

  function pickSavedAddress(addr: { label: string; full_address: string; lat: number; lng: number }) {
    setError('')
    setSearchContext({ kind: 'coords', label: addr.label, lat: addr.lat, lng: addr.lng })
    setActivePanel(null)
  }

  async function handleSearch(e?: { preventDefault: () => void }) {
    e?.preventDefault()
    if (!searchContext) {
      setError('Please set a location first — use one of the options above.')
      return
    }
    const term = query.trim()
    setLoading(true)
    setError('')

    const { data, error } =
      searchContext.kind === 'coords'
        ? await supabase.rpc('get_nearby_shops', { lat: searchContext.lat, lng: searchContext.lng, radius_km: radiusKm, search_term: term || null })
        : await supabase.rpc('get_shops_by_area', { p_area: searchContext.label, p_search_term: term || null })

    setLoading(false)
    setSearched(true)
    if (error) return setError(error.message)
    setSearchedTerm(term)
    setResults(data ?? [])
  }

  const isAreaMode = searchContext?.kind === 'area'
  const hasProductMatches = anyProductMatches(results)
  const effectiveSort: SortBy = resolveSort(sortBy, hasProductMatches, isAreaMode)

  const visibleResults = useMemo(
    () => applyFiltersAndSort(results, { openNowOnly, inStockOnly, sort: effectiveSort }),
    [results, openNowOnly, inStockOnly, effectiveSort]
  )

  const anyFilterOn = openNowOnly || (inStockOnly && hasProductMatches)
  const hiddenCount = results.length - visibleResults.length

  // Which location button is "on"
  const gpsActive = searchContext?.kind === 'coords' && searchContext.label === 'Current location'
  const areaActive = activePanel === 'area' || searchContext?.kind === 'area'
  const savedActive = activePanel === 'saved' || (searchContext?.kind === 'coords' && searchContext.label !== 'Current location')

  useEffect(() => {
    if (view === 'grid' || !leafletReady || !mapDivRef.current) return

    const L = window.L
    if (!mapObjRef.current) {
      mapObjRef.current = L.map(mapDivRef.current, { scrollWheelZoom: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapObjRef.current)
    }

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (visibleResults.length > 0) {
      visibleResults.forEach(shop => {
        const distanceLine = shop.distance_km != null ? ` · ${shop.distance_km} km` : ''
        const best = shop.matched_products?.[0]
        const stock = best ? stockInfo(best) : null
        const productLine = best && stock
          ? `<br/><span style="font-size:.82rem;">${escapeHtml(best.name)} — <strong>${escapeHtml(formatPrice(best.price))}</strong>
               <span style="color:${stock.color};font-weight:700;"> · ${escapeHtml(stock.text)}</span></span>`
          : ''
        const popupHtml = `
          <a href="/shop/${encodeURIComponent(shop.shop_id)}" style="display:block;text-decoration:none;color:#14231F;min-width:170px;">
            <strong>${escapeHtml(shop.shop_name)}</strong><br/>
            <span style="font-size:.82rem;color:${shop.is_open ? '#1E8E5A' : '#C1440E'};font-weight:700;">${shop.is_open ? 'Open' : 'Closed'}</span>
            <span style="font-size:.82rem;color:#5F6F6A;">${distanceLine} · ★ ${shop.rating ? shop.rating.toFixed(1) : '—'}</span>
            ${productLine}
          </a>`
        const marker = L.marker([shop.latitude, shop.longitude]).addTo(mapObjRef.current).bindPopup(popupHtml)
        markersRef.current.push(marker)
      })
      const bounds = L.latLngBounds(visibleResults.map(s => [s.latitude, s.longitude]))
      mapObjRef.current.fitBounds(bounds, { padding: [30, 30] })
    } else if (searchContext?.kind === 'coords') {
      mapObjRef.current.setView([searchContext.lat, searchContext.lng], 13)
    }

    setTimeout(() => mapObjRef.current?.invalidateSize(), 60)
  }, [view, leafletReady, visibleResults, searchContext])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" onLoad={() => setLeafletReady(true)} />

      {/* ── Search card: coloured header + form body, clearly separate from results ── */}
      <section className="card mb-8 overflow-hidden shadow-md">
        <div className="hero-bg px-5 py-7 sm:px-8 sm:py-9">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">Find shops near you</h1>
          <p className="mt-2 text-base text-white/85 sm:text-lg">
            Search for a product and compare price and stock across nearby shops.
          </p>
        </div>

        <div className="p-5 sm:p-7">
          <Input
            label="What are you looking for?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(e) }}
            placeholder="e.g. Amul milk — see which shops have it, at what price"
          />

          <p className="mb-2 text-sm font-semibold">Location</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={shareMyLocation} aria-pressed={gpsActive} className="chip">
              <Navigation size={16} /> Share my location
            </button>
            <button type="button" onClick={() => setActivePanel(activePanel === 'area' ? null : 'area')} aria-pressed={areaActive} className="chip">
              <Building2 size={16} /> Enter an area
            </button>
            {savedAddresses.length > 0 && (
              <button type="button" onClick={() => setActivePanel(activePanel === 'saved' ? null : 'saved')} aria-pressed={savedActive} className="chip">
                <House size={16} /> Saved address
              </button>
            )}
          </div>

          {activePanel === 'area' && (
            <div className="mb-3">
              <div className="mb-1.5 flex gap-2">
                <input
                  value={areaText}
                  onChange={e => setAreaText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); useThisArea() } }}
                  placeholder="e.g. Kanti Nagar, Gwalior  or  474001"
                  className="field flex-1"
                />
                <Button type="button" variant="ghost" onClick={useThisArea}>Use this area</Button>
              </div>
              <p className="text-xs text-muted">
                Matches the area, address, city or PIN code that shop owners entered. You can type several words, like “Kanti Nagar, Gwalior”.
              </p>
            </div>
          )}

          {activePanel === 'saved' && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {savedAddresses.map(addr => (
                <button key={addr.id} type="button" onClick={() => pickSavedAddress(addr)} className="pick-card p-3 text-sm">
                  <strong>{addr.label}</strong>
                  <span className="text-muted"> — {addr.full_address}</span>
                </button>
              ))}
            </div>
          )}

          {searchContext && (
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-heading">
              <MapPin size={16} /> Searching {searchContext.kind === 'area' ? 'in area' : 'near'}: {searchContext.label}
            </p>
          )}

          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
            <Button disabled={loading}>
              <SearchIcon size={16} /> {loading ? 'Searching…' : 'Search'}
            </Button>
            {!isAreaMode && (
              <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))} className="field !w-auto">
                <option value={1}>Within 1 km</option>
                <option value={2}>Within 2 km</option>
                <option value={5}>Within 5 km</option>
                <option value={10}>Within 10 km</option>
              </select>
            )}
          </form>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      </section>

      {/* ── Results ── */}
      {searched && results.length > 0 && (
        <>
          {hasProductMatches && searchedTerm && (
            <p className="mb-3 rounded-xl bg-mint px-4 py-2.5 text-sm text-heading">
              Showing the price and stock of <strong>“{searchedTerm}”</strong> at each shop — the cheapest in-stock match is shown.
            </p>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setOpenNowOnly(v => !v)} aria-pressed={openNowOnly} className="chip">Open now</button>
            {hasProductMatches && (
              <button type="button" onClick={() => setInStockOnly(v => !v)} aria-pressed={inStockOnly} className="chip">In stock</button>
            )}
            {anyFilterOn && (
              <button type="button" onClick={() => { setOpenNowOnly(false); setInStockOnly(false) }} className="cursor-pointer text-sm font-semibold text-heading underline">
                Clear filters
              </button>
            )}
          </div>
        </>
      )}

      {searched && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">
              {visibleResults.length} shop{visibleResults.length !== 1 ? 's' : ''} found
              {hiddenCount > 0 && ` · ${hiddenCount} hidden by filters`}
            </p>
            {results.length > 0 && (
              <select value={effectiveSort} onChange={e => setSortBy(e.target.value as SortBy)} className="field !w-auto !py-1.5 !text-sm">
                {!isAreaMode && <option value="distance">Sort: Nearest first</option>}
                <option value="rating">Sort: Highest rated</option>
                {hasProductMatches && <option value="price_low">Sort: Price, low to high</option>}
                {hasProductMatches && <option value="price_high">Sort: Price, high to low</option>}
              </select>
            )}
          </div>
          <div className="inline-flex rounded-full bg-mint p-1">
            {(['grid', 'map', 'split'] as ViewMode[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  view === v ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {v === 'grid' ? 'Cards' : v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && view === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleResults.map(shop => <ResultCard key={shop.shop_id} shop={shop} />)}
        </div>
      )}

      <div className="gap-4" style={{ display: searched && (view === 'map' || view === 'split') ? 'flex' : 'none', height: '65vh' }}>
        {view === 'split' && (
          <div className="flex w-[38%] flex-col gap-3 overflow-y-auto pr-1">
            {visibleResults.map(shop => <ResultCard key={shop.shop_id} shop={shop} />)}
          </div>
        )}
        <div ref={mapDivRef} className="flex-1 rounded-2xl border border-line" />
      </div>

      {!loading && searched && results.length > 0 && visibleResults.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          No shops match these filters.{' '}
          <button type="button" onClick={() => { setOpenNowOnly(false); setInStockOnly(false) }} className="cursor-pointer font-semibold text-heading underline">
            Clear filters
          </button>
        </p>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <div className="card flex items-start gap-3 p-6 text-sm text-muted">
          <Store size={20} className="mt-0.5 shrink-0 text-brand-2" />
          <p>
            {isAreaMode
              ? `No shops found for "${searchContext?.label}"${searchedTerm ? ` selling or matching “${searchedTerm}”` : ''}. Try fewer words (just the area name), a different spelling, or the PIN code — or check back once more shops are approved.`
              : `No shops found within ${radiusKm} km of ${searchContext?.label}${searchedTerm ? ` for “${searchedTerm}”` : ''}. Try a larger radius, different words, or check back once more shops are approved.`}
          </p>
        </div>
      )}
    </div>
  )
}
