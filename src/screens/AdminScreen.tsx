import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'

type AdminTab = 'reps' | 'brands' | 'actions'
type RepExpandTab = 'brands' | 'stores'

interface StoreSearchResult {
  id: string
  name: string
  suburb: string
  state: string
  retailer_name: string
}

interface RepRow {
  id: string
  full_name: string
  email: string
  role: UserRole
  state_territory: string | null
  is_active: boolean
  terms_accepted_at: string | null
  assignedBrandIds?: string[]
  assignedStoreIds?: string[]
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

interface BrandRow {
  id: string
  name: string
  is_active: boolean
}

const ROLES: UserRole[] = ['rep', 'manager', 'admin']

export function AdminScreen() {
  const { repProfile, brands: allBrands } = useAuth()
  const [tab, setTab] = useState<AdminTab>('reps')

  const [reps,          setReps]          = useState<RepRow[]>([])
  const [actions,       setActions]       = useState<ActionRow[]>([])
  const [brands,        setBrands]        = useState<BrandRow[]>([])
  const [repsLoading,   setRepsLoading]   = useState(true)
  const [actLoading,    setActLoading]    = useState(true)
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [saving,         setSaving]        = useState<string | null>(null)
  const [newBrandName,   setNewBrandName]  = useState('')
  const [addingBrand,    setAddingBrand]   = useState(false)
  const [expandedRepId,  setExpandedRepId] = useState<string | null>(null)
  const [repExpandTab,   setRepExpandTab]  = useState<RepExpandTab>('brands')
  const [brandSaving,    setBrandSaving]   = useState<string | null>(null)
  const [storeQuery,     setStoreQuery]    = useState('')
  const [storeResults,   setStoreResults]  = useState<StoreSearchResult[]>([])
  const [storeSaving,    setStoreSaving]   = useState<string | null>(null)
  const [assignedStores, setAssignedStores] = useState<Record<string, StoreSearchResult[]>>({})

  useEffect(() => { loadReps() }, [])
  useEffect(() => { if (tab === 'actions') loadActions() }, [tab])
  useEffect(() => { if (tab === 'brands') loadBrands() }, [tab])

  async function loadReps() {
    setRepsLoading(true)
    const { data } = await supabase
      .from('ios_rep_profiles')
      .select('id, full_name, email, role, state_territory, is_active, terms_accepted_at')
      .order('full_name')
    setReps((data ?? []) as RepRow[])
    setRepsLoading(false)
  }

  async function loadBrands() {
    setBrandsLoading(true)
    const { data } = await supabase
      .from('ios_brands')
      .select('id, name, is_active')
      .order('name')
    setBrands((data ?? []) as BrandRow[])
    setBrandsLoading(false)
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

  async function loadRepBrands(repId: string) {
    const { data } = await supabase
      .from('ios_rep_brands')
      .select('brand_id')
      .eq('rep_id', repId)
    const ids = (data ?? []).map((r: { brand_id: string }) => r.brand_id)
    setReps(prev => prev.map(r => r.id === repId ? { ...r, assignedBrandIds: ids } : r))
  }

  async function toggleExpand(repId: string) {
    if (expandedRepId === repId) {
      setExpandedRepId(null)
      return
    }
    setExpandedRepId(repId)
    setRepExpandTab('brands')
    setStoreQuery('')
    setStoreResults([])
    const rep = reps.find(r => r.id === repId)
    if (!rep?.assignedBrandIds) await loadRepBrands(repId)
    if (!assignedStores[repId]) await loadRepStores(repId)
  }

  async function loadRepStores(repId: string) {
    const { data } = await supabase
      .from('ios_rep_stores')
      .select('store_id, ios_stores(id, name, suburb, state, ios_retailers(name))')
      .eq('rep_id', repId)
    type Row = { store_id: string; ios_stores: { id: string; name: string; suburb: string; state: string; ios_retailers: { name: string } | null } | null }
    const stores: StoreSearchResult[] = ((data ?? []) as unknown as Row[]).map(r => ({
      id: r.ios_stores?.id ?? r.store_id,
      name: r.ios_stores?.name ?? '',
      suburb: r.ios_stores?.suburb ?? '',
      state: r.ios_stores?.state ?? '',
      retailer_name: r.ios_stores?.ios_retailers?.name ?? '',
    }))
    setAssignedStores(prev => ({ ...prev, [repId]: stores }))
    setReps(prev => prev.map(r => r.id === repId ? { ...r, assignedStoreIds: stores.map(s => s.id) } : r))
  }

  async function searchStoresForRep(q: string) {
    setStoreQuery(q)
    if (q.length < 2) { setStoreResults([]); return }
    const { data } = await supabase
      .from('ios_stores')
      .select('id, name, suburb, state, ios_retailers(name)')
      .or(`name.ilike.%${q}%,suburb.ilike.%${q}%,postcode.ilike.%${q}%`)
      .eq('is_active', true)
      .limit(12)
    setStoreResults((data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string, name: s.name as string, suburb: s.suburb as string, state: s.state as string,
      retailer_name: (s.ios_retailers as { name: string } | null)?.name ?? '',
    })))
  }

  async function assignStore(repId: string, store: StoreSearchResult) {
    const key = `store-${repId}-${store.id}`
    setStoreSaving(key)
    await supabase.from('ios_rep_stores').insert({ rep_id: repId, store_id: store.id })
    setAssignedStores(prev => ({
      ...prev,
      [repId]: [...(prev[repId] ?? []), store].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    setReps(prev => prev.map(r => r.id === repId
      ? { ...r, assignedStoreIds: [...(r.assignedStoreIds ?? []), store.id] }
      : r
    ))
    setStoreQuery('')
    setStoreResults([])
    setStoreSaving(null)
  }

  async function removeStore(repId: string, storeId: string) {
    const key = `store-${repId}-${storeId}`
    setStoreSaving(key)
    await supabase.from('ios_rep_stores').delete().eq('rep_id', repId).eq('store_id', storeId)
    setAssignedStores(prev => ({
      ...prev,
      [repId]: (prev[repId] ?? []).filter(s => s.id !== storeId),
    }))
    setReps(prev => prev.map(r => r.id === repId
      ? { ...r, assignedStoreIds: (r.assignedStoreIds ?? []).filter(id => id !== storeId) }
      : r
    ))
    setStoreSaving(null)
  }

  async function toggleRepBrand(rep: RepRow, brandId: string) {
    if (!rep.assignedBrandIds) return
    const key = `brand-${rep.id}-${brandId}`
    setBrandSaving(key)
    const has = rep.assignedBrandIds.includes(brandId)
    if (has) {
      await supabase.from('ios_rep_brands').delete().eq('rep_id', rep.id).eq('brand_id', brandId)
      setReps(prev => prev.map(r =>
        r.id === rep.id
          ? { ...r, assignedBrandIds: r.assignedBrandIds?.filter(id => id !== brandId) }
          : r
      ))
    } else {
      await supabase.from('ios_rep_brands').insert({ rep_id: rep.id, brand_id: brandId })
      setReps(prev => prev.map(r =>
        r.id === rep.id
          ? { ...r, assignedBrandIds: [...(r.assignedBrandIds ?? []), brandId] }
          : r
      ))
    }
    setBrandSaving(null)
  }

  async function toggleActive(rep: RepRow) {
    setSaving(rep.id)
    await supabase.from('ios_rep_profiles').update({ is_active: !rep.is_active }).eq('id', rep.id)
    setReps(prev => prev.map(r => r.id === rep.id ? { ...r, is_active: !r.is_active } : r))
    setSaving(null)
  }

  async function changeRole(rep: RepRow, newRole: UserRole) {
    if (rep.id === repProfile?.id) return
    setSaving(rep.id + newRole)
    await supabase.from('ios_rep_profiles').update({ role: newRole }).eq('id', rep.id)
    setReps(prev => prev.map(r => r.id === rep.id ? { ...r, role: newRole } : r))
    setSaving(null)
  }

  async function toggleBrand(brand: BrandRow) {
    setSaving('brand-' + brand.id)
    await supabase.from('ios_brands').update({ is_active: !brand.is_active }).eq('id', brand.id)
    setBrands(prev => prev.map(b => b.id === brand.id ? { ...b, is_active: !b.is_active } : b))
    setSaving(null)
  }

  async function addBrand() {
    const name = newBrandName.trim()
    if (!name) return
    setAddingBrand(true)
    const { data, error } = await supabase
      .from('ios_brands')
      .insert({ name, is_active: true })
      .select('id, name, is_active')
      .single()
    if (!error && data) {
      setBrands(prev => [...prev, data as BrandRow].sort((a, b) => a.name.localeCompare(b.name)))
      setNewBrandName('')
    }
    setAddingBrand(false)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  const TABS: [AdminTab, string][] = [
    ['reps',    'Reps'],
    ['brands',  'Brands'],
    ['actions', 'Follow-ups'],
  ]

  const brandsForAssignment = allBrands.filter(b => b.is_active)

  return (
    <div className="min-h-screen bg-ios-ltgrey" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="bg-ios-navy px-4 pt-4 pb-3">
        <p className="text-white font-bold text-lg">Admin</p>
        <p className="text-blue-300 text-xs mt-0.5">
          {repProfile?.full_name} ({repProfile?.role})
        </p>
      </div>

      <div className="flex bg-white border-b border-gray-200 text-sm">
        {TABS.map(([key, label]) => (
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
          ) : reps.map(rep => {
            const isExpanded = expandedRepId === rep.id
            return (
              <div key={rep.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Rep header row */}
                <div className="px-4 py-3">
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
                      <button
                        onClick={() => toggleActive(rep)}
                        disabled={saving === rep.id}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          rep.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {saving === rep.id ? '...' : rep.is_active ? 'Active' : 'Inactive'}
                      </button>
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

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(rep.id)}
                    className="mt-2 text-xs text-ios-blue font-bold"
                  >
                    {isExpanded ? 'Collapse' : 'Assign brands / stores'}
                  </button>
                </div>

                {/* Brand + Store assignment panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {/* Mini tab bar */}
                    <div className="flex border-b border-gray-200">
                      {(['brands', 'stores'] as RepExpandTab[]).map(t => (
                        <button
                          key={t}
                          onClick={() => setRepExpandTab(t)}
                          className={`flex-1 py-2 text-xs font-bold capitalize ${
                            repExpandTab === t ? 'text-ios-navy border-b-2 border-ios-navy' : 'text-gray-500'
                          }`}
                        >
                          {t === 'stores' ? `Stores (${(assignedStores[rep.id] ?? []).length})` : 'Brands'}
                        </button>
                      ))}
                    </div>

                    {/* Brands sub-panel */}
                    {repExpandTab === 'brands' && (
                      <div className="px-4 py-3">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                          Brands this rep covers
                        </p>
                        {brandsForAssignment.length === 0 ? (
                          <p className="text-xs text-gray-400">No active brands — add in Brands tab.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {brandsForAssignment.map(brand => {
                              const assigned = rep.assignedBrandIds?.includes(brand.id) ?? false
                              const key = `brand-${rep.id}-${brand.id}`
                              return (
                                <button
                                  key={brand.id}
                                  onClick={() => toggleRepBrand(rep, brand.id)}
                                  disabled={brandSaving === key || !rep.assignedBrandIds}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                    assigned
                                      ? 'bg-ios-navy text-white border-ios-navy'
                                      : 'bg-white text-gray-600 border-gray-300'
                                  } disabled:opacity-50`}
                                >
                                  {brandSaving === key ? '...' : brand.name}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stores sub-panel */}
                    {repExpandTab === 'stores' && (
                      <div className="px-4 py-3 space-y-2">
                        <input
                          type="search"
                          value={storeQuery}
                          onChange={e => searchStoresForRep(e.target.value)}
                          placeholder="Search stores to assign..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs"
                        />
                        {storeResults.filter(s => !(rep.assignedStoreIds ?? []).includes(s.id)).map(s => (
                          <button
                            key={s.id}
                            onClick={() => assignStore(rep.id, s)}
                            disabled={storeSaving === `store-${rep.id}-${s.id}`}
                            className="w-full text-left bg-white rounded-lg px-3 py-2 border border-gray-200 text-xs flex items-center justify-between"
                          >
                            <span>
                              <span className="font-bold text-ios-navy">{s.retailer_name} {s.name}</span>
                              <span className="text-gray-500 ml-1">· {s.suburb}, {s.state}</span>
                            </span>
                            <span className="text-ios-blue font-bold ml-2">+ Add</span>
                          </button>
                        ))}

                        {/* Assigned stores list */}
                        {(assignedStores[rep.id] ?? []).length === 0 && !storeQuery && (
                          <p className="text-gray-400 text-xs text-center py-2">No stores assigned yet.</p>
                        )}
                        {(assignedStores[rep.id] ?? []).map(s => (
                          <div
                            key={s.id}
                            className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-xs flex items-center justify-between"
                          >
                            <span>
                              <span className="font-bold text-ios-navy">{s.retailer_name} {s.name}</span>
                              <span className="text-gray-500 ml-1">· {s.suburb}, {s.state}</span>
                            </span>
                            <button
                              onClick={() => removeStore(rep.id, s.id)}
                              disabled={storeSaving === `store-${rep.id}-${s.id}`}
                              className="text-red-400 font-bold ml-2 disabled:opacity-50"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Brands tab */}
      {tab === 'brands' && (
        <div className="p-4 space-y-3">
          {/* Add brand */}
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Add brand</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBrandName}
                onChange={e => setNewBrandName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBrand()}
                placeholder="Brand name..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={addBrand}
                disabled={addingBrand || !newBrandName.trim()}
                className="px-4 py-2 rounded-lg bg-ios-navy text-white text-sm font-bold disabled:opacity-50"
              >
                {addingBrand ? '...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Brand list */}
          {brandsLoading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          ) : brands.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No brands. Add one above.</p>
          ) : brands.map(brand => (
            <div key={brand.id} className="bg-white rounded-lg px-4 py-3 border border-gray-200 flex items-center justify-between">
              <p className={`font-bold text-sm ${brand.is_active ? 'text-ios-navy' : 'text-gray-400 line-through'}`}>
                {brand.name}
              </p>
              <button
                onClick={() => toggleBrand(brand)}
                disabled={saving === 'brand-' + brand.id}
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  brand.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {saving === 'brand-' + brand.id ? '...' : brand.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Follow-ups tab */}
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
                <p className="font-bold text-ios-navy text-sm">{retailer} {store?.name}</p>
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
