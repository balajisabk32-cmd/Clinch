import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { App as AdminApp } from '../admin/App'
import { ThemeProvider } from '../admin/context/ThemeContext'
import { ClinchStoreProvider } from '../admin/context/ClinchStoreContext'
import '../admin/css/admin.css'

interface UserSession {
  name: string
  email: string
  role: 'CUSTOMER' | 'MANAGER' | 'REP' | 'ADMIN'
  title?: string
  badge?: string
}

export default function AdminPortal() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dealflow_user')
      if (stored) {
        const parsed = JSON.parse(stored) as UserSession
        setCurrentUser(parsed)
      } else {
        // Fallback default admin session
        const defaultAdmin: UserSession = {
          name: 'Dave Admin',
          email: 'admin@dealflow360.com',
          role: 'ADMIN',
          title: 'Master Systems Administrator',
          badge: 'Master Platform Control'
        }
        localStorage.setItem('dealflow_user', JSON.stringify(defaultAdmin))
        localStorage.setItem('dealflow_active_role', 'ADMIN')
        setCurrentUser(defaultAdmin)
      }
    } catch {
      const defaultAdmin: UserSession = {
        name: 'Dave Admin',
        email: 'admin@dealflow360.com',
        role: 'ADMIN',
        title: 'Master Systems Administrator',
        badge: 'Master Platform Control'
      }
      setCurrentUser(defaultAdmin)
    } finally {
      setIsCheckingAuth(false)
    }
  }, [navigate])

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-[#0b1b33]">
        <div className="flex items-center gap-3 font-medium text-sm">
          <div className="w-4 h-4 border-2 border-[#00a3e0] border-t-transparent rounded-full animate-spin"></div>
          <span>Verifying RevOps Admin Permissions...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-portal-wrapper min-h-screen bg-[#f8fafc]">
      {/* Top Banner if logged in as non-admin persona */}
      {currentUser && currentUser.role !== 'ADMIN' && (
        <div className="bg-[#0b1b33] text-white px-5 py-2 text-xs flex items-center justify-between z-50 relative border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>
              Signed in as <strong>{currentUser.name}</strong> ({currentUser.role}). Viewing Admin Governance Console.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const adminSession: UserSession = {
                  name: 'Dave Admin',
                  email: 'admin@dealflow360.com',
                  role: 'ADMIN',
                  title: 'Master Systems Administrator',
                  badge: 'Full Master Platform Control'
                }
                localStorage.setItem('dealflow_user', JSON.stringify(adminSession))
                localStorage.setItem('dealflow_active_role', 'ADMIN')
                setCurrentUser(adminSession)
              }}
              className="text-[#00a3e0] hover:underline font-semibold"
            >
              Switch to Dave Admin (Full Control)
            </button>
            <Link to="/app/quotations" className="text-slate-300 hover:text-white">
              Back to Sales Workspace
            </Link>
          </div>
        </div>
      )}

      <ThemeProvider>
        <ClinchStoreProvider>
          <AdminApp />
        </ClinchStoreProvider>
      </ThemeProvider>
    </div>
  )
}
