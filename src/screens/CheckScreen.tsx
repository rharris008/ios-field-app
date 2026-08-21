import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useVisit } from '../contexts/VisitContext'
import { useAuth } from '../contexts/AuthContext'
import { searchStores } from '../lib/db'
import { getPosition } from '../lib/gps'
import { ActiveVisitPanel } from '../components/visit/ActiveVisitPanel'
import type { Store, VisitType } from '../types'

export function CheckScreen() {
  const { activeVisit, startVisit } = useVisit()
  const { repProfile } = useAuth()

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Store[]>([])
  const [selected, setSelected] = useState<Store | null>(null)
  const [visitType,setVisitType]= useState<VisitType>('physical')
  const [starting, setStarting] = useState(false)

  if (activeVisit) return <ActiveVisitPanel />

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    const found = await searchStores(q)
    setResults(found.slice(0, 15))
  }

  async function startCheckin() {
    if (!selected || !repProfile) return
    setStarting(true)
    const pos = await getPosition()
    const now = new Date().toISOString()
    startVisit({
      localId:    uuid(),
      store:      selected,
      visitType,
      brandIds:   [],
      checkinAt:  now,
      checkinLat: pos?.lat ?? null,
      checkinLng: pos?.lng ?? null,
      repId:      repProfile.id,
    })
    setStarting(false)
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <h1 className="text-ios-navy text-lg font-bold mb-4">Check In</h1>

      {!selected ? (
        <>
          <input
            type="search"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search store name, suburb, or state..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm mb-3"
            autoFocus
          />
          {results.length === 0 && query.length >= 2 && (
            <p className="text-gray-400 text-sm text-center mt-6">No stores found.</p>
          )}
          {results.length === 0 && query.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-10">
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
                  {store.store_number ? ` · #${store.store_number}` : ''}
                </p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* Selected store */}
          <div className="bg-ios-navy rounded-xl p-4 text-white">
            <p className="text-xs opacity-70 uppercase tracking-wide">Selected Store</p>
            <p className="font-bold text-lg leading-tight mt-0.5">
              {selected.retailer_name} {selected.name}
            </p>
            <p className="text-xs opacity-70 mt-0.5">
              {selected.suburb}, {selected.state}
            </p>
          </div>

          {/* Visit type */}
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
            onClick={startCheckin}
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
