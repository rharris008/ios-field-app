// Active visit state — persisted to localStorage so refresh doesn't lose the visit.
import { createContext, useContext, useState, useCallback } from 'react'
import type { Store, VisitType } from '../types'

export interface ActiveVisit {
  localId:   string
  store:     Store
  visitType: VisitType
  brandIds:  string[]
  callNotes: string
  contactName: string
  contactMethod: string
  checkinAt: string
  checkinLat: number | null
  checkinLng: number | null
  repId:     string
}

interface VisitContextValue {
  activeVisit:        ActiveVisit | null
  startVisit:         (v: ActiveVisit) => void
  endVisit:           () => void
  addBrand:           (brandId: string) => void
  removeBrand:        (brandId: string) => void
  updateCallNotes:    (notes: string) => void
  updateContactName:  (name: string) => void
  updateContactMethod:(method: string) => void
}

const VisitContext = createContext<VisitContextValue | null>(null)

const STORAGE_KEY = 'ios_active_visit'

function load(): ActiveVisit | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function save(v: ActiveVisit | null) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* storage full — ignore */ }
}

export function VisitProvider({ children }: { children: React.ReactNode }) {
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(load)

  const startVisit = useCallback((v: ActiveVisit) => {
    save(v)
    setActiveVisit(v)
  }, [])

  const endVisit = useCallback(() => {
    save(null)
    setActiveVisit(null)
  }, [])

  const addBrand = useCallback((brandId: string) => {
    setActiveVisit(prev => {
      if (!prev || prev.brandIds.includes(brandId)) return prev
      const next = { ...prev, brandIds: [...prev.brandIds, brandId] }
      save(next)
      return next
    })
  }, [])

  const removeBrand = useCallback((brandId: string) => {
    setActiveVisit(prev => {
      if (!prev) return prev
      const next = { ...prev, brandIds: prev.brandIds.filter(id => id !== brandId) }
      save(next)
      return next
    })
  }, [])

  const updateCallNotes = useCallback((notes: string) => {
    setActiveVisit(prev => {
      if (!prev) return prev
      const next = { ...prev, callNotes: notes }
      save(next)
      return next
    })
  }, [])

  const updateContactName = useCallback((name: string) => {
    setActiveVisit(prev => {
      if (!prev) return prev
      const next = { ...prev, contactName: name }
      save(next)
      return next
    })
  }, [])

  const updateContactMethod = useCallback((method: string) => {
    setActiveVisit(prev => {
      if (!prev) return prev
      const next = { ...prev, contactMethod: method }
      save(next)
      return next
    })
  }, [])

  return (
    <VisitContext.Provider value={{
      activeVisit, startVisit, endVisit, addBrand, removeBrand,
      updateCallNotes, updateContactName, updateContactMethod,
    }}>
      {children}
    </VisitContext.Provider>
  )
}

export function useVisit() {
  const ctx = useContext(VisitContext)
  if (!ctx) throw new Error('useVisit must be used inside VisitProvider')
  return ctx
}
