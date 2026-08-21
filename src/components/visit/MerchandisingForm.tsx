import { useState } from 'react'
import { saveSurveyResponses } from '../../lib/surveyHelper'
import type { ActiveVisit } from '../../contexts/VisitContext'
import { useAuth } from '../../contexts/AuthContext'

const QUESTIONS = [
  'Product displayed?',
  'Pricing correct?',
  'Facing correct?',
  'Display acceptable?',
  'POS correct?',
  'Box stack / display required?',
  'Stock brought onto floor?',
]

type Answer = 'yes' | 'no' | 'na' | ''

interface Props {
  activeVisit: ActiveVisit
  onDone: () => void
}

export function MerchandisingForm({ activeVisit, onDone }: Props) {
  const { repBrands } = useAuth()

  const activeBrands = repBrands.filter(b => activeVisit.brandIds.includes(b.id))
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(activeBrands[0]?.id ?? null)

  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(QUESTIONS.map(q => [q, '']))
  )
  const [issueNotes, setIssueNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const hasIssues = Object.values(answers).some(a => a === 'no')

  function setAnswer(question: string, value: Answer) {
    setAnswers(prev => ({ ...prev, [question]: value }))
  }

  async function save() {
    setSaving(true)
    const entries: Array<{ question: string; answer: string }> = [
      ...QUESTIONS
        .filter(q => answers[q])
        .map(q => ({ question: q, answer: answers[q] })),
    ]
    if (hasIssues && issueNotes) {
      entries.push({ question: 'Issue notes', answer: issueNotes })
    }
    await saveSurveyResponses(activeVisit.localId, selectedBrandId, 'merchandising', entries)
    setSaving(false)
    setSaved(true)
    setTimeout(onDone, 600)
  }

  return (
    <div className="p-4 space-y-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <h2 className="text-ios-navy font-bold text-base">Merchandising Compliance</h2>

      {activeBrands.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Brand</p>
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
        </div>
      )}

      <div className="space-y-3">
        {QUESTIONS.map(q => (
          <div key={q} className="bg-white rounded-lg px-4 py-3 border border-gray-200">
            <p className="text-sm text-ios-navy font-bold mb-2">{q}</p>
            <div className="flex gap-2">
              {(['yes', 'no', 'na'] as Answer[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setAnswer(q, opt)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border uppercase ${
                    answers[q] === opt
                      ? opt === 'yes'
                        ? 'bg-green-500 text-white border-green-500'
                        : opt === 'no'
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-gray-400 text-white border-gray-400'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {opt === 'na' ? 'N/A' : opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasIssues && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Issue notes</label>
          <textarea
            value={issueNotes}
            onChange={e => setIssueNotes(e.target.value)}
            rows={3}
            placeholder="Describe the issues..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Merchandising'}
      </button>

      <button onClick={onDone} className="w-full py-2 text-ios-blue text-sm font-bold">
        Back to visit
      </button>
    </div>
  )
}
