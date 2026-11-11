// DESTINATION: src/lib/productInput.ts  (new file, same folder as storage.ts)

export type ProductFields = {
  name: string
  price: number
  unit: string
  stock_qty: number
  imagePath: string | null // where the already-uploaded picture is stored, if any
}

type Result = { ok: true; value: ProductFields } | { ok: false; error: string }

// Checks what the product form sent, and says what is wrong in plain words.
// `userId` is the logged-in owner: a picture path is only accepted if it sits
// in that owner's own folder (so a form can't point at someone else's file).
export function parseProductFields(
  get: (key: string) => string | null | undefined,
  userId: string
): Result {
  const name = (get('name') ?? '').replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, error: 'Please enter the product name.' }
  if (name.length > 100) return { ok: false, error: 'The product name is too long (100 letters at most).' }

  const unit = (get('unit') ?? '').replace(/\s+/g, ' ').trim()
  if (!unit) return { ok: false, error: 'Please enter the unit (for example kg, piece, litre).' }
  if (unit.length > 30) return { ok: false, error: 'The unit is too long (30 letters at most).' }

  const priceRaw = (get('price') ?? '').trim()
  if (!priceRaw) return { ok: false, error: 'Please enter the price.' }
  const priceNum = Number(priceRaw)
  if (!Number.isFinite(priceNum) || priceNum < 0) return { ok: false, error: 'The price must be a number, 0 or more.' }
  if (priceNum > 1_000_000) return { ok: false, error: 'That price looks too high — please check it.' }
  const price = Math.round(priceNum * 100) / 100

  const stockRaw = (get('stock_qty') ?? '').trim()
  const stockNum = stockRaw === '' ? 0 : Number(stockRaw)
  if (!Number.isInteger(stockNum) || stockNum < 0) return { ok: false, error: 'Stock must be a whole number, 0 or more.' }
  if (stockNum > 1_000_000) return { ok: false, error: 'That stock number looks too high — please check it.' }

  const rawPath = (get('image_path') ?? '').trim()
  let imagePath: string | null = null
  if (rawPath) {
    const rest = rawPath.startsWith(userId + '/') ? rawPath.slice(userId.length + 1) : null
    if (rest === null || !/^[A-Za-z0-9._-]+$/.test(rest) || rest.includes('..')) {
      return { ok: false, error: 'That picture could not be used. Please choose it again.' }
    }
    imagePath = rawPath
  }

  return { ok: true, value: { name, price, unit, stock_qty: stockNum, imagePath } }
}
