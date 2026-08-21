import { useState } from 'react'
import { useVisit } from '../../contexts/VisitContext'
import { useAuth } from '../../contexts/AuthContext'
import { enqueueVisit } from '../../lib/db'
import { drainQueue } from '../../lib/sync'
import { getPosition } from '../../lib/gps'
import { FeedbackForm } from './FeedbackForm'
import { PhotoCapture } from './PhotoCapture'
import { MerchandisingForm } from './MerchandisingForm'
import { TrainingForm } from './TrainingForm'
import { WishlistForm } from './WishlistForm'
import { CompetitorForm } from './CompetitorForm'

type Panel = 'home' | 'feedback' | 'photos' | 'merchandising' | 'training' | 'wishlist' | 'competitor'

const SURVEY_PANELS: Array<{ key: Panel; icon: string; label: string }> = [
  { key: 'feedback',      icon: '💬', label: 'Feedback'   },
  { key: 'photos',        icon: '📸', label: 'Photos'     },
  { key: 'merchandising', icon: '🏪', label: 'Merch'      },
  { key: 'training',      icon: '🎓', label: 'Training'   },
  { key: 'wishlist',      icon: '📋', label: 'Wishlist'   },
  { key: 'competitor',    icon: '🔍', label: 'Competitor' },
]

export function ActiveVisitPanel() {
  const { activeVisit, endVisit, addBrand, removeBrand, brands } = useActiveVisitBrands()
  const { repProfile } = useAuth()
  const [panel,        setPanel]        = useState<Panel>('home')
  const [checkingOut,  setCheckingOut]  = useState(false)
  const [completed,    setCompleted]    = useState<Set<Panel>>(new Set())
  const [checkoutWarn, setCheckoutWarn] = useState(false)

  if (!activeVisit) return null
  const visit = activeVisit

  function markDone(p: Panel) {
    if (p !== 'home') setCompleted(prev => new Set(prev).add(p))
    setPanel('home')
    setCheckoutWarn(false)
  }

  async function checkout() {
    if (!repProfile) return
    // Soft gate: warn if no survey forms completed
    if (completed.size === 0 && !checkoutWarn) {
      setCheckoutWarn(true)
      return
    }
    setCheckingOut(true)
    // Only capture GPS for physical visits
    const pos = visit.visitType !== 'remote' ? await getPosition() : null
    const now = new Date().toISOString()
    const durationMinutes = Math.round((Date.now() - new Date(visit.checkinAt).getTime()) / 60000)

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

  if (panel === 'feedback')      return <FeedbackForm      activeVisit={visit} onDone={() => markDone('feedback')} />
  if (panel === 'photos')        return <PhotoCapture       activeVisit={visit} onDone={() => markDone('photos')} />
  if (panel === 'merchandising') return <MerchandisingForm  activeVisit={visit} onDone={() => markDone('merchandising')} />
  if (panel === 'training')      return <TrainingForm       activeVisit={visit} onDone={() => markDone('training')} />
  if (panel === 'wishlist')      return <WishlistForm       activeVisit={visit} onDone={() => markDone('wishlist')} />
  if (panel === 'competitor')    return <CompetitorForm     activeVisit={visit} onDone={() => markDone('competitor')} />

  const elapsed = Math.round((Date.now() - new Date(visit.checkinAt).getTime()) / 60000)
  const isRemote = visit.visitType === 'remote'

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
          {isRemote ? '💻 Remote call' : '📍 Physical'} ·{' '}
          {elapsed} min{elapsed !== 1 ? 's' : ''} · {completed.size} form{completed.size !== 1 ? 's' : ''} saved
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

      {/* Action buttons — 3 col grid, completed forms show green tick */}
      <div className="grid grid-cols-3 gap-2">
        {SURVEY_PANELS.map(({ key, icon, label }) => {
          const done = completed.has(key)
          return (
            <button
              key={key}
              onClick={() => { setPanel(key); setCheckoutWarn(false) }}
              className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 relative ${
                done
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-white border-gray-200 text-ios-navy'
              }`}
            >
              <span className="text-xl">{done ? '✓' : icon}</span>
              {label}
            </button>
          )
        })}
      </div>

      {/* Soft checkout warning */}
      {checkoutWarn && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-center">
          <p className="text-amber-700 text-xs font-bold mb-1">No forms saved yet</p>
          <p className="text-amber-600 text-xs mb-3">
            Complete at least one form before checking out, or tap again to checkout anyway.
          </p>
          <button
            onClick={checkout}
            disabled={checkingOut}
            className="w-full py-2.5 rounded-lg bg-amber-500 text-white font-bold text-sm disabled:opacity-50"
          >
            {checkingOut ? 'Checking out...' : 'Check Out Anyway'}
          </button>
        </div>
      )}

      {/* Check out */}
      {!checkoutWarn && (
        <button
          onClick={checkout}
          disabled={checkingOut}
          className="w-full py-3 rounded-xl bg-ios-green text-white font-bold text-sm disabled:opacity-50"
        >
          {checkingOut ? 'Checking out...' : '✓  Check Out'}
        </button>
      )}
    </div>
  )
}

function useActiveVisitBrands() {
  const visitCtx = useVisit()
  const { brands } = useAuth()
  return { ...visitCtx, brands }
}
