import { useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { VisitProvider } from './contexts/VisitContext'
import { LoginPage } from './components/auth/LoginPage'
import { PendingActivation } from './components/auth/PendingActivation'
import { TermsModal } from './components/terms/TermsModal'
import { OnboardingModal } from './components/onboarding/OnboardingModal'
import { Layout } from './components/layout/Layout'
import { CheckScreen } from './screens/CheckScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { AdminScreen } from './screens/AdminScreen'
import { StoresScreen } from './screens/StoresScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { VisitDetailScreen } from './screens/VisitDetailScreen'
import { StoreDetailScreen } from './screens/StoreDetailScreen'
import { ReportsScreen } from './screens/ReportsScreen'
import { ActionsScreen } from './screens/ActionsScreen'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <VisitProvider>
          <AppRoutes />
        </VisitProvider>
      </AuthProvider>
    </HashRouter>
  )
}

function AppRoutes() {
  const { session, repProfile, loading, repLoading } = useAuth()
  const navigate = useNavigate()
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('ios_onboarding_done') === '1'
  )

  if (loading || (session && repLoading)) {
    return (
      <div className="min-h-screen bg-ios-navy flex items-center justify-center">
        <div className="text-white text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
          Loading...
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  if (!repProfile || !repProfile.is_active) {
    return <PendingActivation />
  }

  if (!repProfile.terms_accepted_at && !termsAccepted) {
    return <TermsModal onAccepted={() => { setTermsAccepted(true); navigate('/check', { replace: true }) }} />
  }

  if (!onboardingDone) {
    return <OnboardingModal onDone={() => { setOnboardingDone(true); navigate('/check', { replace: true }) }} />
  }

  const isManager = repProfile.role === 'manager' || repProfile.role === 'admin'

  return (
    <Routes>
      {/* Full-screen routes (no bottom nav) */}
      <Route path="/visit/:id" element={<VisitDetailScreen />} />
      <Route path="/store/:id" element={<StoreDetailScreen />} />

      {/* Tab shell routes */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/check" replace />} />
        <Route path="/check"   element={<CheckScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/stores"  element={<StoresScreen />} />
        <Route path="/actions" element={<ActionsScreen />} />
        <Route path="/me"      element={<ProfileScreen />} />
        {isManager && (
          <>
            <Route path="/reports" element={<ReportsScreen />} />
            <Route path="/admin"   element={<AdminScreen />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/check" replace />} />
      </Route>
    </Routes>
  )
}
