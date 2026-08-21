// ============================================================
// AuthContext — session, rep profile, reference data
// ============================================================
import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { loadReferenceData } from '../lib/db'
import { startSyncEngine } from '../lib/sync'
import type { RepProfile, Store, Brand, Retailer } from '../types'

interface AuthContextValue {
  session:    Session | null
  repProfile: RepProfile | null
  loading:    boolean
  repLoading: boolean
  stores:     Store[]
  brands:     Brand[]       // all active brands (for admin/manager views)
  repBrands:  Brand[]       // brands assigned to this rep via ios_rep_brands
  retailers:  Retailer[]
  refDataLastSynced: string | null
  signOut: () => Promise<void>
  forceRefreshRefData: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session,    setSession]    = useState<Session | null>(null)
  const [repProfile, setRepProfile] = useState<RepProfile | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [repLoading, setRepLoading] = useState(false)
  const [stores,     setStores]     = useState<Store[]>([])
  const [brands,     setBrands]     = useState<Brand[]>([])
  const [repBrands,  setRepBrands]  = useState<Brand[]>([])
  const [retailers,  setRetailers]  = useState<Retailer[]>([])
  const [refDataLastSynced, setRefDataLastSynced] = useState<string | null>(
    localStorage.getItem('ios_ref_synced_at')
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setRepProfile(null); return }
    setRepLoading(true)
    Promise.all([
      supabase.from('ios_rep_profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('ios_rep_brands').select('brand_id, ios_brands(id, name, is_active)').eq('rep_id', session.user.id),
    ]).then(([profileRes, repBrandsRes]) => {
      setRepProfile(profileRes.data as RepProfile | null)
      const assigned = (repBrandsRes.data ?? [])
        .map((r: Record<string, unknown>) => r.ios_brands)
        .filter(Boolean) as Brand[]
      setRepBrands(assigned)
      setRepLoading(false)
    })
    loadRefData()
    startSyncEngine()
  }, [session])

  async function forceRefreshRefData() {
    localStorage.removeItem('ios_ref_synced_at')
    await loadRefData()
  }

  async function loadRefData() {
    const lastSync = localStorage.getItem('ios_ref_synced_at')
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    if (lastSync && lastSync > oneDayAgo) return

    const [storesRes, brandsRes, retailersRes] = await Promise.all([
      supabase.from('ios_stores').select('*, ios_retailers(name)').eq('is_active', true),
      supabase.from('ios_brands').select('*').eq('is_active', true),
      supabase.from('ios_retailers').select('*').eq('is_active', true),
    ])

    const storeData = (storesRes.data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      retailer_name: (s.ios_retailers as { name: string } | null)?.name ?? '',
    })) as Store[]

    setStores(storeData)
    setBrands(brandsRes.data as Brand[] ?? [])
    setRetailers(retailersRes.data as Retailer[] ?? [])

    await loadReferenceData(storeData, brandsRes.data as Brand[] ?? [], retailersRes.data as Retailer[] ?? [])

    const now = new Date().toISOString()
    localStorage.setItem('ios_ref_synced_at', now)
    setRefDataLastSynced(now)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setRepProfile(null)
    setStores([])
    setBrands([])
    setRepBrands([])
    setRetailers([])
  }

  return (
    <AuthContext.Provider value={{
      session, repProfile, loading, repLoading,
      stores, brands, repBrands, retailers, refDataLastSynced, signOut, forceRefreshRefData,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
