import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface VisitDetail {
  id: string
  checkin_at: string
  checkout_at: string | null
  duration_minutes: number | null
  visit_type: string
  call_notes: string | null
  synced_from_offline: boolean
  ios_stores: {
    name: string
    suburb: string
    state: string
    store_number: string | null
    ios_retailers: { name: string } | null
  } | null
  ios_rep_profiles: { full_name: string } | null
}

interface FeedbackRow {
  id: string
  store_vibe: string | null
  sales_sentiment: string | null
  affecting_sales: string[]
  what_would_help: string[]
  store_changes: string[]
  store_changes_notes: string | null
  relationship_rating: string | null
  potential_issues: string[]
  follow_up_required: boolean
}

interface PhotoRow {
  id: string
  category: string
  is_before: boolean
  is_after: boolean
  notes: string | null
  photo_url: string   // storage path
  brand_id: string | null
}

const VIBE_LABEL: Record<string, string> = {
  very_positive: 'Very Positive', positive: 'Positive', neutral: 'Neutral',
  challenging: 'Challenging', poor: 'Poor',
}
const SENTIMENT_LABEL: Record<string, string> = {
  very_strong: 'Very Strong', strong: 'Strong', average: 'Average',
  slow: 'Slow', very_slow: 'Very Slow', unsure: 'Unsure',
}
const RELATIONSHIP_LABEL: Record<string, string> = {
  excellent: 'Excellent', good: 'Good', neutral: 'Neutral',
  needs_attention: 'Needs Attention', poor: 'Poor',
}

export function VisitDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { repProfile, brands } = useAuth()

  const [visit,    setVisit]    = useState<VisitDetail | null>(null)
  const [feedback, setFeedback] = useState<FeedbackRow | null>(null)
  const [photos,   setPhotos]   = useState<PhotoRow[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'detail' | 'feedback' | 'photos'>('detail')

  const isManager = repProfile?.role === 'manager' || repProfile?.role === 'admin'

  useEffect(() => {
    if (!id) return
    load(id)
  }, [id])

  async function load(visitId: string) {
    setLoading(true)
    const [visitRes, feedbackRes, photosRes] = await Promise.all([
      supabase
        .from('ios_visits')
        .select('id, checkin_at, checkout_at, duration_minutes, visit_type, call_notes, synced_from_offline, ios_stores(name, suburb, state, store_number, ios_retailers(name)), ios_rep_profiles(full_name)')
        .eq('id', visitId)
        .single(),
      supabase
        .from('ios_visit_feedback')
        .select('id, store_vibe, sales_sentiment, affecting_sales, what_would_help, store_changes, store_changes_notes, relationship_rating, potential_issues, follow_up_required')
        .eq('visit_id', visitId)
        .maybeSingle(),
      supabase
        .from('ios_photos')
        .select('id, category, is_before, is_after, notes, photo_url, brand_id')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: true }),
    ])

    setVisit((visitRes.data as unknown as VisitDetail) ?? null)
    setFeedback((feedbackRes.data as FeedbackRow | null) ?? null)

    const photoData = (photosRes.data ?? []) as PhotoRow[]
    setPhotos(photoData)

    // Generate signed URLs for all photos
    if (photoData.length > 0) {
      const urls: Record<string, string> = {}
      await Promise.all(
        photoData.map(async p => {
          const { data } = await supabase.storage
            .from('ios-photos')
            .createSignedUrl(p.photo_url, 3600)
          if (data?.signedUrl) urls[p.id] = data.signedUrl
        })
      )
      setSignedUrls(urls)
    }

    setLoading(false)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>Loading...</p>
      </div>
    )
  }
  if (!visit) {
    return (
      <div className="p-4">
        <button onClick={() => navigate(-1)} className="text-ios-blue text-sm mb-4">← Back</button>
        <p className="text-gray-400 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>Visit not found.</p>
      </div>
    )
  }

  const store = visit.ios_stores
  const retailer = store?.ios_retailers?.name ?? ''

  return (
    <div className="min-h-screen bg-ios-ltgrey" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="bg-ios-navy px-4 pt-4 pb-3">
        <button onClick={() => navigate(-1)} className="text-blue-300 text-sm mb-2">← Back</button>
        <p className="text-xs text-blue-300 uppercase tracking-wide">Visit</p>
        <p className="text-white font-bold text-base leading-tight">
          {retailer} {store?.name}
        </p>
        <p className="text-blue-200 text-xs mt-0.5">
          {store?.suburb}, {store?.state}
          {store?.store_number ? ` · #${store.store_number}` : ''}
        </p>
        <div className="flex gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            visit.checkout_at ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
          }`}>
            {visit.checkout_at ? 'Complete' : 'Open'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-700 text-white capitalize">
            {visit.visit_type}
          </span>
          {isManager && visit.ios_rep_profiles && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-700 text-white">
              {visit.ios_rep_profiles.full_name}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200 text-sm">
        {(['detail', 'feedback', 'photos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 font-bold capitalize ${
              tab === t ? 'text-ios-navy border-b-2 border-ios-navy' : 'text-gray-500'
            }`}
          >
            {t}{t === 'photos' && photos.length > 0 ? ` (${photos.length})` : ''}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* Detail tab */}
        {tab === 'detail' && (
          <>
            <InfoCard label="Check in" value={formatDate(visit.checkin_at)} />
            {visit.checkout_at && (
              <>
                <InfoCard label="Check out" value={formatDate(visit.checkout_at)} />
                <InfoCard label="Duration" value={`${visit.duration_minutes} minutes`} />
              </>
            )}
            <InfoCard label="Visit type" value={visit.visit_type === 'physical' ? '📍 Physical' : '💻 Remote'} />
            {visit.call_notes && (
              <div className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Call notes</p>
                <p className="text-sm text-ios-navy whitespace-pre-wrap">{visit.call_notes}</p>
              </div>
            )}
            {feedback && (
              <InfoCard
                label="Follow-up required"
                value={feedback.follow_up_required ? 'Yes' : 'No'}
                highlight={feedback.follow_up_required}
              />
            )}
          </>
        )}

        {/* Feedback tab */}
        {tab === 'feedback' && (
          feedback ? (
            <>
              {feedback.store_vibe && (
                <InfoCard label="Store vibe" value={VIBE_LABEL[feedback.store_vibe] ?? feedback.store_vibe} />
              )}
              {feedback.sales_sentiment && (
                <InfoCard label="Sales sentiment" value={SENTIMENT_LABEL[feedback.sales_sentiment] ?? feedback.sales_sentiment} />
              )}
              {feedback.relationship_rating && (
                <InfoCard label="Relationship" value={RELATIONSHIP_LABEL[feedback.relationship_rating] ?? feedback.relationship_rating} />
              )}
              {feedback.affecting_sales?.length > 0 && (
                <TagCard label="Affecting sales" tags={feedback.affecting_sales} />
              )}
              {feedback.what_would_help?.length > 0 && (
                <TagCard label="What would help" tags={feedback.what_would_help} />
              )}
              {feedback.store_changes?.length > 0 && (
                <TagCard label="Store changes" tags={feedback.store_changes} />
              )}
              {feedback.store_changes_notes && (
                <InfoCard label="Change notes" value={feedback.store_changes_notes} />
              )}
              {feedback.potential_issues?.length > 0 && (
                <TagCard label="Potential issues" tags={feedback.potential_issues} />
              )}
              {feedback.follow_up_required && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-amber-700 text-sm font-bold">Follow-up required</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">No feedback recorded for this visit.</p>
          )
        )}

        {/* Photos tab */}
        {tab === 'photos' && (
          photos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No photos for this visit.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {photos.map(photo => {
                const brand = brands.find(b => b.id === photo.brand_id)
                const url = signedUrls[photo.id]
                return (
                  <div key={photo.id} className="bg-white rounded-lg overflow-hidden border border-gray-200">
                    {url ? (
                      <img src={url} alt={photo.category} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">Loading...</span>
                      </div>
                    )}
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-bold text-ios-navy capitalize">{photo.category.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-500">
                        {photo.is_before ? 'Before' : photo.is_after ? 'After' : ''}
                        {brand ? ` · ${brand.name}` : ''}
                      </p>
                      {photo.notes && <p className="text-xs text-gray-400 mt-0.5">{photo.notes}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-lg px-4 py-3 border border-gray-200">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${highlight ? 'text-amber-600' : 'text-ios-navy'}`}>{value}</p>
    </div>
  )
}

function TagCard({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className="bg-white rounded-lg px-4 py-3 border border-gray-200">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span key={t} className="px-2 py-0.5 bg-ios-ltgrey text-ios-navy text-xs rounded-full">{t}</span>
        ))}
      </div>
    </div>
  )
}
