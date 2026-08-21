import { useAuth } from '../contexts/AuthContext'

export function AdminScreen() {
  const { repProfile } = useAuth()

  return (
    <div className="p-4">
      <h1
        className="text-ios-navy text-lg font-bold mb-2"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        Admin
      </h1>
      <p
        className="text-gray-400 text-sm mb-4"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        Signed in as {repProfile?.full_name} ({repProfile?.role})
      </p>
      <p
        className="text-gray-400 text-sm"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        Team overview, rep management, and report generation — coming in Stage 3.
      </p>
    </div>
  )
}
