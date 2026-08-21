import { useState } from 'react'
import { useVisit } from '../../contexts/VisitContext'
import { useAuth } from '../../contexts/AuthContext'
import { enqueueVisit } from '../../lib/db'
import { drainQueue } from '../../lib/sync'
import { getPosition } from '../../lib/gps'
import { FeedbackForm } from './FeedbackForm'
import { PhotoCapture } from './PhotoCapture'

type Panel = 'home' | 'feedback' | 'photos'

export function ActiveVisitPanel() {
  const { activeVisit, endVisit, addBrand, removeBrand, brands } = useActiveVisitBrands()
  const { repProfile } = useAuth()
  const [panel, setPanel] = useState<Panel>('home')
  const [checkingOut, setCheckingOut] = useState(false)

  if (!activeVisit) return null
  const visit = activeVisit  // narrow type so TS knows it's non-null in callbacks

  async function checkout() {
    if (!repProfile) return
    setCheckingOut(true)
    const pos = await getPosition()
    const now = new Date().toISOString()

    const checkinTime = new Date(visit.checkinAt)
    const durationMinutes = Math.round((Date.now() - checkinTime.getTime()) / 60000)

    await enqueueVisit({
      localId:         visit.localId,
      storeId:         visit.store.id,
      repId:           repProfile.id,
      visitType:       visit.visitType,
      checkinAt:       visit.checkinAt,
      checkinLat:      visit.checkinLat,
      checkinLng:      visit.checkinLng,
      checkoutAt:      now,
      checkoutLat:     pos?.lat ?? null,
      checkoutLng:     pos?.lng ?? null,
      durationMinutes,
      brandIds:        visit.brandIds,
      attempts:        0,
      lastAttempt:     null,
    })
    drainQueue()
    endVisit()
    setCheckingOut(false)
  }

  if (panel === 'feedback') {
    return <FeedbackForm activeVisit={visit} onDone={() => setPanel('home')} />
  }
  if (panel === 'photos') {
    return <PhotoCapture activeVisit={visit} onDone={() => setPanel('home')} />
  }

  const elapsed = Math.round((Date.now() - new Date(visit.checkinAt).getTime()) / 60000)

  return (
    <div className="p-4 space-y-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Visit header */}
      <div className="bg-ios-navy rounded-xl p-4 text-white">
        <p className="text-xs opacity-70 uppercase tracking-wide">Active Visit</p>
        <p className="font-bold text-lg leading-tight mt-0.5">
          {visit.store.retailer_name} {visit.store.name}
        </p>
        <p className="text-xs opacity-70 mt-0.5">
          {visit.store.suburb}, {visit.store.state}
        </p>
        <p className="text-xs mt-2 opacity-80">
          {visit.visitType === 'physical' ? '📍 Physical' : '💻 Remote'} ·{' '}
          {elapsed} min{elapsed !== 1 ? 's' : ''} in store
        </p>
      </div>

      {/* Brand toggles */}
      <div>
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
          Brands being serviced
        </p>
        <div className="flex flex-wrap gap-2">
          {brands.map(b => {
            const active = visit.brandIds.includes(b.id)
            return (
              <button
                key={b.id}
                onClick={() => active ? removeBrand(b.id) : addBrand(b.id)}
                className={`px-3 py-1.5 rounded-full text-xs border ${
                  active
                    ? 'bg-ios-blue text-white border-ios-blue'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                {b.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setPanel('feedback')}
          className="py-4 rounded-xl bg-white border border-gray-200 text-ios-navy text-sm font-bold flex flex-col items-center gap-1"
        >
          <span className="text-2xl">💬</span>
          Feedback
        </button>
        <button
          onClick={() => setPanel('photos')}
          className="py-4 rounded-xl bg-white border border-gray-200 text-ios-navy text-sm font-bold flex flex-col items-center gap-1"
        >
          <span className="text-2xl">📸</span>
          Photos
        </button>
      </div>

      {/* Check out */}
      <button
        onClick={checkout}
        disabled={checkingOut}
        className="w-full py-3 rounded-xl bg-ios-green text-white font-bold text-sm disabled:opacity-50"
      >
        {checkingOut ? 'Checking out...' : '✓  Check Out'}
      </button>
    </div>
  )
}

// Hook to pull brands from context without prop drilling
function useActiveVisitBrands() {
  const visitCtx = useVisit()
  const { brands } = useAuth()
  return { ...visitCtx, brands }
}
