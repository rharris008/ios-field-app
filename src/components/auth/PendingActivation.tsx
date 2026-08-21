import { useAuth } from '../../contexts/AuthContext'

export function PendingActivation() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-ios-navy flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm">
        <div className="text-5xl mb-6">⏳</div>
        <h1
          className="text-white text-xl font-bold mb-3"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          Account Pending Activation
        </h1>
        <p
          className="text-blue-200 text-sm mb-8 leading-relaxed"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          Your account has been created. An IOS administrator will activate
          your access shortly. Contact your manager if this takes longer than
          expected.
        </p>
        <button
          onClick={signOut}
          className="text-blue-400 text-sm underline"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
