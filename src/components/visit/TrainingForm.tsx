import { useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { saveSurveyResponses } from '../../lib/surveyHelper'
import { enqueuePhoto } from '../../lib/db'
import { drainQueue } from '../../lib/sync'
import { compressImage } from '../../lib/imageCompress'
import type { ActiveVisit } from '../../contexts/VisitContext'
import { useAuth } from '../../contexts/AuthContext'

const ENGAGEMENT_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor']

interface Props {
  activeVisit: ActiveVisit
  onDone: () => void
}

export function TrainingForm({ activeVisit, onDone }: Props) {
  const { repProfile, repBrands } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const activeBrands = repBrands.filter(b => activeVisit.brandIds.includes(b.id))
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(activeBrands[0]?.id ?? null)

  const [occurred,    setOccurred]    = useState(false)
  const [numTrained,  setNumTrained]  = useState('')
  const [product,     setProduct]     = useState('')
  const [duration,    setDuration]    = useState('')
  const [engagement,  setEngagement]  = useState('')
  const [notes,       setNotes]       = useState('')
  const [photoCount,  setPhotoCount]  = useState(0)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [uploading,   setUploading]   = useState(false)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !repProfile) return
    setUploading(true)
    try {
      const blob = await compressImage(file)
      const visitDate = new Date().toLocaleDateString('en-AU', {
        timeZone: 'Australia/Brisbane',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).split('/').reverse().join('-')
      await enqueuePhoto({
        localId: uuid(), visitId: activeVisit.localId,
        storeId: activeVisit.store.id, brandId: selectedBrandId,
        repId: repProfile.id, category: 'training',
        photoBlob: blob, isBefore: false, isAfter: false,
        beforeAfterGroupId: null, visitDate,
        retailerId: activeVisit.store.retailer_id, notes: 'Training',
        attempts: 0,
      })
      setPhotoCount(c => c + 1)
      drainQueue()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function save() {
    setSaving(true)
    const entries: Array<{ question: string; answer: string }> = [
      { question: 'Training occurred', answer: occurred ? 'yes' : 'no' },
    ]
    if (occurred) {
      if (numTrained)  entries.push({ question: 'Number trained', answer: numTrained })
      if (product)     entries.push({ question: 'Product / category', answer: product })
      if (duration)    entries.push({ question: 'Duration (minutes)', answer: duration })
      if (engagement)  entries.push({ question: 'Engagement', answer: engagement })
      if (notes)       entries.push({ question: 'Notes', answer: notes })
    }
    await saveSurveyResponses(activeVisit.localId, selectedBrandId, 'training', entries)
    setSaving(false)
    setSaved(true)
    setTimeout(onDone, 600)
  }

  return (
    <div className="p-4 space-y-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <h2 className="text-ios-navy font-bold text-base">Training</h2>

      {activeBrands.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {activeBrands.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBrandId(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                selectedBrandId === b.id
                  ? 'bg-ios-navy text-white border-ios-navy'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Occurred toggle */}
      <div className="bg-white rounded-lg px-4 py-3 border border-gray-200">
        <p className="text-sm font-bold text-ios-navy mb-3">Did training occur this visit?</p>
        <div className="flex gap-3">
          <button
            onClick={() => setOccurred(true)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold border ${
              occurred ? 'bg-ios-navy text-white border-ios-navy' : 'border-gray-300 text-gray-600'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => setOccurred(false)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold border ${
              !occurred ? 'bg-gray-200 text-gray-700 border-gray-200' : 'border-gray-300 text-gray-600'
            }`}
          >
            No
          </button>
        </div>
      </div>

      {occurred && (
        <>
          <div className="space-y-3">
            <Field label="Number trained" type="number" value={numTrained} onChange={setNumTrained} placeholder="e.g. 4" />
            <Field label="Product / category" value={product} onChange={setProduct} placeholder="e.g. Midea washing machines" />
            <Field label="Duration (minutes)" type="number" value={duration} onChange={setDuration} placeholder="e.g. 30" />
          </div>

          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Engagement</p>
            <div className="flex gap-2">
              {ENGAGEMENT_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setEngagement(engagement === opt ? '' : opt)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border ${
                    engagement === opt
                      ? 'bg-ios-navy text-white border-ios-navy'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <input ref={inputRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handlePhoto} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2.5 rounded-lg border border-ios-navy text-ios-navy text-sm font-bold disabled:opacity-50"
          >
            {uploading ? 'Saving...' : `📸 Add training photo${photoCount > 0 ? ` (${photoCount})` : ''}`}
          </button>
        </>
      )}

      <button
        onClick={save}
        disabled={saving || saved}
        className={`w-full py-3 rounded-lg font-bold text-sm ${
          saved ? 'bg-green-500 text-white' : 'bg-ios-navy text-white disabled:opacity-50'
        }`}
      >
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Training'}
      </button>

      <button onClick={onDone} className="w-full py-2 text-ios-blue text-sm font-bold">
        Back to visit
      </button>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  )
}
