// DESTINATION: src/lib/shopHours.ts  (new file, next to the cart/ and supabase/ folders)

// "21:00:00" or "21:00" -> "9:00 PM"
export function formatTime12(t: string | null | undefined): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (Number.isNaN(h) || Number.isNaN(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

// Matches the database rule: hours only count when BOTH are set and differ.
export function hasFixedHours(opens: string | null | undefined, closes: string | null | undefined): boolean {
  return !!opens && !!closes && opens.slice(0, 5) !== closes.slice(0, 5)
}

export function hoursLabel(opens: string | null | undefined, closes: string | null | undefined): string {
  return hasFixedHours(opens, closes) ? `${formatTime12(opens)} – ${formatTime12(closes)}` : ''
}

// Used by the owner forms: one box filled and the other empty is a mistake.
export function hoursError(opens: string, closes: string): string | null {
  if (!!opens !== !!closes) return 'Set both an opening time and a closing time, or leave both empty.'
  return null
}

// What to tell people. `switchOn` is the owner's on/off switch; `openNow` is
// the database's final answer (switch AND hours).
export function openStatus(args: {
  switchOn: boolean
  openNow: boolean
  opens: string | null | undefined
  closes: string | null | undefined
}): { isOpen: boolean; label: string; detail: string } {
  const { switchOn, openNow, opens, closes } = args
  if (openNow) {
    return {
      isOpen: true,
      label: 'Open now',
      detail: hasFixedHours(opens, closes) ? `Closes at ${formatTime12(closes)}` : '',
    }
  }
  if (!switchOn) {
    return { isOpen: false, label: 'Closed', detail: 'Not taking orders right now' }
  }
  return {
    isOpen: false,
    label: 'Closed',
    detail: hasFixedHours(opens, closes) ? `Opens at ${formatTime12(opens)}` : '',
  }
}
