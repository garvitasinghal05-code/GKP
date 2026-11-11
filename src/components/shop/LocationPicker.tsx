// DESTINATION: src/components/shop/LocationPicker.tsx  (replaces the existing file)
'use client'

import { useEffect, useRef, useState } from 'react'
import { Crosshair, Hash, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export type LocationValue = { lat: number; lng: number; source: 'pin' | 'manual' }

declare global {
  interface Window {
    L: any
  }
}

type Mode = 'pin' | 'gps' | 'manual'

const DEFAULT_CENTER = { lat: 26.2183, lng: 78.1828 }

type Props = {
  onChange: (v: LocationValue) => void
  initialLat?: number
  initialLng?: number
  autoLocate?: boolean
}

// One shared way to set a location: drop a pin, use GPS, or type coordinates.
// The map stays on screen the whole time; the options only change the controls under it.
export function LocationPicker({ onChange, initialLat, initialLng, autoLocate = false }: Props) {
  const hasInitial = initialLat !== undefined && initialLng !== undefined

  const [mode, setMode] = useState<Mode>('pin')
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(
    hasInitial ? { lat: initialLat!, lng: initialLng! } : null
  )
  const [changed, setChanged] = useState(false)
  const [latText, setLatText] = useState(hasInitial ? initialLat!.toFixed(6) : '')
  const [lngText, setLngText] = useState(hasInitial ? initialLng!.toFixed(6) : '')
  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [manualError, setManualError] = useState('')
  const [libTick, setLibTick] = useState(0)

  const mapDiv = useRef<HTMLDivElement>(null)
  const mapObj = useRef<any>(null)
  const markerObj = useRef<any>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  function place(lat: number, lng: number, source: LocationValue['source'], recenter: boolean) {
    const map = mapObj.current
    const marker = markerObj.current
    if (!map || !marker) return
    marker.setLatLng([lat, lng])
    if (recenter) map.setView([lat, lng], 17)
    setPoint({ lat, lng })
    setChanged(true)
    setLatText(lat.toFixed(6))
    setLngText(lng.toFixed(6))
    onChangeRef.current({ lat, lng, source })
  }

  function locate() {
    setGpsError('')
    if (!navigator.geolocation) {
      setGpsError('Your browser does not support location detection.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        place(pos.coords.latitude, pos.coords.longitude, 'pin', true)
      },
      () => {
        setLocating(false)
        setGpsError('Could not get your location. Allow location access in your browser, or use another option.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    if (mapObj.current || !mapDiv.current) return
    const L = window.L
    if (!L) {
      const t = setTimeout(() => setLibTick(n => n + 1), 200)
      return () => clearTimeout(t)
    }

    const start = hasInitial ? { lat: initialLat!, lng: initialLng! } : DEFAULT_CENTER
    const map = L.map(mapDiv.current).setView([start.lat, start.lng], hasInitial ? 16 : 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
    const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map)

    marker.on('dragend', () => {
      const p = marker.getLatLng()
      place(p.lat, p.lng, 'pin', false)
    })
    map.on('click', (e: any) => place(e.latlng.lat, e.latlng.lng, 'pin', false))

    mapObj.current = map
    markerObj.current = marker
    setTimeout(() => map.invalidateSize(), 150)

    if (!hasInitial && autoLocate) locate()

    return () => {
      map.remove()
      mapObj.current = null
      markerObj.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libTick])

  function choose(m: Mode) {
    setMode(m)
    if (m === 'gps') locate()
  }

  function confirmManual() {
    const la = parseFloat(latText)
    const ln = parseFloat(lngText)
    if (isNaN(la) || isNaN(ln) || la < 6 || la > 37 || ln < 68 || ln > 97) {
      setManualError('Enter valid coordinates within India (latitude 6–37, longitude 68–97).')
      return
    }
    setManualError('')
    place(la, ln, 'manual', true)
  }

  const tabs: { key: Mode; title: string; hint: string; icon: React.ReactNode }[] = [
    { key: 'pin', title: 'Drop a pin', hint: 'Drag the pin or tap the map', icon: <MapPin size={20} /> },
    { key: 'gps', title: 'Use my location', hint: 'Uses your device’s GPS', icon: <Crosshair size={20} /> },
    { key: 'manual', title: 'Enter coordinates', hint: 'Type latitude and longitude', icon: <Hash size={20} /> },
  ]

  const status = !point
    ? 'Pin not set yet — drag the pin, tap the map, use your current location or type coordinates.'
    : !changed && hasInitial
      ? `Saved pin: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} — move it to change it.`
      : `Pin set at ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`

  return (
    <div>
      <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => choose(t.key)} className={`pick-card flex items-center gap-3 p-2.5 ${mode === t.key ? 'is-selected' : ''}`}>
            {t.icon}
            <span className="text-sm">
              <span className="block font-semibold">{t.title}</span>
              <span className="text-muted text-xs">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {/* isolate + z-0 keep the map's internal layers below the navbar */}
      <div ref={mapDiv} style={{ height: 300 }} className="relative isolate z-0 rounded-xl border border-line" />

      <p className="mb-3 mt-2 text-xs text-muted">{status}</p>

      {mode === 'pin' && <p className="text-xs text-muted">Drag the pin to your exact spot, or tap anywhere on the map to move it there.</p>}

      {mode === 'gps' && (
        <div>
          <Button type="button" variant="outline" onClick={locate} disabled={locating}>
            {locating ? 'Finding your location…' : 'Use my current location again'}
          </Button>
          {gpsError && <p className="mt-2 text-xs text-danger">{gpsError}</p>}
        </div>
      )}

      {mode === 'manual' && (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude" value={latText} onChange={e => setLatText(e.target.value)} placeholder="e.g. 26.2183" />
            <Input label="Longitude" value={lngText} onChange={e => setLngText(e.target.value)} placeholder="e.g. 78.1828" />
          </div>
          <Button type="button" variant="outline" onClick={confirmManual}>Use these coordinates</Button>
          {manualError && <p className="mt-2 text-xs text-danger">{manualError}</p>}
        </div>
      )}
    </div>
  )
}
