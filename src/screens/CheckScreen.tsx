import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { useVisit } from '../contexts/VisitContext'
import { useAuth } from '../contexts/AuthContext'
import { searchStores, getPendingCounts, db } from '../lib/db'
import { getPosition } from '../lib/gps'
import { supabase } from '../lib/supabase'
import { ActiveVisitPanel } from '../components/visit/ActiveVisitPanel'
import type { Store, VisitType } from '../types'

interface RepStats {
  today: number
  week: number
  pending: number
  overdueStores: Array<{ id: string; retailer_name: string; name: string; suburb: string; state: string; lastVisit: string | null }>
}

function aestDateString(date = new Date()) {
  return date.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

function aestWeekStart() {
  const now = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' }))
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
  now.setDate(diff)
  return now.toISOString().split('T')[0]
}

function useRepStats(repId: string | undefined) {
  const [stats, setStats] = useState<RepStats | null>(null)

  useEffect(() => {
    if (!repId) return
    load()
  }, [repId])

  async function load() {
    const todayStr  = aestDateString()
    const weekStart = aestWeekStart()

    const [todayRes, weekRes, pendingCounts, assignedRes] = await Promise.all([
      // Visits today
      supabase.from('ios_visits')
        .select('id', { count: 'exact', head: true })
        .eq('rep_id', repId!)
        .gte('checkin_at', `${todayStr}T00:00:00+10:00`),
      // Visits this week
      supabase.from('ios_visits')
        .select('id', { count: 'exact', head: true })
        .eq('rep_id', repId!)
        .gte('checkin_at', `${weekStart}T00:00:00+10:00`),
      // Pending offline queue
      getPendingCounts(),
      // Assigned stores with last visit this week
      supabase.from('ios_rep_stores')
        .select('store_id, ios_stores(id, name, suburb, state, retailer_id, ios_retailers(name))')
        .eq('rep_id', repId!),
    ])

    const assignedStoreIds: string[] = ((assignedRes.data ?? []) as Array<{ store_id: string }>).map(r => r.store_id)

    // Get visits this week per assigned store
    let visitedThisWeek = new Set<string>()
    if (assignedStoreIds.length > 0) {
      const { data: weekVisits } = await supabase
        .from('ios_visits')
        .select('store_id, checkin_at')
        .eq('rep_id', repId!)
        .gte('checkin_at', `${weekStart}T00:00:00+10:00`)
        .in('store_id', assignedStoreIds)
      visitedThisWeek = new Set((weekVisits ?? []).map((v: { store_id: string }) => v.store_id))
    }

    // Build overdue list from assigned data
    type AssignedRow = {
      store_id: string
      ios_stores: {
        id: string; name: string; suburb: string; state: string
        ios_retailers: { name: string } | null
      } | null
    }
    const overdueStores = ((assignedRes.data ?? []) as unknown as AssignedRow[])
      .filter(r => r.ios_stores && !visitedThisWeek.has(r.store_id))
      .slice(0, 8)
      .map(r => ({
        id:            r.ios_stores!.id,
        retailer_name: r.ios_stores!.ios_retailers?.name ?? '',
        name:          r.ios_stores!.name,
        suburb:        r.ios_stores!.suburb,
        state:         r.ios_stores!.state,
        lastVisit:     null,
      }))

    setStats({
      today:   todayRes.count ?? 0,
      week:    weekRes.count ?? 0,
      pending: pendingCounts.total,
      overdueStores,
    })
  }

  return stats
}

export function CheckScreen() {
  const { activeVisit, startVisit } = useVisit()
  const { repProfile, repBrands } = useAuth()
  const stats = useRepStats(repProfile?.id)
  const location = useLocation()

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Store[]>([])
  const [selected, setSelected] = useState<Store | null>(null)
  const [visitType,setVisitType]= useState<VisitType>('physical')
  const [starting, setStarting] = useState(false)

  // Handle preselect from StoreDetailScreen "Check In Here"
  useEffect(() => {
    const preId = (location.state as { preselectedStoreId?: string } | null)?.preselectedStoreId
    if (!preId) return
    db.stores.get(preId).then(s => { if (s) setSelected(s) })
  }, [location.state])

  if (activeVisit) return <ActiveVisitPanel />

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    const found = await searchStores(q)
    setResults(found.slice(0, 15))
  }

  async function startCheckin(store?: Store) {
    const s = store ?? selected
    if (!s || !repProfile) return
    setStarting(true)
    const pos = visitType !== 'remote' ? await getPosition() : null
    const now = new Date().toISOString()
    startVisit({
      localId:    uuid(),
      store:      s,
      visitType,
      brandIds:   repBrands.map(b => b.id),
      checkinAt:  now,
      checkinLat: pos?.lat ?? null,
      checkinLng: pos?.lng ?? null,
      repId:      repProfile.id,
    })
    setStarting(false)
  }

  const showingSearch = selected || query.length > 0

  return (
    <div className="p-4" style={{ fontFamily: 'Arial, sans-serif' }}>

      {/* Brand pills */}
      {repBrands.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {repBrands.map(b => (
            <span key={b.id} className="px-2.5 py-1 rounded-full bg-ios-navy text-white text-xs font-bold">
              {b.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-amber-600 text-xs mb-4">No brands assigned — contact your manager.</p>
      )}

      {/* Stats tiles — shown when not actively searching */}
      {!showingSearch && stats && (
        <div className="mb-5 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Today" value={stats.today} />
            <StatTile label="This week" value={stats.week} />
            <StatTile
              label="Pending sync"
              value={stats.pending}
              alert={stats.pending > 0}
            />
          </div>

          {/* Overdue stores */}
          {stats.overdueStores.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Not visited this week ({stats.overdueStores.length})
              </p>
              <div className="space-y-1.5">
                {stats.overdueStores.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const storeObj = { id: s.id, name: s.name, suburb: s.suburb, state: s.state,
                        retailer_name: s.retailer_name, retailer_id: '', is_active: true,
                        postcode: null, latitude: null, longitude: null, store_number: null, address: null }
                      setSelected(storeObj as Store)
                    }}
                    className="w-full bg-white rounded-lg px-3 py-2.5 border border-amber-200 text-left flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-ios-navy text-xs">
                        {s.retailer_name} {s.name}
                      </p>
                      <p className="text-gray-500 text-xs">{s.suburb}, {s.state}</p>
                    </div>
                    <span className="text-amber-500 text-xs font-bold">Due</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stats.overdueStores.length === 0 && stats.week > 0 && (
            <div className="bg-green-50 rounded-xl px-4 py-3 border border-green-200 text-center">
              <p className="text-green-700 text-xs font-bold">All assigned stores visited this week</p>
            </div>
          )}
        </div>
      )}

      {/* Check-in flow */}
      <h1 className="text-ios-navy text-base font-bold mb-2">Check In</h1>

      {!selected ? (
        <>
          <input
            type="search"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search store name, suburb, postcode..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm mb-3"
          />
          {results.length === 0 && query.length >= 2 && (
            <p className="text-gray-400 text-sm text-center mt-6">No stores found.</p>
          )}
          {results.length === 0 && query.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-4">
              Start typing to find your store.
            </p>
          )}
          <div className="space-y-2">
            {results.map(store => (
              <button
                key={store.id}
                onClick={() => { setSelected(store); setQuery(''); setResults([]) }}
                className="w-full bg-white rounded-lg px-4 py-3 border border-gray-200 text-left"
              >
                <p className="font-bold text-ios-navy text-sm">
                  {store.retailer_name} {store.name}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {store.suburb}, {store.state}
                  {store.postcode ? ` · ${store.postcode}` : ''}
                  {store.store_number ? ` · #${store.store_number}` : ''}
                </p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-ios-navy rounded-xl p-4 text-white">
            <p className="text-xs opacity-70 uppercase tracking-wide">Selected Store</p>
            <p className="font-bold text-lg leading-tight mt-0.5">
              {selected.retailer_name} {selected.name}
            </p>
            <p className="text-xs opacity-70 mt-0.5">
              {selected.suburb}, {selected.state}
              {selected.postcode ? ` · ${selected.postcode}` : ''}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              Visit type
            </p>
            <div className="flex gap-3">
              {(['physical', 'remote'] as VisitType[]).map(vt => (
                <button
                  key={vt}
                  onClick={() => setVisitType(vt)}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold border capitalize ${
                    visitType === vt
                      ? 'bg-ios-navy text-white border-ios-navy'
                      : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {vt === 'physical' ? '📍 Physical' : '💻 Remote'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => startCheckin()}
            disabled={starting}
            className="w-full py-3 rounded-xl bg-ios-blue text-white font-bold text-sm disabled:opacity-50"
          >
            {starting ? 'Starting...' : 'Start Visit'}
          </button>

          <button
            onClick={() => setSelected(null)}
            className="w-full text-gray-500 text-sm"
          >
            Choose a different store
          </button>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${
      alert && value > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
    }`}>
      <p className={`text-2xl font-bold ${alert && value > 0 ? 'text-amber-600' : 'text-ios-navy'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
