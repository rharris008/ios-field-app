import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchStores, db } from '../lib/db'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Store } from '../types'

interface LastVisit {
  storeId: string
  checkinAt: string
  durationMinutes: number | null
}

export function StoresScreen() {
  const { repProfile } = useAuth()
  const navigate = useNavigate()
  const isManager = repProfile?.role === 'manager' || repProfile?.role === 'admin'

  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState<Store[]>([])
  const [lastVisits, setLastVisits] = useState<Record<string, LastVisit>>({})
  const [totalCount, setTotalCount] = useState<number>(0)
  const [noCache,    setNoCache]    = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const count = await db.stores.count()
    setTotalCount(count)
    if (count === 0) { setNoCache(true); return }
    setNoCache(false)
    const all = await searchStores('')
    setResults(all.slice(0, 50))
    loadLastVisits(all.slice(0, 50).map(s => s.id))
  }

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.length === 0) { loadAll(); return }
    if (q.length < 2) return
    const found = await searchStores(q)
    const sliced = found.slice(0, 30)
    setResults(sliced)
    loadLastVisits(sliced.map(s => s.id))
  }

  async function loadLastVisits(storeIds: string[]) {
    if (storeIds.length === 0) return
    // Get the most recent visit per store
    let query = supabase
      .from('ios_visits')
      .select('store_id, checkin_at, duration_minutes')
      .in('store_id', storeIds)
      .order('checkin_at', { ascending: false })

    if (!isManager && repProfile) {
      query = query.eq('rep_id', repProfile.id)
    }

    const { data } = await query
    if (!data) return

    const map: Record<string, LastVisit> = {}
    for (const row of data as { store_id: string; checkin_at: string; duration_minutes: number | null }[]) {
      if (!map[row.store_id]) {
        map[row.store_id] = {
          storeId: row.store_id,
          checkinAt: row.checkin_at,
          durationMinutes: row.duration_minutes,
        }
      }
    }
    setLastVisits(map)
  }

  function formatLastVisit(iso: string) {
    const date = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: '2-digit', month: '2-digit',
    })
  }

  function isOverdue(store: Store, lastVisit?: LastVisit): boolean {
    if (!store.visit_frequency_days || !lastVisit) return false
    const daysSince = Math.floor(
      (Date.now() - new Date(lastVisit.checkinAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysSince > store.visit_frequency_days
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-baseline justify-between mb-3">
        <h1 className="text-ios-navy text-lg font-bold">Stores</h1>
        {totalCount > 0 && (
          <span className="text-gray-400 text-xs">{totalCount.toLocaleString()} cached</span>
        )}
      </div>

      {noCache ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-center mt-6">
          <p className="text-amber-700 font-bold text-sm mb-1">No stores loaded</p>
          <p className="text-amber-600 text-xs">Run the store seed SQL in Supabase, then tap Refresh on the Me tab.</p>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Filter by name, suburb, postcode..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm mb-4"
            style={{ fontFamily: 'Arial, sans-serif' }}
          />
          {results.length === 0 && query.length >= 2 && (
            <p className="text-gray-400 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
              No stores found.
            </p>
          )}
          <div className="space-y-2">
            {results.map(store => {
              const lv = lastVisits[store.id]
              const overdue = isOverdue(store, lv)
              return (
                <button
                  key={store.id}
                  onClick={() => navigate(`/store/${store.id}`)}
                  className={`w-full bg-white rounded-lg px-4 py-3 border text-left ${
                    overdue ? 'border-l-4 border-l-amber-400 border-gray-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-ios-navy text-sm truncate">
                        {store.retailer_name} {store.name}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {store.suburb}, {store.state}
                        {store.store_number ? ` · #${store.store_number}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {lv ? (
                        <>
                          <p className={`text-xs font-bold ${overdue ? 'text-amber-500' : 'text-gray-500'}`}>
                            {formatLastVisit(lv.checkinAt)}
                          </p>
                          {overdue && (
                            <p className="text-amber-500 text-xs">Overdue</p>
                          )}
                        </>
                      ) : (
                        <p className="text-gray-400 text-xs">No visit</p>
                      )}
                    </div>
                  </div>
                  {store.visit_frequency_days && (
                    <p className="text-gray-400 text-xs mt-1">
                      Every {store.visit_frequency_days} days
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
