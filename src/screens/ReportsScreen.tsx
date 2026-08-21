// ============================================================
// Reports Screen — manager/admin only
// SECURITY: ios_store_internal_notes is NEVER queried here.
// Brand isolation: when filtering by brand, only visits where
// that brand was serviced are included. Brands never see
// each other's data.
// ============================================================
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type DateRange = '7d' | '30d' | '90d'
type ViewMode = 'store' | 'rep' | 'state'

interface VisitRow {
  id: string
  checkin_at: string
  checkout_at: string | null
  duration_minutes: number | null
  visit_type: string
  rep_id: string
  ios_stores: {
    id: string
    name: string
    suburb: string
    state: string
    retailer_id: string
    ios_retailers: { name: string } | null
  } | null
}

interface VisitBrandRow {
  visit_id: string
  brand_id: string
}

interface FeedbackRow {
  visit_id: string
  store_vibe: string | null
  sales_sentiment: string | null
  relationship_rating: string | null
  follow_up_required: boolean
}

interface StoreSummary {
  storeId: string
  storeName: string
  retailer: string
  suburb: string
  state: string
  visitCount: number
  avgDuration: number | null
  lastVisit: string | null
  followUps: number
}

interface RepSummary {
  repId: string
  repName: string
  visitCount: number
  storeCount: number
  completedCount: number
  avgDuration: number | null
}

interface StateSummary {
  state: string
  visitCount: number
  storeCount: number
  completedCount: number
}

interface RepProfile {
  id: string
  full_name: string
}

const RANGE_DAYS: Record<DateRange, number> = { '7d': 7, '30d': 30, '90d': 90 }

const VIBE_SCORE: Record<string, number> = {
  very_positive: 5, positive: 4, neutral: 3, challenging: 2, poor: 1,
}
const SENT_SCORE: Record<string, number> = {
  very_strong: 5, strong: 4, average: 3, slow: 2, very_slow: 1,
}

export function ReportsScreen() {
  const { repProfile, brands } = useAuth()

  const [range,       setRange]       = useState<DateRange>('30d')
  const [brandFilter, setBrandFilter] = useState<string>('')
  const [viewMode,    setViewMode]    = useState<ViewMode>('store')
  const [loading,     setLoading]     = useState(false)

  const [visits,     setVisits]     = useState<VisitRow[]>([])
  const [feedbacks,  setFeedbacks]  = useState<FeedbackRow[]>([])
  const [repProfiles,setRepProfiles] = useState<RepProfile[]>([])

  const isManager = repProfile?.role === 'manager' || repProfile?.role === 'admin'

  useEffect(() => {
    if (isManager) load()
  }, [range, brandFilter])

  async function load() {
    setLoading(true)

    const since = new Date(
      Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000
    ).toISOString()

    // 1. Load visits in range
    const { data: visitData } = await supabase
      .from('ios_visits')
      .select('id, checkin_at, checkout_at, duration_minutes, visit_type, rep_id, ios_stores(id, name, suburb, state, retailer_id, ios_retailers(name))')
      .gte('checkin_at', since)
      .order('checkin_at', { ascending: false })
      .limit(2000)

    const allVisits = (visitData ?? []) as unknown as VisitRow[]

    // 2. Load visit-brand associations for these visits
    const visitIds = allVisits.map(v => v.id)
    let filteredVisitIds = visitIds

    let vBrands: VisitBrandRow[] = []
    if (visitIds.length > 0) {
      const { data: vbData } = await supabase
        .from('ios_visit_brands')
        .select('visit_id, brand_id')
        .in('visit_id', visitIds)
      vBrands = (vbData ?? []) as VisitBrandRow[]

      // Brand isolation: if filtering by brand, only keep visits with that brand
      if (brandFilter) {
        const brandVisitIds = new Set(
          vBrands.filter(vb => vb.brand_id === brandFilter).map(vb => vb.visit_id)
        )
        filteredVisitIds = visitIds.filter(id => brandVisitIds.has(id))
      }
    }

    const filteredVisits = allVisits.filter(v => filteredVisitIds.includes(v.id))

    // 3. Load feedback for filtered visits (NEVER ios_store_internal_notes)
    let fbData: FeedbackRow[] = []
    if (filteredVisitIds.length > 0) {
      const { data: fd } = await supabase
        .from('ios_visit_feedback')
        .select('visit_id, store_vibe, sales_sentiment, relationship_rating, follow_up_required')
        .in('visit_id', filteredVisitIds)
      fbData = (fd ?? []) as FeedbackRow[]
    }

    // 4. Load rep profiles for By Rep view
    const { data: repData } = await supabase
      .from('ios_rep_profiles')
      .select('id, full_name')
      .eq('is_active', true)
    setRepProfiles((repData ?? []) as RepProfile[])

    setVisits(filteredVisits)
    setFeedbacks(fbData)
    setLoading(false)
  }

  if (!isManager) {
    return (
      <div className="p-4">
        <p className="text-gray-400 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
          Reports are available to managers and admins only.
        </p>
      </div>
    )
  }

  // Aggregate metrics
  const completed = visits.filter(v => v.checkout_at)
  const totalVisits = visits.length
  const physicalVisits = visits.filter(v => v.visit_type === 'physical').length
  const followUps = feedbacks.filter(f => f.follow_up_required).length

  const avgDuration = completed.length > 0
    ? Math.round(completed.reduce((s, v) => s + (v.duration_minutes ?? 0), 0) / completed.length)
    : null

  const vibeScores = feedbacks.map(f => VIBE_SCORE[f.store_vibe ?? '']).filter(Boolean)
  const avgVibe = vibeScores.length > 0
    ? (vibeScores.reduce((a, b) => a + b, 0) / vibeScores.length).toFixed(1)
    : null

  const sentScores = feedbacks.map(f => SENT_SCORE[f.sales_sentiment ?? '']).filter(Boolean)
  const avgSentiment = sentScores.length > 0
    ? (sentScores.reduce((a, b) => a + b, 0) / sentScores.length).toFixed(1)
    : null

  const feedbackRate = totalVisits > 0
    ? Math.round((feedbacks.length / totalVisits) * 100)
    : 0

  // Per-store breakdown
  const storeMap = new Map<string, StoreSummary>()
  for (const v of visits) {
    const store = v.ios_stores
    if (!store) continue
    const existing = storeMap.get(store.id)
    const fb = feedbacks.find(f => f.visit_id === v.id)
    if (!existing) {
      storeMap.set(store.id, {
        storeId:    store.id,
        storeName:  store.name,
        retailer:   store.ios_retailers?.name ?? '',
        suburb:     store.suburb,
        state:      store.state,
        visitCount: 1,
        avgDuration: v.duration_minutes,
        lastVisit:  v.checkin_at,
        followUps:  fb?.follow_up_required ? 1 : 0,
      })
    } else {
      existing.visitCount++
      if (v.duration_minutes) {
        existing.avgDuration = existing.avgDuration
          ? Math.round((existing.avgDuration + v.duration_minutes) / 2)
          : v.duration_minutes
      }
      if (!existing.lastVisit || v.checkin_at > existing.lastVisit) {
        existing.lastVisit = v.checkin_at
      }
      if (fb?.follow_up_required) existing.followUps++
    }
  }
  const storeSummaries = [...storeMap.values()]
    .sort((a, b) => b.visitCount - a.visitCount)

  // By Rep aggregation
  const repMap = new Map<string, RepSummary>()
  for (const v of visits) {
    const rep = repProfiles.find(r => r.id === v.rep_id)
    const repName = rep?.full_name ?? 'Unknown'
    const existing = repMap.get(v.rep_id)
    const storeId = v.ios_stores?.id ?? ''
    if (!existing) {
      repMap.set(v.rep_id, {
        repId: v.rep_id, repName, visitCount: 1,
        storeCount: storeId ? 1 : 0,
        completedCount: v.checkout_at ? 1 : 0,
        avgDuration: v.duration_minutes,
      })
    } else {
      existing.visitCount++
      if (storeId && !visits.slice(0, visits.indexOf(v)).some(pv => pv.rep_id === v.rep_id && pv.ios_stores?.id === storeId)) {
        existing.storeCount++
      }
      if (v.checkout_at) existing.completedCount++
      if (v.duration_minutes) {
        existing.avgDuration = existing.avgDuration
          ? Math.round((existing.avgDuration + v.duration_minutes) / 2)
          : v.duration_minutes
      }
    }
  }
  const repSummaries = [...repMap.values()].sort((a, b) => b.visitCount - a.visitCount)

  // By State aggregation
  const stateMap = new Map<string, StateSummary>()
  for (const v of visits) {
    const state = v.ios_stores?.state ?? 'Unknown'
    const storeId = v.ios_stores?.id ?? ''
    const existing = stateMap.get(state)
    if (!existing) {
      stateMap.set(state, {
        state, visitCount: 1, storeCount: storeId ? 1 : 0, completedCount: v.checkout_at ? 1 : 0,
      })
    } else {
      existing.visitCount++
      if (storeId && !visits.slice(0, visits.indexOf(v)).some(pv => pv.ios_stores?.state === state && pv.ios_stores?.id === storeId)) {
        existing.storeCount++
      }
      if (v.checkout_at) existing.completedCount++
    }
  }
  const stateSummaries = [...stateMap.values()].sort((a, b) => b.visitCount - a.visitCount)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  const activeBrand = brands.find(b => b.id === brandFilter)

  return (
    <div className="min-h-screen bg-ios-ltgrey" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="bg-ios-navy px-4 pt-4 pb-3">
        <p className="text-white font-bold text-lg">Reports</p>
        {activeBrand && (
          <p className="text-blue-300 text-xs mt-0.5">Filtered: {activeBrand.name}</p>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-2">
        {/* Date range */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                range === r
                  ? 'bg-ios-navy text-white border-ios-navy'
                  : 'border-gray-300 text-gray-600'
              }`}
            >
              {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>

        {/* Brand filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setBrandFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              !brandFilter ? 'bg-ios-navy text-white border-ios-navy' : 'border-gray-300 text-gray-600'
            }`}
          >
            All brands
          </button>
          {brands.filter(b => b.is_active).map(brand => (
            <button
              key={brand.id}
              onClick={() => setBrandFilter(brand.id === brandFilter ? '' : brand.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                brandFilter === brand.id
                  ? 'bg-ios-blue text-white border-ios-blue'
                  : 'border-gray-300 text-gray-600'
              }`}
            >
              {brand.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Total visits" value={String(totalVisits)} />
            <MetricTile label="Physical" value={`${physicalVisits} / ${totalVisits}`} />
            <MetricTile label="Avg duration" value={avgDuration ? `${avgDuration} min` : 'N/A'} />
            <MetricTile label="Feedback rate" value={`${feedbackRate}%`} />
            <MetricTile label="Avg store vibe" value={avgVibe ? `${avgVibe}/5` : 'N/A'} />
            <MetricTile label="Avg sentiment" value={avgSentiment ? `${avgSentiment}/5` : 'N/A'} />
          </div>

          {followUps > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-amber-700 font-bold text-sm">{followUps} open follow-up{followUps !== 1 ? 's' : ''}</p>
              <p className="text-amber-600 text-xs mt-0.5">Check Admin tab for details.</p>
            </div>
          )}

          {/* View switcher */}
          <div className="flex gap-2">
            {(['store', 'rep', 'state'] as ViewMode[]).map(vm => (
              <button
                key={vm}
                onClick={() => setViewMode(vm)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize border ${
                  viewMode === vm ? 'bg-ios-navy text-white border-ios-navy' : 'border-gray-300 text-gray-600'
                }`}
              >
                By {vm === 'store' ? 'Store' : vm === 'rep' ? 'Rep' : 'State'}
              </button>
            ))}
          </div>

          {/* BY STORE */}
          {viewMode === 'store' && storeSummaries.length > 0 && (
            <div className="space-y-2">
              {storeSummaries.map(s => (
                <div key={s.storeId} className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-ios-navy text-sm">{s.retailer} {s.storeName}</p>
                      <p className="text-gray-500 text-xs">{s.suburb}, {s.state}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-ios-navy text-sm">{s.visitCount}</p>
                      <p className="text-gray-400 text-xs">visit{s.visitCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-gray-400 text-xs">
                      Last: {s.lastVisit ? formatDate(s.lastVisit) : 'N/A'}
                      {s.avgDuration ? ` · ${s.avgDuration} min avg` : ''}
                    </p>
                    {s.followUps > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {s.followUps} follow-up{s.followUps !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* BY REP */}
          {viewMode === 'rep' && repSummaries.length > 0 && (
            <div className="space-y-2">
              {repSummaries.map(r => {
                const completionRate = r.visitCount > 0
                  ? Math.round((r.completedCount / r.visitCount) * 100) : 0
                return (
                  <div key={r.repId} className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <p className="font-bold text-ios-navy text-sm">{r.repName}</p>
                      <div className="text-right">
                        <p className="font-bold text-ios-navy text-sm">{r.visitCount}</p>
                        <p className="text-gray-400 text-xs">visits</p>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      <p className="text-gray-500 text-xs">{r.storeCount} stores</p>
                      <p className="text-gray-500 text-xs">Completion: {completionRate}%</p>
                      {r.avgDuration && <p className="text-gray-500 text-xs">{r.avgDuration} min avg</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* BY STATE */}
          {viewMode === 'state' && stateSummaries.length > 0 && (
            <div className="space-y-2">
              {stateSummaries.map(s => {
                const completionRate = s.visitCount > 0
                  ? Math.round((s.completedCount / s.visitCount) * 100) : 0
                return (
                  <div key={s.state} className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <p className="font-bold text-ios-navy text-sm">{s.state}</p>
                      <div className="text-right">
                        <p className="font-bold text-ios-navy text-sm">{s.visitCount}</p>
                        <p className="text-gray-400 text-xs">visits</p>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      <p className="text-gray-500 text-xs">{s.storeCount} stores</p>
                      <p className="text-gray-500 text-xs">Completion: {completionRate}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {totalVisits === 0 && !loading && (
            <p className="text-gray-400 text-sm text-center py-8">No visits in this period.</p>
          )}
        </div>
      )}
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg px-3 py-3 border border-gray-200">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-ios-navy text-lg leading-tight mt-0.5">{value}</p>
    </div>
  )
}
