// DESTINATION: src/components/shop/HoursFields.tsx  (new file, same folder as LocationPicker.tsx)
'use client'

import { hoursError } from '@/lib/shopHours'

type Props = {
  opensAt: string
  closesAt: string
  onOpensAt: (v: string) => void
  onClosesAt: (v: string) => void
}

const boxClass =
  'w-full px-3.5 py-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[var(--teal-2)]'

// Optional opening hours, used by both shop setup and shop editing.
export function HoursFields({ opensAt, closesAt, onOpensAt, onClosesAt }: Props) {
  const problem = hoursError(opensAt, closesAt)

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-1.5">
        Opening hours <span className="font-normal text-gray-500">(optional)</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-xs text-gray-500">Opens</span>
          <input type="time" value={opensAt} onChange={e => onOpensAt(e.target.value)} className={boxClass} />
        </div>
        <div>
          <span className="text-xs text-gray-500">Closes</span>
          <input type="time" value={closesAt} onChange={e => onClosesAt(e.target.value)} className={boxClass} />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1.5">
        Leave both empty if you don&apos;t keep fixed hours. Hours past midnight work too (for example 10:00 PM to
        2:00 AM). Times are India time.
        {(opensAt || closesAt) && (
          <button
            type="button"
            onClick={() => { onOpensAt(''); onClosesAt('') }}
            className="ml-2 text-[var(--teal-1)] font-semibold"
          >
            Clear hours
          </button>
        )}
      </p>
      {problem && <p className="text-xs text-red-600 mt-1">{problem}</p>}
    </div>
  )
}
