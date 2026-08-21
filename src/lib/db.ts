// ============================================================
// Dexie offline database — IOS Field App
// Tables: offline queue, reference data cache
// All IOS tables in Supabase use the ios_ prefix.
// ============================================================
import Dexie, { type Table } from 'dexie'
import type { Store, Brand, Retailer, OfflineVisit, OfflineFeedback, OfflinePhoto } from '../types'

class IOSFieldDB extends Dexie {
  stores!:   Table<Store>
  brands!:   Table<Brand>
  retailers!: Table<Retailer>
  pendingVisits!:   Table<OfflineVisit>
  pendingFeedback!: Table<OfflineFeedback>
  pendingPhotos!:   Table<OfflinePhoto>

  constructor() {
    super('ios-field-app')
    this.version(1).stores({
      stores:          'id, retailer_id, state, suburb, name, is_active',
      brands:          'id, name, is_active',
      retailers:       'id, name, is_active',
      pendingVisits:   'localId, attempts, storeId',
      pendingFeedback: 'localId, visitLocalId, attempts',
      pendingPhotos:   'localId, visitId, attempts, category',
    })
  }
}

export const db = new IOSFieldDB()

// ---- Reference data helpers -----------------------------------

export async function loadReferenceData(stores: Store[], brands: Brand[], retailers: Retailer[]) {
  await Promise.all([
    db.stores.bulkPut(stores),
    db.brands.bulkPut(brands),
    db.retailers.bulkPut(retailers),
  ])
}

export async function searchStores(query: string, retailerId?: string): Promise<Store[]> {
  const q = query.toLowerCase().trim()
  return db.stores
    .filter(s => {
      if (!s.is_active) return false
      if (retailerId && s.retailer_id !== retailerId) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.suburb.toLowerCase().includes(q) ||
        (s.postcode ?? '').includes(q) ||
        (s.store_number ?? '').toLowerCase().includes(q)
      )
    })
    .limit(60)
    .toArray()
}

// ---- Offline queue helpers ------------------------------------

export async function enqueueVisit(visit: OfflineVisit): Promise<void> {
  await db.pendingVisits.add(visit)
}

export async function enqueueFeedback(feedback: OfflineFeedback): Promise<void> {
  await db.pendingFeedback.add(feedback)
}

export async function enqueuePhoto(photo: OfflinePhoto): Promise<void> {
  await db.pendingPhotos.add(photo)
}

export async function dequeueVisit(localId: string): Promise<void> {
  await db.pendingVisits.delete(localId)
}

export async function dequeueFeedback(localId: string): Promise<void> {
  await db.pendingFeedback.delete(localId)
}

export async function dequeuePhoto(localId: string): Promise<void> {
  await db.pendingPhotos.delete(localId)
}

export async function getPendingCounts() {
  const [visits, feedback, photos] = await Promise.all([
    db.pendingVisits.count(),
    db.pendingFeedback.count(),
    db.pendingPhotos.count(),
  ])
  return { visits, feedback, photos, total: visits + feedback + photos }
}

export async function markVisitAttempt(localId: string) {
  await db.pendingVisits.where('localId').equals(localId).modify(v => { v.attempts += 1 })
}

export async function markPhotoAttempt(localId: string) {
  await db.pendingPhotos.where('localId').equals(localId).modify(p => { p.attempts += 1 })
}
