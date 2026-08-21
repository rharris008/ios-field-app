import { useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { compressImage } from '../../lib/imageCompress'
import { enqueuePhoto } from '../../lib/db'
import { drainQueue } from '../../lib/sync'
import { useAuth } from '../../contexts/AuthContext'
import type { ActiveVisit } from '../../contexts/VisitContext'
import { PHOTO_CATEGORIES, type PhotoCategory } from '../../types'

interface Props {
  activeVisit: ActiveVisit
  onDone: () => void
}

export function PhotoCapture({ activeVisit, onDone }: Props) {
  const { repProfile, brands } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const activeBrands = brands.filter(b => activeVisit.brandIds.includes(b.id))
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
    activeBrands[0]?.id ?? null
  )
  const [category, setCategory] = useState<PhotoCategory>('merchandising')
  const [isBefore, setIsBefore] = useState(false)
  const [isAfter,  setIsAfter]  = useState(false)
  const [groupId]               = useState(() => uuid())
  const [notes,    setNotes]    = useState('')
  const [uploading,setUploading]= useState(false)
  const [count,    setCount]    = useState(0)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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
        localId:            uuid(),
        visitId:            activeVisit.localId,
        storeId:            activeVisit.store.id,
        brandId:            selectedBrandId,
        repId:              repProfile.id,
        category,
        photoBlob:          blob,
        isBefore,
        isAfter,
        beforeAfterGroupId: (isBefore || isAfter) ? groupId : null,
        visitDate,
        retailerId:         activeVisit.store.retailer_id,
        notes,
        attempts:           0,
      })
      setCount(c => c + 1)
      drainQueue()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="p-4 space-y-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <h2 className="text-ios-navy font-bold text-base">Capture Photos</h2>

      {/* Brand selector — only shown when multiple brands active */}
      {activeBrands.length > 1 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Brand</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedBrandId(null)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                !selectedBrandId
                  ? 'bg-ios-navy text-white border-ios-navy'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              General
            </button>
            {activeBrands.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBrandId(b.id)}
                className={`px-3 py-1.5 rounded-full text-xs border ${
                  selectedBrandId === b.id
                    ? 'bg-ios-blue text-white border-ios-blue'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category picker */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as PhotoCategory)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {PHOTO_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Before / After toggles */}
      <div className="flex gap-3">
        <button
          onClick={() => { const next = !isBefore; setIsBefore(next); if (next) setIsAfter(false) }}
          className={`flex-1 py-2 rounded-lg text-sm font-bold border ${
            isBefore ? 'bg-ios-blue text-white border-ios-blue' : 'border-gray-300 text-gray-600'
          }`}
        >
          Before
        </button>
        <button
          onClick={() => { const next = !isAfter; setIsAfter(next); if (next) setIsBefore(false) }}
          className={`flex-1 py-2 rounded-lg text-sm font-bold border ${
            isAfter ? 'bg-ios-blue text-white border-ios-blue' : 'border-gray-300 text-gray-600'
          }`}
        >
          After
        </button>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="e.g. End cap, bay 4"
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full py-3 rounded-lg bg-ios-navy text-white font-bold text-sm disabled:opacity-50"
      >
        {uploading ? 'Saving...' : '📷  Take Photo'}
      </button>

      {count > 0 && (
        <p className="text-center text-green-600 text-sm">
          {count} photo{count !== 1 ? 's' : ''} captured this session
        </p>
      )}

      <button onClick={onDone} className="w-full py-2 text-ios-blue text-sm font-bold">
        Done with photos
      </button>
    </div>
  )
}
