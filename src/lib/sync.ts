// ============================================================
// Sync engine — drains offline queues to Supabase
// Triggers: 60-second timer, online event, manual retry
// ============================================================
import { supabase } from './supabase'
import {
  db,
  dequeueVisit, dequeueFeedback, dequeuePhoto,
  markVisitAttempt, markFeedbackAttempt, markPhotoAttempt,
} from './db'

const MAX_ATTEMPTS = 5
let syncRunning = false
let syncInterval: ReturnType<typeof setInterval> | null = null
const listeners: Array<() => void> = []

export function onSyncChange(cb: () => void) {
  listeners.push(cb)
  return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1) }
}

function notify() { listeners.forEach(cb => cb()) }

export function startSyncEngine() {
  if (syncInterval) return
  drainQueue()
  syncInterval = setInterval(() => { drainQueue() }, 60_000)
  window.addEventListener('online', () => drainQueue())
}

export async function drainQueue() {
  if (syncRunning || !navigator.onLine) return
  syncRunning = true
  try {
    await drainVisits()
    await drainFeedback()
    await drainPhotos()
  } finally {
    syncRunning = false
    notify()
  }
}

async function drainVisits() {
  const pending = await db.pendingVisits.toArray()
  for (const item of pending) {
    if (item.attempts >= MAX_ATTEMPTS) continue
    try {
      const { error } = await supabase.from('ios_visits').insert({
        id:                  item.localId,
        store_id:            item.storeId,
        rep_id:              item.repId,
        visit_type:          item.visitType,
        checkin_at:          item.checkinAt,
        checkin_gps_lat:     item.checkinLat,
        checkin_gps_lng:     item.checkinLng,
        checkout_at:         item.checkoutAt,
        checkout_gps_lat:    item.checkoutLat,
        checkout_gps_lng:    item.checkoutLng,
        duration_minutes:    item.durationMinutes,
        synced_from_offline: true,
      })
      if (!error || (error as { code?: string }).code === '23505') {
        // Also write brand associations
        if (item.brandIds.length > 0) {
          await supabase.from('ios_visit_brands').upsert(
            item.brandIds.map(brandId => ({ visit_id: item.localId, brand_id: brandId })),
            { onConflict: 'visit_id,brand_id' }
          )
        }
        await dequeueVisit(item.localId)
      } else {
        await markVisitAttempt(item.localId)
      }
    } catch {
      await markVisitAttempt(item.localId)
    }
  }
}

async function drainFeedback() {
  // Only sync feedback after its parent visit has synced (no longer in pending queue)
  const pendingVisitIds = new Set(
    (await db.pendingVisits.toArray()).map(v => v.localId)
  )
  const pending = await db.pendingFeedback.filter(f => f.attempts < MAX_ATTEMPTS).toArray()
  for (const item of pending) {
    if (pendingVisitIds.has(item.visitLocalId)) continue
    try {
      const { error } = await supabase.from('ios_visit_feedback').insert({
        id:                  item.localId,
        visit_id:            item.visitLocalId,
        store_vibe:          item.storeVibe,
        sales_sentiment:     item.salesSentiment,
        affecting_sales:     item.affectingSales,
        what_would_help:     item.whatWouldHelp,
        store_changes:       item.storeChanges,
        store_changes_notes: item.storeChangesNotes,
        relationship_rating: item.relationshipRating,
        potential_issues:    item.potentialIssues,
        follow_up_required:  item.followUpRequired,
      })
      if (!error || (error as { code?: string }).code === '23505') {
        await dequeueFeedback(item.localId)
      } else {
        await markFeedbackAttempt(item.localId)
      }
    } catch {
      await markFeedbackAttempt(item.localId)
    }
  }
}

async function drainPhotos() {
  const pending = await db.pendingPhotos.filter(p => p.attempts < MAX_ATTEMPTS).toArray()
  for (const item of pending) {
    try {
      const blob = dataUrlToBlob(item.photoBlob)
      const path = `visits/${item.visitId}/${item.localId}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('ios-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) { await markPhotoAttempt(item.localId); continue }

      // Store path (not public URL) — bucket is private; sign URLs at display time
      const { error: insertError } = await supabase.from('ios_photos').insert({
        id:                    item.localId,
        visit_id:              item.visitId,
        store_id:              item.storeId,
        brand_id:              item.brandId,
        rep_id:                item.repId,
        category:              item.category,
        photo_url:             path,
        is_before:             item.isBefore,
        is_after:              item.isAfter,
        before_after_group_id: item.beforeAfterGroupId,
        visit_date:            item.visitDate,
        retailer_id:           item.retailerId,
        notes:                 item.notes,
        sync_status:           'synced',
      })
      if (!insertError || (insertError as { code?: string }).code === '23505') {
        await dequeuePhoto(item.localId)
      } else {
        await markPhotoAttempt(item.localId)
      }
    } catch {
      await markPhotoAttempt(item.localId)
    }
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(data)
  const buffer = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i)
  return new Blob([buffer], { type: mime })
}
