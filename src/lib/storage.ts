// DESTINATION: src/lib/storage.ts  (new file, same folder as shopHours.ts)
import type { SupabaseClient } from '@supabase/supabase-js'

// The three storage areas created by photos_and_id_uploads.sql
export const BUCKETS = {
  shopPhotos: 'shop-photos',       // public
  productImages: 'product-images', // public
  idProofs: 'id-proofs',           // PRIVATE — owner + admin only
} as const
export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]
export type PublicBucket = typeof BUCKETS.shopPhotos | typeof BUCKETS.productImages

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_MB = 15 // a phone photo, before it is shrunk
export const MAX_PDF_MB = 5
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // what the storage area accepts

export type FileKind = 'image' | 'image-or-pdf'

// Turns a stored file location into the web address of a PUBLIC picture.
// (Private ID proofs have no public address — an admin opens them through a
// short-lived link instead.)
export function publicUrl(bucket: PublicBucket, path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('/') || path.split('/').includes('..')) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
}

// Checks a chosen file BEFORE doing any work with it.
export function validateFile(file: { type: string; size: number; name: string }, kind: FileKind): string | null {
  const isPdf = file.type === 'application/pdf'
  const isImage = IMAGE_TYPES.includes(file.type)
  if (!isImage && !(isPdf && kind === 'image-or-pdf')) {
    return kind === 'image-or-pdf'
      ? 'Please choose a JPG, PNG or WebP photo, or a PDF.'
      : 'Please choose a JPG, PNG or WebP photo.'
  }
  if (file.size === 0) return 'That file is empty.'
  if (isPdf && file.size > MAX_PDF_MB * 1024 * 1024) return `That PDF is larger than ${MAX_PDF_MB} MB.`
  if (isImage && file.size > MAX_IMAGE_MB * 1024 * 1024) return `That photo is larger than ${MAX_IMAGE_MB} MB.`
  return null
}

// Every upload goes in the uploader's OWN folder, under a fresh random name —
// the folder is what the storage rules check, the random name means a replaced
// picture always gets a new address (so nobody sees a stale cached copy).
export function buildObjectPath(userId: string, ext: string, id: string): string {
  return `${userId}/${id}.${ext}`
}

// A fresh random name for every upload. crypto.randomUUID() only exists on
// https pages and localhost — on a plain http address (e.g. testing from a
// phone over Wi-Fi) it is missing, so fall back to random bytes, which work
// everywhere.
export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function friendlyUploadError(message: string): string {
  const m = (message || '').toLowerCase()
  if (m.includes('bucket not found')) return 'Photo storage is not set up yet. (Run photos_and_id_uploads.sql in Supabase.)'
  if (m.includes('row-level security') || m.includes('not authorized') || m.includes('unauthorized'))
    return 'You are not allowed to upload here. Please log in again and retry.'
  if (m.includes('mime') || m.includes('not supported') || m.includes('invalid file type')) return 'That file type is not allowed.'
  if (m.includes('exceed') || m.includes('too large') || m.includes('payload')) return 'That file is too large.'
  if (m.includes('already exists') || m.includes('duplicate')) return 'That file was already uploaded — please try again.'
  return 'The upload failed. Please check your connection and try again.'
}

// ───────────── browser-only from here (uses canvas) ─────────────

const SHRINK = {
  [BUCKETS.shopPhotos]: { maxDim: 1280, quality: 0.82 },
  [BUCKETS.productImages]: { maxDim: 800, quality: 0.8 },
  [BUCKETS.idProofs]: { maxDim: 2000, quality: 0.85 }, // keep ID text readable
} as const

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close?.() }
    } catch {
      // fall through to the <img> route (older browsers)
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('decode'))
      i.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('We could not read that photo. Try a JPG or PNG instead.')
  }
}

// Phone photos are 3-8 MB; this makes them a few hundred KB as JPEG.
async function shrinkImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  const { source, width, height, done } = await decodeImage(file)
  try {
    const scale = Math.min(1, maxDim / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('We could not process that photo.')
    ctx.fillStyle = '#fff' // PNGs with transparency would otherwise turn black as JPEG
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(source, 0, 0, w, h)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('We could not process that photo.'))), 'image/jpeg', quality)
    )
  } finally {
    done()
  }
}

// Uploads one file for the CURRENT logged-in user and returns where it was stored.
export async function uploadForCurrentUser(
  supabase: SupabaseClient,
  bucket: BucketName,
  file: File
): Promise<{ path: string; name: string }> {
  const problem = validateFile(file, bucket === BUCKETS.idProofs ? 'image-or-pdf' : 'image')
  if (problem) throw new Error(problem)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Please log in again to upload.')

  let body: Blob = file
  let contentType = file.type
  let ext = 'pdf'
  if (file.type !== 'application/pdf') {
    const rule = SHRINK[bucket]
    body = await shrinkImage(file, rule.maxDim, rule.quality)
    contentType = 'image/jpeg'
    ext = 'jpg'
  }
  if (body.size > MAX_UPLOAD_BYTES) throw new Error('That file is still too large — please choose a smaller one.')

  const path = buildObjectPath(user.id, ext, randomId())
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    cacheControl: '31536000', // safe: every upload has a brand-new address
    upsert: false,
  })
  if (error) throw new Error(friendlyUploadError(error.message))
  return { path, name: file.name }
}

// Best effort — a failed clean-up must never break what the user was doing.
export async function removeFiles(supabase: SupabaseClient, bucket: BucketName, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p)
  if (list.length === 0) return
  try {
    await supabase.storage.from(bucket).remove(list)
  } catch {
    // ignore
  }
}
