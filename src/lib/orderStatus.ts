// DESTINATION: src/lib/orderStatus.ts  (new file)
import type { CSSProperties } from 'react'

export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  placed: 'Placed', confirmed: 'Confirmed', out_for_delivery: 'Out for Delivery',
  ready_for_pickup: 'Ready for Pickup', completed: 'Completed', rejected: 'Rejected',
  cancelled: 'Cancelled', expired: 'Expired',
}

export const SHOP_STATUS_LABELS: Record<string, string> = { ...CUSTOMER_STATUS_LABELS, placed: 'New' }

export const CLOSED_STATUSES = ['completed', 'rejected', 'cancelled', 'expired']
export const DEAD_STATUSES = ['rejected', 'cancelled', 'expired']

// Badge colours come from theme tokens, so they look right in light and dark mode.
export function statusStyle(status: string): CSSProperties {
  switch (status) {
    case 'placed':
    case 'confirmed': return { color: 'var(--heading)', background: 'var(--mint)' }
    case 'out_for_delivery':
    case 'ready_for_pickup': return { color: 'var(--warn)', background: 'var(--warn-bg)' }
    case 'completed': return { color: 'var(--ok)', background: 'var(--ok-bg)' }
    case 'rejected':
    case 'cancelled': return { color: 'var(--danger)', background: 'var(--danger-bg)' }
    default: return { color: 'var(--muted)', background: 'var(--mint)' }
  }
}
