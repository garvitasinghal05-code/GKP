// DESTINATION: src/components/ui/EmptyCartArt.tsx  (new file)
// A friendly basket illustration. Colours come from the theme, so it works in light and dark.
export function EmptyCartArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 210" className={className} role="img" aria-label="An empty shopping basket" fill="none">
      <ellipse cx="130" cy="190" rx="92" ry="11" fill="var(--line)" />
      <circle cx="46" cy="64" r="5" fill="var(--mint)" stroke="var(--teal-2)" strokeWidth="2" />
      <circle cx="214" cy="96" r="4" fill="var(--gold)" />
      <path d="M222 44v14M215 51h14" stroke="var(--teal-2)" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 122v10M33 127h10" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="188" cy="48" r="16" fill="var(--gold)" />
      <circle cx="188" cy="48" r="11" stroke="#0B4438" strokeOpacity=".25" strokeWidth="2" />
      <text x="188" y="54" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0B4438">₹</text>
      <path d="M88 98C88 40 172 40 172 98" stroke="var(--gold)" strokeWidth="9" strokeLinecap="round" />
      <path d="M52 104h156l-18 76q-2 8-10 8H80q-8 0-10-8z" fill="var(--teal-1)" />
      <rect x="44" y="92" width="172" height="18" rx="9" fill="var(--teal-2)" />
      <path d="M98 116v58M130 116v58M162 116v58" stroke="#fff" strokeOpacity=".28" strokeWidth="5" strokeLinecap="round" />
      <path d="M112 150q18 14 36 0" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
