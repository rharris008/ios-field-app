import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'

const ROLE_BADGE: Record<string, string> = {
  rep: 'bg-blue-100 text-blue-700',
  manager: 'bg-purple-100 text-purple-700',
  admin: 'bg-red-100 text-red-700',
}

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT', 'National']

export function ProfileScreen() {
  const { repProfile, signOut, forceRefreshRefData, refDataLastSynced } = useAuth()

  const [editingState, setEditingState] = useState(false)
  const [stateVal,     setStateVal]     = useState(repProfile?.state_territory ?? '')
  const [savingState,  setSavingState]  = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)
  const [storeCount,   setStoreCount]   = useState<number | null>(null)

  const [visitTotal, setVisitTotal]   = useState<number | null>(null)
  const [visit30,    setVisit30]      = useState<number | null>(null)
  const [avgDuration,setAvgDuration]  = useState<number | null>(null)
  const [statsLoaded,setStatsLoaded]  = useState(false)

  useEffect(() => {
    if (repProfile) {
      setStateVal(repProfile.state_territory ?? '')
      loadStats()
      db.stores.count().then(setStoreCount)
    }
  }, [repProfile])

  async function handleRefresh() {
    setRefreshing(true)
    await forceRefreshRefData()
    const count = await db.stores.count()
    setStoreCount(count)
    setRefreshing(false)
  }

  async function loadStats() {
    if (!repProfile) return
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [allRes, recentRes] = await Promise.all([
      supabase
        .from('ios_visits')
        .select('duration_minutes', { count: 'exact', head: false })
        .eq('rep_id', repProfile.id),
      supabase
        .from('ios_visits')
        .select('id', { count: 'exact', head: true })
        .eq('rep_id', repProfile.id)
        .gte('checkin_at', since30),
    ])

    const all = allRes.data ?? []
    setVisitTotal(allRes.count ?? all.length)
    setVisit30(recentRes.count ?? 0)

    const withDuration = all.filter((v: { duration_minutes: number | null }) => v.duration_minutes != null)
    if (withDuration.length > 0) {
      const avg = withDuration.reduce((s: number, v: { duration_minutes: number | null }) => s + (v.duration_minutes ?? 0), 0) / withDuration.length
      setAvgDuration(Math.round(avg))
    }
    setStatsLoaded(true)
  }

  async function saveState() {
    if (!repProfile) return
    setSavingState(true)
    await supabase
      .from('ios_rep_profiles')
      .update({ state_territory: stateVal || null })
      .eq('id', repProfile.id)
    setSavingState(false)
    setEditingState(false)
  }

  if (!repProfile) return null

  const initials = repProfile.full_name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function formatAccepted(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: '2-digit', month: 'long', year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-ios-ltgrey" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="bg-ios-navy px-4 pt-6 pb-8 flex flex-col items-center">
        <div
          className="w-20 h-20 rounded-full bg-ios-blue flex items-center justify-center mb-3"
          style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'white' }}
        >
          {initials}
        </div>
        <p className="text-white font-bold text-lg">{repProfile.full_name}</p>
        <p className="text-blue-300 text-xs mt-0.5">{repProfile.email}</p>
        <span className={`mt-2 px-3 py-0.5 rounded-full text-xs font-bold capitalize ${ROLE_BADGE[repProfile.role] ?? 'bg-gray-100 text-gray-700'}`}>
          {repProfile.role}
        </span>
      </div>

      <div className="p-4 space-y-3 -mt-4">
        {/* Stats card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
            Your visits
          </p>
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
            <StatCell label="Total" value={statsLoaded ? String(visitTotal ?? 0) : '...'} />
            <StatCell label="Last 30d" value={statsLoaded ? String(visit30 ?? 0) : '...'} />
            <StatCell label="Avg time" value={statsLoaded && avgDuration ? `${avgDuration}m` : '--'} />
          </div>
        </div>

        {/* Territory */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Territory</p>
            {!editingState && (
              <button
                onClick={() => setEditingState(true)}
                className="text-xs text-ios-blue font-bold"
              >
                Edit
              </button>
            )}
          </div>
          {editingState ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {STATES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStateVal(s)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${
                      stateVal === s
                        ? 'bg-ios-navy text-white border-ios-navy'
                        : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveState}
                  disabled={savingState}
                  className="flex-1 py-2 rounded-lg bg-ios-navy text-white text-xs font-bold disabled:opacity-50"
                >
                  {savingState ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setStateVal(repProfile.state_territory ?? ''); setEditingState(false) }}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm font-bold text-ios-navy mt-0.5">
              {repProfile.state_territory ?? 'Not set'}
            </p>
          )}
        </div>

        {/* Account info */}
        {repProfile.terms_accepted_at && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Terms accepted</p>
            <p className="text-sm font-bold text-ios-navy mt-0.5">
              {formatAccepted(repProfile.terms_accepted_at)}
            </p>
          </div>
        )}

        {/* Store data refresh */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Store data</p>
              <p className="text-sm font-bold text-ios-navy mt-0.5">
                {storeCount !== null ? `${storeCount.toLocaleString()} stores cached` : 'Checking...'}
              </p>
              {refDataLastSynced && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Last synced: {new Date(refDataLastSynced).toLocaleString('en-AU', {
                    timeZone: 'Australia/Brisbane',
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg bg-ios-navy text-white text-xs font-bold disabled:opacity-50"
            >
              {refreshing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>
          {storeCount === 0 && (
            <p className="text-amber-600 text-xs mt-1">
              No stores cached. Run the store seed SQL in Supabase, then tap Refresh.
            </p>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full py-3 rounded-xl border border-red-300 text-ios-red font-bold text-sm"
        >
          Sign Out
        </button>

        <p className="text-center text-gray-400 text-xs pb-2">
          IOS Field App · Integrated Outsourced Services
        </p>
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-3">
      <p className="text-lg font-bold text-ios-navy">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
