import { useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { saveSurveyResponses } from '../../lib/surveyHelper'
import { enqueuePhoto } from '../../lib/db'
import { drainQueue } from '../../lib/sync'
import { compressImage } from '../../lib/imageCompress'
import type { ActiveVisit } from '../../contexts/VisitContext'
import { useAuth } from '../../contexts/AuthContext'

const ACTIVITY_TYPES = [
  'Promotion', 'New product', 'Pricing', 'Display', 'POS', 'Training / activity',
]

interface CompetitorEntry {
  id: string
  competitor: string
  activities: string[]
  source: 'observed' | 'word_on_street'
  notes: string
  photoCount: number
}

function emptyEntry(): CompetitorEntry {
  return {
    id: uuid(), competitor: '', activities: [], source: 'observed', notes: '', photoCount: 0,
  }
}

interface Props {
  activeVisit: ActiveVisit
  onDone: () => void
}

export function CompetitorForm({ activeVisit, onDone }: Props) {
  const { repProfile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [entries,     setEntries]     = useState<CompetitorEntry[]>([emptyEntry()])
  const [activeIdx,   setActiveIdx]   = useState(0)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [uploading,   setUploading]   = useState(false)

  function updateEntry(idx: number, patch: Partial<CompetitorEntry>) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }

  function toggleActivity(idx: number, act: string) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e
      const activities = e.activities.includes(act)
        ? e.activities.filter(a => a !== act)
        : [...e.activities, act]
      return { ...e, activities }
    }))
  }

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
        storeId: activeVisit.store.id, brandId: null,
        repId: repProfile.id, category: 'competitor',
        photoBlob: blob, isBefore: false, isAfter: false,
        beforeAfterGroupId: null, visitDate,
        retailerId: activeVisit.store.retailer_id,
        notes: entries[activeIdx]?.competitor ?? 'Competitor',
        attempts: 0,
      })
      updateEntry(activeIdx, { photoCount: (entries[activeIdx]?.photoCount ?? 0) + 1 })
      drainQueue()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function save() {
    const validEntries = entries.filter(e => e.competitor.trim())
    if (validEntries.length === 0) { onDone(); return }
    setSaving(true)
    const rows: Array<{ question: string; answer: string }> = []
    for (const e of validEntries) {
      rows.push({ question: 'Competitor', answer: e.competitor })
      if (e.activities.length > 0) rows.push({ question: 'Activity', answer: e.activities.join(', ') })
      rows.push({ question: 'Source', answer: e.source === 'observed' ? 'Observed' : 'Word on the street' })
      if (e.notes) rows.push({ question: 'Notes', answer: e.notes })
    }
    await saveSurveyResponses(activeVisit.localId, null, 'competitor_intel', rows)
    setSaving(false)
    setSaved(true)
    setTimeout(onDone, 600)
  }

  const entry = entries[activeIdx]

  return (
    <div className="p-4 space-y-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-ios-navy font-bold text-base">Competitor Intelligence</h2>
        {entries.length > 1 && (
          <div className="flex gap-1">
            {entries.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`w-6 h-6 rounded-full text-xs font-bold ${
                  i === activeIdx ? 'bg-ios-navy text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Competitor name */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Competitor</label>
        <input
          type="text"
          value={entry.competitor}
          onChange={e => updateEntry(activeIdx, { competitor: e.target.value })}
          placeholder="e.g. LG, Samsung"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Activity type */}
      <div>
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Activity type</p>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map(act => (
            <button
              key={act}
              onClick={() => toggleActivity(activeIdx, act)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                entry.activities.includes(act)
                  ? 'bg-ios-navy text-white border-ios-navy'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              {act}
            </button>
          ))}
        </div>
      </div>

      {/* Source */}
      <div>
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Source</p>
        <div className="flex gap-3">
          {(['observed', 'word_on_street'] as const).map(s => (
            <button
              key={s}
              onClick={() => updateEntry(activeIdx, { source: s })}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold border ${
                entry.source === s
                  ? 'bg-ios-navy text-white border-ios-navy'
                  : 'border-gray-300 text-gray-600'
              }`}
            >
              {s === 'observed' ? 'Observed' : 'Word on the street'}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea
          value={entry.notes}
          onChange={e => updateEntry(activeIdx, { notes: e.target.value })}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Keep it short..."
        />
      </div>

      {/* Photo + Add another */}
      <div className="flex gap-2">
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handlePhoto} />
        <button
          onClick={() => { setActiveIdx(entries.length - 1); inputRef.current?.click() }}
          disabled={uploading}
          className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-bold disabled:opacity-50"
        >
          {uploading ? '...' : `📸 Photo${entry.photoCount > 0 ? ` (${entry.photoCount})` : ''}`}
        </button>
        <button
          onClick={() => { setEntries(prev => [...prev, emptyEntry()]); setActiveIdx(entries.length) }}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-bold"
        >
          + Add
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving || saved}
        className={`w-full py-3 rounded-lg font-bold text-sm ${
          saved ? 'bg-green-500 text-white' : 'bg-ios-navy text-white disabled:opacity-50'
        }`}
      >
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Competitor Intel'}
      </button>

      <button onClick={onDone} className="w-full py-2 text-ios-blue text-sm font-bold">
        Back to visit
      </button>
    </div>
  )
}
