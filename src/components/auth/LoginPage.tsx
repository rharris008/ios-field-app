import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-ios-navy flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src="/ios-field-app/ios-logo.png" alt="IOS" className="h-20 object-contain" />
        </div>

        <p className="text-center text-blue-200 text-sm mb-8" style={{ fontFamily: 'Arial, sans-serif' }}>
          Field Merchandising
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-blue-200 text-xs mb-1" style={{ fontFamily: 'Arial, sans-serif' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-lg bg-ios-navylight text-white placeholder-blue-300 border border-blue-700 focus:outline-none focus:border-blue-400 text-sm"
              style={{ fontFamily: 'Arial, sans-serif' }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-blue-200 text-xs mb-1" style={{ fontFamily: 'Arial, sans-serif' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-lg bg-ios-navylight text-white placeholder-blue-300 border border-blue-700 focus:outline-none focus:border-blue-400 text-sm"
              style={{ fontFamily: 'Arial, sans-serif' }}
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center" style={{ fontFamily: 'Arial, sans-serif' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-ios-blue text-white font-bold text-sm disabled:opacity-50"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-blue-400 text-xs mt-8" style={{ fontFamily: 'Arial, sans-serif' }}>
          Contact your manager to request access.
        </p>

        <p className="text-center text-blue-600 text-xs mt-2" style={{ fontFamily: 'Arial, sans-serif' }}>
          Integrated Outsourced Services
        </p>
      </div>
    </div>
  )
}
