import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'

type AdminTab = 'reps' | 'actions'

interface RepRow {
  id: string
  full_name: string
  email: string
  role: UserRole
  state_territory: string | null
  is_active: boolean
  terms_accepted_at: string | null
}

interface ActionRow {
  id: string
  follow_up_required: boolean
  created_at: string
  ios_visits: {
    id: string
    checkin_at: string
    ios_stores: { name: string; suburb: string; ios_retailers: { name: string } | null } | null
    ios_rep_profiles: { full_name: string } | null
  } | null
}

const ROLES: UserRole[] = ['rep', 'manager', 'admin']

export function AdminScreen() {
  const { repProfile } = useAuth()
  const [tab, setTab] = useState<AdminTab>('reps')

  const [reps,       setReps]       = useState<RepRow[]>([])
  const [actions,    setActions]    = useState<ActionRow[]>([])
  const [repsLoading,setRepsLoading]= useState(true)
  const [actLoading, setActLoading] = useState(true)
  const [saving,     setSaving]     = useState<string | null>(null)

  useEffect(() => { loadReps() }, [])
  useEffect(() => { if (tab === 'actions') loadActions() }, [tab])

  async function loadReps() {
    setRepsLoading(true)
    const { data } = await supabase
      .from('ios_rep_profiles')
      .select('id, full_name, email, role, state_territory, is_active, terms_accepted_at')
      .order('full_name')
    setReps((data ?? []) as RepRow[])
    setRepsLoading(false)
  }

  async function loadActions() {
    setActLoading(true)
    const { data } = await supabase
      .from('ios_visit_feedback')
      .select('id, follow_up_required, created_at, ios_visits(id, checkin_at, ios_stores(name, suburb, ios_retailers(name)), ios_rep_profiles(full_name))')
      .eq('follow_up_required', true)
      .order('created_at', { ascending: false })
      .limit(100)
    setActions((data ?? []) as unknown as ActionRow[])
    setActLoading(false)
  }

  async function toggleActive(rep: RepRow) {
    setSaving(rep.id)
    await supabase.from('ios_rep_profiles').update({ is_active: !rep.is_active }).eq('id', rep.id)
    setReps(prev => prev.map(r => r.id === rep.id ? { ...r, is_active: !r.is_active } : r))
    setSaving(null)
  }

  async function changeRole(rep: RepRow, newRole: UserRole) {
    if (rep.id === repProfile?.id) return  // can't change own role
    setSaving(rep.id + newRole)
    await supabase.from('ios_rep_profiles').update({ role: newRole }).eq('id', rep.id)
    setReps(prev => prev.map(r => r.id === rep.id ? { ...r, role: newRole } : r))
    setSaving(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-ios-ltgrey" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="bg-ios-navy px-4 pt-4 pb-3">
        <p className="text-white font-bold text-lg">Admin</p>
        <p className="text-blue-300 text-xs mt-0.5">
          Signed in as {repProfile?.full_name} ({repProfile?.role})
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200 text-sm">
        {([['reps', 'Reps'], ['actions', 'Follow-ups']] as [AdminTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 font-bold ${
              tab === key ? 'text-ios-navy border-b-2 border-ios-navy' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Reps tab */}
      {tab === 'reps' && (
        <div className="p-4 space-y-2">
          {repsLoading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          ) : reps.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No reps found.</p>
          ) : reps.map(rep => (
            <div key={rep.id} className="bg-white rounded-lg px-4 py-3 border border-gray-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-ios-navy text-sm truncate">{rep.full_name}</p>
                  <p className="text-gray-500 text-xs truncate">{rep.email}</p>
                  {rep.state_territory && (
                    <p className="text-gray-400 text-xs">{rep.state_territory}</p>
                  )}
                  {!rep.terms_accepted_at && (
                    <p className="text-amber-600 text-xs mt-0.5">Terms not accepted</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleActive(rep)}
                    disabled={saving === rep.id}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      rep.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {saving === rep.id ? '...' : rep.is_active ? 'Active' : 'Inactive'}
                  </button>

                  {/* Role selector */}
                  {rep.id !== repProfile?.id ? (
                    <div className="flex gap-1">
                      {ROLES.map(r => (
                        <button
                          key={r}
                          onClick={() => changeRole(rep, r)}
                          disabled={!!saving}
                          className={`px-2 py-0.5 rounded text-xs capitalize ${
                            rep.role === r
                              ? 'bg-ios-navy text-white'
                              : 'border border-gray-300 text-gray-600'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 capitalize">{rep.role} (you)</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions tab */}
      {tab === 'actions' && (
        <div className="p-4 space-y-2">
          {actLoading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          ) : actions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No open follow-ups.</p>
          ) : actions.map(action => {
            const visit = action.ios_visits
            const store = visit?.ios_stores
            const rep = visit?.ios_rep_profiles
            const retailer = store?.ios_retailers?.name ?? ''
            return (
              <div key={action.id} className="bg-white rounded-lg px-4 py-3 border border-l-4 border-l-amber-400 border-gray-200">
                <p className="font-bold text-ios-navy text-sm">
                  {retailer} {store?.name}
                </p>
                <p className="text-gray-500 text-xs">{store?.suburb}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-gray-400 text-xs">
                    {rep?.full_name} · {visit?.checkin_at ? formatDate(visit.checkin_at) : ''}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                    Follow-up
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
