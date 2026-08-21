// ============================================================
// Action Tracker — all users can view and create actions.
// Managers can assign to other reps and change status.
// Uses ios_actions table (IDENTIFIED → ASSIGNED → IN_PROGRESS → RESOLVED)
// ============================================================
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { v4 as uuid } from 'uuid'

type ActionStatus = 'identified' | 'assigned' | 'in_progress' | 'resolved'

interface ActionRow {
  id: string
  title: string
  description: string | null
  status: ActionStatus
  due_date: string | null
  created_at: string
  ios_stores: { name: string; suburb: string; state: string; ios_retailers: { name: string } | null } | null
  ios_brands: { name: string } | null
  raised: { display_name: string } | null
  assigned: { display_name: string } | null
}

const STATUS_LABELS: Record<ActionStatus, string> = {
  identified: 'Identified',
  assigned:   'Assigned',
  in_progress: 'In Progress',
  resolved:   'Resolved',
}

const STATUS_COLOURS: Record<ActionStatus, string> = {
  identified:  'bg-gray-100 text-gray-700',
  assigned:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved:    'bg-green-100 text-green-700',
}

type FilterStatus = 'open' | 'resolved' | 'all'

export function ActionsScreen() {
  const { session, repProfile, brands } = useAuth()
  const isManager = repProfile?.role === 'manager' || repProfile?.role === 'admin'

  const [actions,    setActions]    = useState<ActionRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<FilterStatus>('open')
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)

  // New action form state
  const [newTitle,   setNewTitle]   = useState('')
  const [newDesc,    setNewDesc]    = useState('')
  const [newBrandId, setNewBrandId] = useState('')
  const [newDue,     setNewDue]     = useState('')
  const [storeQuery, setStoreQuery] = useState('')
  const [storeResults, setStoreResults] = useState<Array<{ id: string; name: string; suburb: string; state: string; retailer_name: string }>>([])
  const [selectedStore, setSelectedStore] = useState<{ id: string; name: string; suburb: string; state: string; retailer_name: string } | null>(null)

  useEffect(() => { if (session) load() }, [session, filter])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('ios_actions')
      .select(`id, title, description, status, due_date, created_at,
        ios_stores(name, suburb, state, ios_retailers(name)),
        ios_brands(name),
        raised:raised_by(display_name),
        assigned:assigned_to(display_name)`)
      .order('created_at', { ascending: false })
      .limit(80)

    if (!isManager) q = q.eq('raised_by', session!.user.id)
    if (filter === 'open')     q = q.neq('status', 'resolved')
    if (filter === 'resolved') q = q.eq('status', 'resolved')

    const { data } = await q
    setActions((data ?? []) as unknown as ActionRow[])
    setLoading(false)
  }

  async function advanceStatus(action: ActionRow) {
    const next: Record<ActionStatus, ActionStatus | null> = {
      identified:  'assigned',
      assigned:    'in_progress',
      in_progress: 'resolved',
      resolved:    null,
    }
    const nextStatus = next[action.status]
    if (!nextStatus) return
    await supabase.from('ios_actions')
      .update({ status: nextStatus, ...(nextStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) })
      .eq('id', action.id)
    load()
  }

  async function searchStores(q: string) {
    setStoreQuery(q)
    if (q.length < 2) { setStoreResults([]); return }
    const { data } = await supabase
      .from('ios_stores')
      .select('id, name, suburb, state, ios_retailers(name)')
      .or(`name.ilike.%${q}%,suburb.ilike.%${q}%`)
      .eq('is_active', true)
      .limit(10)
    setStoreResults((data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string, name: s.name as string, suburb: s.suburb as string, state: s.state as string,
      retailer_name: (s.ios_retailers as { name: string } | null)?.name ?? '',
    })))
  }

  async function createAction() {
    if (!newTitle.trim() || !selectedStore || !repProfile) return
    setSaving(true)
    await supabase.from('ios_actions').insert({
      id:          uuid(),
      store_id:    selectedStore.id,
      brand_id:    newBrandId || null,
      raised_by:   repProfile.id,
      title:       newTitle.trim(),
      description: newDesc.trim() || null,
      due_date:    newDue || null,
      status:      'identified',
    })
    setSaving(false)
    setShowForm(false)
    setNewTitle(''); setNewDesc(''); setNewBrandId(''); setNewDue('')
    setSelectedStore(null); setStoreQuery(''); setStoreResults([])
    load()
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-ios-navy text-lg font-bold">Actions</h1>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-3 py-1.5 bg-ios-navy text-white text-xs font-bold rounded-lg"
        >
          + New
        </button>
      </div>

      {/* New action form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <p className="text-ios-navy font-bold text-sm">New Action</p>

          {/* Store search */}
          {!selectedStore ? (
            <>
              <input
                type="text"
                value={storeQuery}
                onChange={e => searchStores(e.target.value)}
                placeholder="Search store..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              {storeResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStore(s); setStoreResults([]) }}
                  className="w-full text-left bg-gray-50 rounded-lg px-3 py-2 text-xs border border-gray-200"
                >
                  <span className="font-bold text-ios-navy">{s.retailer_name} {s.name}</span>
                  <span className="text-gray-500 ml-1">· {s.suburb}, {s.state}</span>
                </button>
              ))}
            </>
          ) : (
            <div className="flex items-center justify-between bg-ios-navy text-white rounded-lg px-3 py-2">
              <span className="text-xs font-bold">{selectedStore.retailer_name} {selectedStore.name}</span>
              <button onClick={() => setSelectedStore(null)} className="text-xs opacity-70">✕</button>
            </div>
          )}

          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Action title *"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />

          <div className="flex gap-2">
            {brands.filter(b => b.is_active).length > 0 && (
              <select
                value={newBrandId}
                onChange={e => setNewBrandId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">No brand</option>
                {brands.filter(b => b.is_active).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={newDue}
              onChange={e => setNewDue(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={createAction}
              disabled={saving || !newTitle.trim() || !selectedStore}
              className="flex-1 py-2.5 rounded-lg bg-ios-navy text-white text-sm font-bold disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['open', 'resolved', 'all'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize border ${
              filter === f ? 'bg-ios-navy text-white border-ios-navy' : 'border-gray-300 text-gray-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm text-center mt-6">Loading...</p>}
      {!loading && actions.length === 0 && (
        <p className="text-gray-400 text-sm text-center mt-10">No actions found.</p>
      )}

      <div className="space-y-2">
        {actions.map(a => {
          const store = a.ios_stores
          const isOpen = expanded === a.id
          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : a.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ios-navy text-sm leading-snug">{a.title}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUS_COLOURS[a.status]}`}>
                    {STATUS_LABELS[a.status]}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5">
                  {store?.ios_retailers?.name} {store?.name} · {store?.suburb}
                  {a.ios_brands ? ` · ${a.ios_brands.name}` : ''}
                </p>
                {a.due_date && (
                  <p className="text-amber-600 text-xs mt-0.5">
                    Due: {new Date(a.due_date).toLocaleDateString('en-AU')}
                  </p>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                  {a.description && (
                    <p className="text-gray-700 text-xs">{a.description}</p>
                  )}
                  <div className="text-xs text-gray-400 space-y-0.5">
                    {a.raised && <p>Raised by: {(a.raised as unknown as { display_name: string }).display_name}</p>}
                    {a.assigned && <p>Assigned to: {(a.assigned as unknown as { display_name: string }).display_name}</p>}
                    <p>Created: {new Date(a.created_at).toLocaleDateString('en-AU')}</p>
                  </div>
                  {a.status !== 'resolved' && (
                    <button
                      onClick={() => advanceStatus(a)}
                      className="w-full py-2.5 rounded-lg bg-ios-blue text-white text-xs font-bold"
                    >
                      Move to: {STATUS_LABELS[{
                        identified: 'assigned', assigned: 'in_progress',
                        in_progress: 'resolved', resolved: 'resolved',
                      }[a.status] as ActionStatus]}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
