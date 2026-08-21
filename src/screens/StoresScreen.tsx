import { useState } from 'react'
import { searchStores } from '../lib/db'
import type { Store } from '../types'

export function StoresScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Store[]>([])

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    const found = await searchStores(q)
    setResults(found.slice(0, 20))
  }

  return (
    <div className="p-4">
      <h1
        className="text-ios-navy text-lg font-bold mb-3"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        Stores
      </h1>
      <input
        type="search"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Search by name, suburb, or state..."
        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm mb-4"
        style={{ fontFamily: 'Arial, sans-serif' }}
      />
      {results.length === 0 && query.length >= 2 && (
        <p className="text-gray-400 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
          No stores found.
        </p>
      )}
      <div className="space-y-2">
        {results.map(store => (
          <div
            key={store.id}
            className="bg-white rounded-lg px-4 py-3 border border-gray-200"
          >
            <p
              className="font-bold text-ios-navy text-sm"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {store.retailer_name} {store.name}
            </p>
            <p
              className="text-gray-500 text-xs mt-0.5"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {store.suburb}, {store.state}
              {store.store_number ? ` · #${store.store_number}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
