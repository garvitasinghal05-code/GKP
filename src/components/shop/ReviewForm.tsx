// DESTINATION: src/components/shop/ReviewForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

export function ReviewForm({ shopId }: { shopId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (rating === 0) return setError('Please pick a star rating first.')
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return setError('You need to be logged in to leave a review.')
    }

    const { error } = await supabase.from('reviews').insert({
      reviewer_id: user.id,
      shop_id: shopId,
      rating,
      comment: comment.trim() || null,
    })

    setLoading(false)
    if (error) return setError(error.message)
    setSubmitted(true)
    router.refresh()
  }

  if (submitted) {
    return (
      <div style={{ background: '#EFF7F3', borderRadius: 10, padding: '1rem', marginTop: '1rem' }}>
        <p style={{ color: '#0B4438', fontWeight: 600 }}>Thanks — your review has been posted anonymously.</p>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #e3e9e6', borderRadius: 12, padding: '1rem', marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.3rem' }}>Rate this shop</h3>
      <p style={{ fontSize: '.8rem', color: '#888', marginBottom: '.7rem' }}>
        Your review is posted anonymously — the shop and other customers won&apos;t see your name.
      </p>

      <div style={{ fontSize: '1.8rem', marginBottom: '.7rem', cursor: 'pointer' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            style={{ color: star <= (hoverRating || rating) ? '#F2C230' : '#ddd' }}
          >
            ★
          </span>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Optional — what did you think?"
        rows={3}
        style={{ width: '100%', padding: '.6rem .8rem', border: '1.5px solid #ddd', borderRadius: 8, fontSize: '.88rem', marginBottom: '.7rem', fontFamily: 'inherit' }}
      />

      {error && <p style={{ color: '#C1440E', fontSize: '.85rem', marginBottom: '.6rem' }}>{error}</p>}

      <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Submitting…' : 'Submit Review'}</Button>
    </div>
  )
}
