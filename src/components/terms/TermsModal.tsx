import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export function TermsModal({ onAccepted }: { onAccepted: () => void }) {
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)

  async function accept() {
    if (!session) return
    setBusy(true)
    await supabase
      .from('ios_rep_profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', session.user.id)
    setBusy(false)
    onAccepted()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-50">
      <div className="bg-white w-full rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-gray-200">
          <h2
            className="text-ios-navy text-lg font-bold"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            Terms of Use
          </h2>
        </div>
        <div
          className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-700 space-y-4 leading-relaxed"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          <p>
            This application is provided by Integrated Outsourced Services (IOS), a division of the Mann &amp; Noble Group. By using this application, you agree to the following terms.
          </p>
          <p>
            <strong>Authorised use only.</strong> This application is for use by authorised IOS field representatives and management only. Your account is personal and must not be shared.
          </p>
          <p>
            <strong>Data collection.</strong> This application collects visit records, photographs, and location data as part of your field activities. All data is stored securely and used solely for business reporting and client service purposes.
          </p>
          <p>
            <strong>Photographs.</strong> Photos taken through this app are the property of IOS and may be used in client reports and presentations. Do not photograph individuals without consent.
          </p>
          <p>
            <strong>Confidentiality.</strong> All store, client, and competitive information captured in this app is confidential. Do not share data, screenshots, or reports with unauthorised parties.
          </p>
          <p>
            <strong>Device and connectivity.</strong> You are responsible for maintaining your device in working order. The app operates offline and will sync data when connectivity is restored.
          </p>
          <p>
            <strong>Accuracy.</strong> You are responsible for the accuracy of information you enter. Falsifying visit records or feedback is grounds for disciplinary action.
          </p>
          <p className="text-gray-400 text-xs">
            IOS Field App v1.0 | Mann &amp; Noble Group | Last updated 21/08/2026
          </p>
        </div>
        <div className="px-5 py-4 border-t border-gray-200">
          <button
            onClick={accept}
            disabled={busy}
            className="w-full py-3 rounded-lg bg-ios-navy text-white font-bold text-sm disabled:opacity-50"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {busy ? 'Saving...' : 'I Accept'}
          </button>
        </div>
      </div>
    </div>
  )
}
