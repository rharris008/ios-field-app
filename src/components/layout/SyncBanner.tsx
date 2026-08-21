import { useEffect, useState } from 'react'
import { getPendingCounts, getDeadLetterCounts } from '../../lib/db'
import { onSyncChange, drainQueue } from '../../lib/sync'

export function SyncBanner() {
  const [total,      setTotal]      = useState(0)
  const [deadLetter, setDeadLetter] = useState(0)
  const [syncing,    setSyncing]    = useState(false)
  const [online,     setOnline]     = useState(navigator.onLine)

  useEffect(() => {
    refresh()
    const unsub = onSyncChange(() => { setSyncing(false); refresh() })
    const onOnline  = () => { setOnline(true);  refresh() }
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
    const [counts, dead] = await Promise.all([
      getPendingCounts(),
      getDeadLetterCounts(),
    ])
    setTotal(counts.total)
    setDeadLetter(dead)
  }

  if (total === 0 && online && deadLetter === 0) return null

  const showDead = deadLetter > 0

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-xs text-white ${
        !online ? 'bg-ios-red' : showDead ? 'bg-ios-red' : 'bg-ios-amber'
      }`}
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <span>
        {!online
          ? 'Offline — data will sync when you reconnect'
          : showDead
            ? `${deadLetter} item${deadLetter !== 1 ? 's' : ''} failed to sync`
            : `${total} item${total !== 1 ? 's' : ''} pending sync`}
      </span>
      {online && total > 0 && !showDead && (
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
