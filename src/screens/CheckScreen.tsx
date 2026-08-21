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

interface AssignedStore {
  id: string
  retailer_name: string
  name: string
  suburb: string
  state: string
  visitedThisWeek: boolean
}

interface PendingCount {
  total: number
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
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  now.setDate(diff)
  return now.toISOString().split('T')[0]
}

export function CheckScreen() {
  const { activeVisit, startVisit } = useVisit()
  const { repProfile, repBrands } = useAuth()
  const location = useLocation()

  const [query,          setQuery]          = useState('')
  const [searchResults,  setSearchResults]  = useState<Store[]>([])
  const [selected,       setSelected]       = useState<Store | null>(null)
  const [visitType,      setVisitType]      = useState<VisitType>('physical')
  const [starting,       setStarting]       = useState(false)
  const [assignedStores, setAssignedStores] = useState<AssignedStore[]>([])
  const [todayCount,     setTodayCount]     = useState<number>(0)
  const [weekCount,      setWeekCount]      = useState<number>(0)
  const [pending,        setPending]        = useState<PendingCount>({ total: 0 })
  const [statsLoaded,    setStatsLoaded]    = useState(false)

  // Preselect from StoreDetailScreen "Check In Here"
  useEffect(() => {
    const preId = (location.state as { preselectedStoreId?: string } | null)?.preselectedStoreId
    if (!preId) return
    db.stores.get(preId).then(s => { if (s) setSelected(s) })
  }, [location.state])

  // Load assigned stores + stats on mount
  useEffect(() => {
    if (!repProfile?.id) return
    loadAssigned(repProfile.id)
    loadStats(repProfile.id)
  }, [repProfile?.id])

  async function loadAssigned(repId: string) {
    const weekStart = aestWeekStart()
    const { data } = await supabase
      .from('ios_rep_stores')
      .select('store_id, ios_stores(id, name, suburb, state, ios_retailers(name))')
      .eq('rep_id', repId)

    type Row = { store_id: string; ios_stores: { id: string; name: string; suburb: string; state: string; ios_retailers: { name: string } | null } | null }
    const rows = (data ?? []) as unknown as Row[]
    const storeIds = rows.map(r => r.store_id)

    let visitedThisWeek = new Set<string>()
    if (storeIds.length > 0) {
      const { data: wv } = await supabase
        .from('ios_visits')
        .select('store_id')
        .eq('rep_id', repId)
        .gte('checkin_at', `${weekStart}T00:00:00+10:00`)
        .in('store_id', storeIds)
      visitedThisWeek = new Set((wv ?? []).map((v: { store_id: string }) => v.store_id))
    }

    const stores: AssignedStore[] = rows
      .filter(r => r.ios_stores)
      .map(r => ({
        id:              r.ios_stores!.id,
        retailer_name:   r.ios_stores!.ios_retailers?.name ?? '',
        name:            r.ios_stores!.name,
        suburb:          r.ios_stores!.suburb,
        state:           r.ios_stores!.state,
        visitedThisWeek: visitedThisWeek.has(r.store_id),
      }))
      // Not-visited-yet first, then alphabetical within each group
      .sort((a, b) => {
        if (a.visitedThisWeek !== b.visitedThisWeek) return a.visitedThisWeek ? 1 : -1
        return a.retailer_name.localeCompare(b.retailer_name) || a.name.localeCompare(b.name)
      })

    setAssignedStores(stores)
  }

  async function loadStats(repId: string) {
    const todayStr  = aestDateString()
    const weekStart = aestWeekStart()
    const [todayRes, weekRes, pCount] = await Promise.all([
      supabase.from('ios_visits').select('id', { count: 'exact', head: true })
        .eq('rep_id', repId).gte('checkin_at', `${todayStr}T00:00:00+10:00`),
      supabase.from('ios_visits').select('id', { count: 'exact', head: true })
        .eq('rep_id', repId).gte('checkin_at', `${weekStart}T00:00:00+10:00`),
      getPendingCounts(),
    ])
    setTodayCount(todayRes.count ?? 0)
    setWeekCount(weekRes.count ?? 0)
    setPending(pCount)
    setStatsLoaded(true)
  }

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    const found = await searchStores(q)
    setSearchResults(found.slice(0, 15))
  }

  async function startCheckin(store?: Store | AssignedStore) {
    const s = store ?? selected
    if (!s || !repProfile) return
    setStarting(true)

    // Normalise AssignedStore → Store shape
    const storeObj: Store = 'retailer_id' in s ? s as Store : {
      id: s.id, name: s.name, suburb: s.suburb, state: s.state,
      retailer_name: s.retailer_name, retailer_id: '', is_active: true,
      postcode: null, latitude: null, longitude: null, store_number: null, address: null,
      visit_frequency_days: null,
    }

    const pos = visitType !== 'remote' ? await getPosition() : null
    const now = new Date().toISOString()
    startVisit({
      localId:    uuid(),
      store:      storeObj,
      visitType,
      brandIds:   repBrands.map(b => b.id),
      callNotes:  '',
      checkinAt:  now,
      checkinLat: pos?.lat ?? null,
      checkinLng: pos?.lng ?? null,
      repId:      repProfile.id,
    })
    setStarting(false)
  }

  // ── Active visit → hand off to panel ──────────────────────────
  if (activeVisit) return <ActiveVisitPanel />

  // ── Store selected → confirmation step ────────────────────────
  if (selected) {
    return (
      <div className="p-4 space-y-4" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={() => setSelected(null)} className="text-ios-blue text-sm">
          ← Back
        </button>

        <div className="bg-ios-navy rounded-xl p-4 text-white">
          <p className="text-xs opacity-60 uppercase tracking-wide mb-0.5">Checking in at</p>
          <p className="font-bold text-xl leading-tight">
            {selected.retailer_name} {selected.name}
          </p>
          <p className="text-sm opacity-70 mt-1">
            {selected.suburb}, {selected.state}
            {selected.postcode ? ` · ${selected.postcode}` : ''}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Visit type</p>
          <div className="grid grid-cols-2 gap-3">
            {(['physical', 'remote'] as VisitType[]).map(vt => (
              <button
                key={vt}
                onClick={() => setVisitType(vt)}
                className={`py-4 rounded-xl text-sm font-bold border flex flex-col items-center gap-1 ${
                  visitType === vt
                    ? 'bg-ios-navy text-white border-ios-navy'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <span className="text-2xl">{vt === 'physical' ? '📍' : '💻'}</span>
                {vt === 'physical' ? 'Physical visit' : 'Remote call'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => startCheckin()}
          disabled={starting}
          className="w-full py-4 rounded-xl bg-ios-blue text-white font-bold text-base disabled:opacity-50"
        >
          {starting ? 'Starting...' : 'Start Visit'}
        </button>
      </div>
    )
  }

  // ── Default home view ─────────────────────────────────────────
  const isSearching = query.length > 0

  return (
    <div className="min-h-screen bg-ios-ltgrey" style={{ fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div className="bg-ios-navy px-4 pt-5 pb-4">
        <p className="text-white font-bold text-lg">
          {repProfile?.full_name?.split(' ')[0] ?? 'Field'} &mdash; Check In
        </p>
        {repBrands.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {repBrands.map(b => (
              <span key={b.id} className="px-2 py-0.5 rounded-full bg-blue-700 text-white text-xs font-bold">
                {b.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats strip */}
      {statsLoaded && (
        <div className="flex bg-white border-b border-gray-200 divide-x divide-gray-100">
          <StatStrip label="Today" value={todayCount} />
          <StatStrip label="This week" value={weekCount} />
          <StatStrip label="Pending sync" value={pending.total} warn={pending.total > 0} />
        </div>
      )}

      <div className="p-4 space-y-4">

        {/* Search */}
        <div>
          <input
            type="search"
            value={query}
            autoComplete="off"
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by store, suburb or postcode..."
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm shadow-sm"
            style={{ fontFamily: 'Arial, sans-serif' }}
          />
        </div>

        {/* Search results */}
        {isSearching && (
          <div className="space-y-2">
            {searchResults.length === 0 && query.length >= 2 && (
              <p className="text-gray-400 text-sm text-center py-4">No stores found.</p>
            )}
            {searchResults.map(store => (
              <button
                key={store.id}
                onClick={() => { setSelected(store); setQuery(''); setSearchResults([]) }}
                className="w-full bg-white rounded-xl px-4 py-3 border border-gray-200 text-left shadow-sm"
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
        )}

        {/* Assigned stores — shown when not searching */}
        {!isSearching && (
          <>
            {assignedStores.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center">
                <p className="text-gray-500 text-sm font-bold mb-1">No stores assigned yet</p>
                <p className="text-gray-400 text-xs">Use the search above to find any store, or ask your manager to assign stores to your account.</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
                  Your stores ({assignedStores.length})
                </p>
                <div className="space-y-2">
                  {assignedStores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => setSelected({
                        id: store.id, name: store.name, suburb: store.suburb,
                        state: store.state, retailer_name: store.retailer_name,
                        retailer_id: '', is_active: true, postcode: null,
                        latitude: null, longitude: null, store_number: null,
                        address: null, visit_frequency_days: null,
                      } as Store)}
                      className={`w-full bg-white rounded-xl px-4 py-3.5 border text-left shadow-sm flex items-center justify-between ${
                        store.visitedThisWeek
                          ? 'border-gray-200 opacity-60'
                          : 'border-gray-200 border-l-4 border-l-ios-blue'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-ios-navy text-sm">
                          {store.retailer_name} {store.name}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {store.suburb}, {store.state}
                        </p>
                      </div>
                      {store.visitedThisWeek ? (
                        <span className="text-green-600 text-xs font-bold shrink-0 ml-2">Done ✓</span>
                      ) : (
                        <span className="text-ios-blue text-xs font-bold shrink-0 ml-2">Check In →</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatStrip({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex-1 py-2 text-center">
      <p className={`text-lg font-bold ${warn && value > 0 ? 'text-amber-500' : 'text-ios-navy'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}
