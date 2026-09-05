import { Link } from 'react-router-dom'
import { App as AdminApp } from '../admin/App'
import { ThemeProvider } from '../admin/context/ThemeContext'
import { ClinchStoreProvider } from '../admin/context/ClinchStoreContext'
import { useAuth } from '../context/AuthContext'
import '../admin/css/admin.css'

/**
 * Admin governance console.
 *
 * Identity comes from AuthContext, which is backed by a JWT the server
 * re-validates against the database on every request. This screen used to read
 * `dealflow_user` from localStorage and, when it found nothing, invent a "Dave
 * Admin" session and write it back — so anyone who typed the URL was admin. It
 * also offered a "Switch to Dave Admin (Full Control)" button that did the same
 * thing on demand. Both are gone; the route guard (ADMIN_ONLY) decides who gets
 * here, and the API refuses anyone it does not independently recognise as admin.
 */

export default function AdminPortal() {
  const { user } = useAuth()

  return (
    <div className="admin-portal-wrapper min-h-screen bg-[#f8fafc]">
      <div className="bg-[#0b1b33] text-white px-5 py-2 text-xs flex items-center
                      justify-between z-50 relative border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            Signed in as <strong>{user?.name}</strong> ({user?.role}). Administrator
            access — changes here affect every user.
          </span>
        </div>
        <Link to="/app/quotations" className="text-slate-300 hover:text-white">
          Back to Sales Workspace
        </Link>
      </div>

      <ThemeProvider>
        <ClinchStoreProvider>
          <AdminApp />
        </ClinchStoreProvider>
      </ThemeProvider>
    </div>
  )
}
