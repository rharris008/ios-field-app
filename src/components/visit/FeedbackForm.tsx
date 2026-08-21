import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { enqueueFeedback } from '../../lib/db'
import { drainQueue } from '../../lib/sync'
import type { ActiveVisit } from '../../contexts/VisitContext'
import {
  STORE_VIBE_OPTIONS, SALES_SENTIMENT_OPTIONS, AFFECTING_SALES_OPTIONS,
  WHAT_WOULD_HELP_OPTIONS, STORE_CHANGE_OPTIONS, RELATIONSHIP_OPTIONS,
  POTENTIAL_ISSUE_OPTIONS,
} from '../../types'

interface Props {
  activeVisit: ActiveVisit
  onDone: () => void
}

function RadioGroup({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(value === o.value ? '' : o.value)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              value === o.value
                ? 'bg-ios-navy text-white border-ios-navy'
                : 'border-gray-300 text-gray-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MultiSelect({ label, options, value, onChange }: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(o: string) {
    onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o])
  }
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              value.includes(o)
                ? 'bg-ios-navy text-white border-ios-navy'
                : 'border-gray-300 text-gray-700'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FeedbackForm({ activeVisit, onDone }: Props) {
  const [storeVibe,        setStoreVibe]        = useState('')
  const [salesSentiment,   setSalesSentiment]   = useState('')
  const [affectingSales,   setAffectingSales]   = useState<string[]>([])
  const [whatWouldHelp,    setWhatWouldHelp]    = useState<string[]>([])
  const [storeChanges,     setStoreChanges]     = useState<string[]>([])
  const [storeChangesNotes,setStoreChangesNotes]= useState('')
  const [relationship,     setRelationship]     = useState('')
  const [potentialIssues,  setPotentialIssues]  = useState<string[]>([])
  const [followUp,         setFollowUp]         = useState(false)
  const [followUpNotes,    setFollowUpNotes]    = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await enqueueFeedback({
      localId:           uuid(),
      visitLocalId:      activeVisit.localId,
      storeVibe:         storeVibe   || null,
      salesSentiment:    salesSentiment || null,
      affectingSales,
      whatWouldHelp,
      storeChanges,
      storeChangesNotes,
      relationshipRating:relationship || null,
      potentialIssues,
      followUpRequired:  followUp,
      attempts:          0,
    })
    drainQueue()
    setSaving(false)
    onDone()
  }

  return (
    <div className="p-4 space-y-5" style={{ fontFamily: 'Arial, sans-serif' }}>
      <h2 className="text-ios-navy font-bold text-base">Store Feedback</h2>

      <RadioGroup
        label="Store vibe"
        options={STORE_VIBE_OPTIONS}
        value={storeVibe}
        onChange={setStoreVibe}
      />
      <RadioGroup
        label="Sales sentiment"
        options={SALES_SENTIMENT_OPTIONS}
        value={salesSentiment}
        onChange={setSalesSentiment}
      />
      <MultiSelect
        label="What is affecting sales?"
        options={AFFECTING_SALES_OPTIONS}
        value={affectingSales}
        onChange={setAffectingSales}
      />
      <MultiSelect
        label="What would help?"
        options={WHAT_WOULD_HELP_OPTIONS}
        value={whatWouldHelp}
        onChange={setWhatWouldHelp}
      />
      <MultiSelect
        label="Store changes"
        options={STORE_CHANGE_OPTIONS}
        value={storeChanges}
        onChange={setStoreChanges}
      />
      {storeChanges.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Store changes notes</label>
          <textarea
            value={storeChangesNotes}
            onChange={e => setStoreChangesNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}
      <RadioGroup
        label="Relationship rating"
        options={RELATIONSHIP_OPTIONS}
        value={relationship}
        onChange={setRelationship}
      />
      <MultiSelect
        label="Potential issues"
        options={POTENTIAL_ISSUE_OPTIONS}
        value={potentialIssues}
        onChange={setPotentialIssues}
      />

      {/* Follow-up */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFollowUp(f => !f)}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
            followUp ? 'bg-ios-navy border-ios-navy' : 'border-gray-400'
          }`}
        >
          {followUp && <span className="text-white text-xs">✓</span>}
        </button>
        <span className="text-sm text-gray-700">Follow-up required</span>
      </div>
      {followUp && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Follow-up notes</label>
          <textarea
            value={followUpNotes}
            onChange={e => setFollowUpNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-lg bg-ios-navy text-white font-bold text-sm disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Feedback'}
      </button>
    </div>
  )
}
