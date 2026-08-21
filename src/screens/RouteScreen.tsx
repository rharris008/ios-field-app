// Route planner — shows assigned stores sorted by GPS proximity and visit priority.
// Requires ios_stores.latitude/longitude to be populated (via geocoding script).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type Priority = 'overdue' | 'due' | 'ok' | 'recent'

interface RouteStore {
  id: string
  retailer_name: string
  name: string
  suburb: string
  state: string
  latitude: number | null
  longitude: number | null
  visitedThisWeek: boolean
  lastVisitDays: number | null
  distanceKm: number | null
  priority: Priority
  visitFrequencyDays: number | null
}

const PRIORITY_ORDER: Record<Priority, number> = { overdue: 0, due: 1, ok: 2, recent: 3 }
const PRIORITY_STYLE: Record<Priority, string> = {
  overdue: 'bg-red-100 text-red-700',
  due:     'bg-amber-100 text-amber-700',
  ok:      'bg-gray-100 text-gray-500',
  recent:  'bg-green-100 text-green-700',
}
const PRIORITY_LABEL: Record<Priority, string> = {
  overdue: 'Overdue',
  due:     'Due soon',
  ok:      'OK',
  recent:  'Recent',
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function aestWeekStart() {
  const now = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' }))
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  now.setDate(diff)
  return now.toISOString().split('T')[0]
}

export function RouteScreen() {
  const { repProfile } = useAuth()
  const navigate = useNavigate()
  const [stores,    setStores]    = useState<RouteStore[]>([])
  const [repLat,    setRepLat]    = useState<number | null>(null)
  const [repLng,    setRepLng]    = useState<number | null>(null)
  const [gpsError,  setGpsError]  = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<Priority | 'all'>('all')

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError(true); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setRepLat(pos.coords.latitude); setRepLng(pos.coords.longitude) },
      ()  => setGpsError(true),
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }, [])

  useEffect(() => {
    if (!repProfile?.id) return
    loadStores(repProfile.id)
  }, [repProfile?.id, repLat, repLng])

  async function loadStores(repId: string) {
    setLoading(true)
    const weekStart = aestWeekStart()

    const { data: repStoreData } = await supabase
      .from('ios_rep_stores')
      .select('store_id, ios_stores(id, name, suburb, state, latitude, longitude, visit_frequency_days, ios_retailers(name))')
      .eq('rep_id', repId)

    type Row = {
      store_id: string
      ios_stores: {
        id: string; name: string; suburb: string; state: string
        latitude: number | null; longitude: number | null
        visit_frequency_days: number | null
        ios_retailers: { name: string } | null
      } | null
    }
    const rows = (repStoreData ?? []) as unknown as Row[]
    const storeIds = rows.map(r => r.store_id)

    let visitedThisWeek = new Set<string>()
    let lastVisitMap = new Map<string, string>()

    if (storeIds.length > 0) {
      const [weekRes, lastRes] = await Promise.all([
        supabase.from('ios_visits').select('store_id')
          .eq('rep_id', repId)
          .gte('checkin_at', `${weekStart}T00:00:00+10:00`)
          .in('store_id', storeIds),
        supabase.from('ios_visits').select('store_id, checkin_at')
          .eq('rep_id', repId)
          .in('store_id', storeIds)
          .order('checkin_at', { ascending: false }),
      ])
      visitedThisWeek = new Set((weekRes.data ?? []).map((v: { store_id: string }) => v.store_id))
      for (const v of (lastRes.data ?? []) as Array<{ store_id: string; checkin_at: string }>) {
        if (!lastVisitMap.has(v.store_id)) lastVisitMap.set(v.store_id, v.checkin_at)
      }
    }

    const routeStores: RouteStore[] = rows
      .filter(r => r.ios_stores)
      .map(r => {
        const s = r.ios_stores!
        const lastIso = lastVisitMap.get(r.store_id)
        const lastDays = lastIso ? Math.floor((Date.now() - new Date(lastIso).getTime()) / 86400000) : null
        const distKm = repLat !== null && repLng !== null && s.latitude !== null && s.longitude !== null
          ? haversineKm(repLat, repLng, s.latitude, s.longitude)
          : null

        let priority: Priority = 'ok'
        if (s.visit_frequency_days && lastDays !== null && lastDays > s.visit_frequency_days) {
          priority = 'overdue'
        } else if (s.visit_frequency_days && lastDays !== null && lastDays > s.visit_frequency_days * 0.75) {
          priority = 'due'
        } else if (lastDays !== null && lastDays <= 7) {
          priority = 'recent'
        }

        return {
          id:                 r.store_id,
          retailer_name:      s.ios_retailers?.name ?? '',
          name:               s.name,
          suburb:             s.suburb,
          state:              s.state,
          latitude:           s.latitude,
          longitude:          s.longitude,
          visitedThisWeek:    visitedThisWeek.has(r.store_id),
          lastVisitDays:      lastDays,
          distanceKm:         distKm,
          priority,
          visitFrequencyDays: s.visit_frequency_days,
        }
      })
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority]
        const pb = PRIORITY_ORDER[b.priority]
        if (pa !== pb) return pa - pb
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm
        if (a.distanceKm !== null) return -1
        if (b.distanceKm !== null) return 1
        return a.retailer_name.localeCompare(b.retailer_name)
      })

    setStores(routeStores)
    setLoading(false)
  }

  const withCoords    = stores.filter(s => s.latitude !== null).length
  const noCoords      = stores.filter(s => s.latitude === null).length
  const filtered      = filter === 'all' ? stores : stores.filter(s => s.priority === filter)

  return (
    <div className="min-h-screen bg-ios-ltgrey" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="bg-ios-navy px-4 pt-5 pb-4">
        <p className="text-white font-bold text-lg">Route Planner</p>
        <p className="text-blue-300 text-xs mt-0.5">
          {gpsError ? 'Location unavailable — showing all stores' :
           repLat !== null ? `Sorted by distance from your location` : 'Getting your location...'}
        </p>
        {noCoords > 0 && withCoords > 0 && (
          <p className="text-blue-400 text-xs mt-0.5">{withCoords} stores with distance · {noCoords} without GPS data</p>
        )}
        {noCoords === stores.length && stores.length > 0 && (
          <p className="text-amber-300 text-xs mt-0.5">Store GPS data not yet loaded — distances will appear after geocoding runs</p>
        )}
      </div>

      {/* Priority filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {(['all', 'overdue', 'due', 'ok', 'recent'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${
              filter === f ? 'bg-ios-navy text-white border-ios-navy' : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            {f === 'all' ? `All (${stores.length})` : `${PRIORITY_LABEL[f]} (${stores.filter(s => s.priority === f).length})`}
          </button>
        ))}
      </div>

      <div className="px-4 pb-4 space-y-2">
        {loading ? (
          <p className="text-gray-400 text-sm text-center py-8">Loading stores...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No stores in this category.</p>
        ) : filtered.map((store, i) => (
          <button
            key={store.id}
            onClick={() => navigate('/check', { state: { preselectedStoreId: store.id } })}
            className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3.5 text-left shadow-sm flex items-center gap-3"
          >
            <span className="text-gray-400 text-xs font-bold w-5 shrink-0 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-ios-navy text-sm">{store.retailer_name} {store.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${PRIORITY_STYLE[store.priority]}`}>
                  {PRIORITY_LABEL[store.priority]}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">{store.suburb}, {store.state}</p>
              <div className="flex gap-3 mt-1">
                {store.distanceKm !== null && (
                  <span className="text-ios-blue text-xs">
                    {store.distanceKm < 1 ? `${Math.round(store.distanceKm * 1000)}m` : `${store.distanceKm.toFixed(1)} km`}
                  </span>
                )}
                {store.lastVisitDays !== null ? (
                  <span className={`text-xs ${store.lastVisitDays > 14 ? 'text-amber-500 font-bold' : 'text-gray-400'}`}>
                    {store.lastVisitDays === 0 ? 'Visited today' : `${store.lastVisitDays}d ago`}
                  </span>
                ) : (
                  <span className="text-red-400 text-xs font-bold">Never visited</span>
                )}
                {store.visitedThisWeek && (
                  <span className="text-green-600 text-xs font-bold">Done this week ✓</span>
                )}
              </div>
            </div>
            <span className="text-ios-blue text-xs font-bold shrink-0">Go →</span>
          </button>
        ))}
      </div>
    </div>
  )
}
