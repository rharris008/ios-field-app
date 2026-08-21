import { useState } from 'react'
import { saveSurveyResponses } from '../../lib/surveyHelper'
import type { ActiveVisit } from '../../contexts/VisitContext'

const WISHLIST_OPTIONS = [
  'More stock',
  'New products',
  'Additional range',
  'POS',
  'Display',
  'Training',
  'Promotional support',
  'Pricing support',
  'Account manager support',
  'Other',
]

interface Props {
  activeVisit: ActiveVisit
  onDone: () => void
}

export function WishlistForm({ activeVisit, onDone }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  function toggle(opt: string) {
    setSelected(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])
  }

  async function save() {
    setSaving(true)
    const entries: Array<{ question: string; answer: string }> = []
    if (selected.length > 0) {
      entries.push({ question: 'Retailer wishlist', answer: selected.join(', ') })
    }
    if (notes.trim()) {
      entries.push({ question: 'Wishlist notes', answer: notes.trim() })
    }
    if (entries.length > 0) {
      await saveSurveyResponses(activeVisit.localId, null, 'wishlist', entries)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(onDone, 600)
  }

  return (
    <div className="p-4 space-y-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <h2 className="text-ios-navy font-bold text-base">Retailer Wishlist</h2>
      <p className="text-xs text-gray-500">What does this retailer want?</p>

      <div className="flex flex-wrap gap-2">
        {WISHLIST_OPTIONS.map(opt => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              selected.includes(opt)
                ? 'bg-ios-navy text-white border-ios-navy'
                : 'border-gray-300 text-gray-700'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Any extra detail..."
          />
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || saved}
        className={`w-full py-3 rounded-lg font-bold text-sm ${
          saved ? 'bg-green-500 text-white' : 'bg-ios-navy text-white disabled:opacity-50'
        }`}
      >
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Wishlist'}
      </button>

      <button onClick={onDone} className="w-full py-2 text-ios-blue text-sm font-bold">
        Back to visit
      </button>
    </div>
  )
}
