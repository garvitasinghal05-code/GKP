// DESTINATION: src/lib/searchResults.ts  (new file, same folder as shopHours.ts)

export type MatchedProduct = {
  id: string
  name: string
  price: number
  unit: string
  stock_qty: number
  in_stock: boolean
  image_url?: string | null // storage path of the product picture, if any
}

export type ShopResult = {
  shop_id: string
  shop_name: string
  category: string
  is_open: boolean
  rating: number
  latitude: number
  longitude: number
  distance_km?: number // only present for GPS / saved-address searches
  match_count?: number // how many of this shop's products matched the search words
  matched_products?: MatchedProduct[] // best first: in-stock, then cheapest (max 3)
  shop_photo_url?: string | null // storage path of the shop photo, if any
}

export type SortBy = 'distance' | 'rating' | 'price_low' | 'price_high'

export function formatPrice(p: number | string): string {
  const n = Number(p)
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

// Same colour rules as the shop page: green plenty, amber 1-4 left, red none.
export function stockInfo(item: MatchedProduct): { text: string; color: string; bg: string } {
  if (!item.in_stock) return { text: 'Out of stock', color: '#D14343', bg: '#FBE6DD' }
  if (item.stock_qty <= 4) return { text: `Only ${item.stock_qty} left`, color: '#B8860B', bg: '#FDF3D7' }
  return { text: 'In stock', color: '#1E8E5A', bg: '#E6F5EC' }
}

// Anything typed by shop owners (names!) must be escaped before it goes into
// the map popup's HTML — otherwise a crafted shop name could run code in a
// customer's browser.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Rank for price sorting: shops with the item IN STOCK first (by price), then
// shops that only have it out of stock, then shops found by name with no
// matching product. (matched_products is already best-first from the database.)
export function priceRank(shop: ShopResult): { tier: number; price: number } {
  const best = shop.matched_products?.[0]
  if (!best) return { tier: 2, price: 0 }
  return { tier: best.in_stock ? 0 : 1, price: Number(best.price) }
}

export function hasProductMatches(results: ShopResult[]): boolean {
  return results.some(r => (r.matched_products?.length ?? 0) > 0)
}

// The sort that is really applied: options that don't make sense for the
// current results (distance in area mode, price with no product words)
// quietly fall back to something that does.
export function resolveSort(sortBy: SortBy, productMatches: boolean, isAreaMode: boolean): SortBy {
  if ((sortBy === 'price_low' || sortBy === 'price_high') && !productMatches) {
    return isAreaMode ? 'rating' : 'distance'
  }
  if (sortBy === 'distance' && isAreaMode) return 'rating'
  return sortBy
}

export function applyFiltersAndSort(
  results: ShopResult[],
  opts: { openNowOnly: boolean; inStockOnly: boolean; sort: SortBy }
): ShopResult[] {
  const productMatches = hasProductMatches(results)
  let list = [...results]
  if (opts.openNowOnly) list = list.filter(r => r.is_open)
  // "In stock" only means something when product words were searched.
  if (opts.inStockOnly && productMatches) list = list.filter(r => r.matched_products?.some(p => p.in_stock))

  const byDistanceOrRating = (a: ShopResult, b: ShopResult) =>
    a.distance_km !== undefined && b.distance_km !== undefined
      ? a.distance_km - b.distance_km
      : b.rating - a.rating

  list.sort((a, b) => {
    if (opts.sort === 'price_low' || opts.sort === 'price_high') {
      const pa = priceRank(a)
      const pb = priceRank(b)
      if (pa.tier !== pb.tier) return pa.tier - pb.tier
      if (pa.price !== pb.price) return opts.sort === 'price_low' ? pa.price - pb.price : pb.price - pa.price
      return byDistanceOrRating(a, b)
    }
    if (opts.sort === 'rating') return b.rating - a.rating
    return (a.distance_km ?? 0) - (b.distance_km ?? 0)
  })
  return list
}
