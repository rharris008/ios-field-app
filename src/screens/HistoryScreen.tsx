import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface VisitRow {
  id: string
  checkin_at: string
  checkout_at: string | null
  duration_minutes: number | null
  visit_type: string
  ios_stores: { name: string; suburb: string; state: string; ios_retailers: { name: string } | null } | null
}

export function HistoryScreen() {
  const { session, repProfile } = useAuth()
  const navigate = useNavigate()
  const [visits, setVisits]   = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(true)

  const isManager = repProfile?.role === 'manager' || repProfile?.role === 'admin'

  useEffect(() => {
    if (!session) return
    load()
  }, [session])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('ios_visits')
      .select('id, checkin_at, checkout_at, duration_minutes, visit_type, ios_stores(name, suburb, state, ios_retailers(name))')
      .order('checkin_at', { ascending: false })
      .limit(50)

    if (!isManager) {
      query = query.eq('rep_id', session!.user.id)
    }

    const { data } = await query
    setVisits((data ?? []) as unknown as VisitRow[])
    setLoading(false)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <h1 className="text-ios-navy text-lg font-bold mb-4">Visit History</h1>

      {loading && (
        <p className="text-gray-400 text-sm text-center mt-6">Loading...</p>
      )}

      {!loading && visits.length === 0 && (
        <p className="text-gray-400 text-sm text-center mt-10">No visits recorded yet.</p>
      )}

      <div className="space-y-2">
        {visits.map(v => {
          const store = v.ios_stores
          const retailer = store?.ios_retailers?.name ?? ''
          return (
            <button
              key={v.id}
              onClick={() => navigate(`/visit/${v.id}`)}
              className="w-full bg-white rounded-lg px-4 py-3 border border-gray-200 text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-ios-navy text-sm">
                    {retailer} {store?.name}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {store?.suburb}, {store?.state}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  v.checkout_at
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {v.checkout_at ? 'Complete' : 'Open'}
                </span>
              </div>
              <p className="text-gray-400 text-xs mt-1.5">
                {formatDate(v.checkin_at)}
                {v.duration_minutes ? ` · ${v.duration_minutes} min` : ''}
                {' · '}{v.visit_type}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
