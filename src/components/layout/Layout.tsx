import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { SyncBanner } from './SyncBanner'

export function Layout() {
  const { repProfile } = useAuth()
  const isManager = repProfile?.role === 'manager' || repProfile?.role === 'admin'

  return (
    <div className="flex flex-col min-h-screen bg-ios-ltgrey">
      <SyncBanner />
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-ios-navy border-t border-ios-navylight safe-bottom z-40">
        <div className="flex">
          <TabItem to="/check"   icon="📋" label="Check" />
          <TabItem to="/history" icon="🕐" label="History" />
          <TabItem to="/stores"  icon="🏪" label="Stores" />
          {isManager && <TabItem to="/reports" icon="📊" label="Reports" />}
          {isManager && <TabItem to="/admin"   icon="👥" label="Admin" />}
        </div>
      </nav>
    </div>
  )
}

function TabItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center py-3 text-xs transition-colors ${
          isActive ? 'text-white' : 'text-blue-400'
        }`
      }
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <span className="text-xl mb-0.5">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}
