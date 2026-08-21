import { useEffect, useState } from 'react'
import { getPendingCounts } from '../../lib/db'
import { onSyncChange, drainQueue } from '../../lib/sync'

export function SyncBanner() {
  const [counts, setCounts] = useState({ visits: 0, photos: 0 })
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    refresh()
    const unsub = onSyncChange(() => { setSyncing(false); refresh() })
    const onOnline  = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      unsub()
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  async function refresh() {
    const c = await getPendingCounts()
    setCounts(c)
  }

  const total = counts.visits + counts.photos
  if (total === 0 && online) return null

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-xs text-white ${
        online ? 'bg-ios-amber' : 'bg-ios-red'
      }`}
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <span>
        {online
          ? `${total} item${total !== 1 ? 's' : ''} pending sync`
          : 'Offline — data will sync when you reconnect'}
      </span>
      {online && total > 0 && (
        <button
          onClick={() => { setSyncing(true); drainQueue() }}
          disabled={syncing}
          className="ml-2 font-bold underline disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync now'}
        </button>
      )}
    </div>
  )
}
