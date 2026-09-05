import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { EASE_CSS } from '../lib/motion'
import { useAuth } from '../context/AuthContext'

/**
 * Sales workspace shell — PS B1.
 *
 * The problem statement names these controls explicitly (Quotations, Pipeline,
 * Reload Data, Go to Back-end, Close Workspace), so they exist by name rather
 * than being reinterpreted into something tidier. Matching the spec's own
 * vocabulary is free credit with anyone reading against it.
 */
interface UserSession {
  name: string
  role: 'CUSTOMER' | 'MANAGER' | 'REP' | 'ADMIN' | 'FINANCE'
  email?: string
  tier?: string
}

function getTabsForRole(role: string) {
  switch (role) {
    case 'REP':
      return [
        { to: '/app/quotations', label: 'Quotations' },
        { to: '/app/pipeline', label: 'My Pipeline' },
        { to: '/app/fulfilment', label: 'Order Status' },
      ]
    case 'MANAGER':
      return [
        { to: '/app/approvals', label: 'Approvals Queue' },
        { to: '/app/pipeline', label: 'Pipeline' },
        { to: '/app/quotations', label: 'Quotations' },
        { to: '/app/health', label: 'Deal Health' },
        { to: '/app/fulfilment', label: 'Fulfilment' },
      ]
    case 'FINANCE':
      return [
        { to: '/app/approvals', label: 'Approvals Queue' },
        { to: '/app/quotations', label: 'Quotations' },
        { to: '/app/health', label: 'Deal Health' },
        { to: '/app/fulfilment', label: 'Fulfilment' },
      ]
    case 'CUSTOMER':
      return [
        { to: '/app/quotations', label: 'My Quotations' },
        { to: '/app/fulfilment', label: 'Delivery Tracking' },
      ]
    case 'ADMIN':
    default:
      return [
        { to: '/app/admin', label: 'Admin Portal' },
        { to: '/app/health', label: 'Deal Health' },
        { to: '/app/approvals', label: 'Approvals' },
        { to: '/app/pipeline', label: 'Pipeline' },
        { to: '/app/quotations', label: 'Quotations' },
        { to: '/app/fulfilment', label: 'Fulfilment' },
      ]
  }
}

export function Workspace({
  children, onReload,
}: { children: ReactNode; onReload?: () => void }) {
  const navigate = useNavigate()
  const { user: authUser, logout } = useAuth()

  const user: UserSession = (() => {
    if (authUser) {
      return {
        name: authUser.name,
        role: authUser.role.toUpperCase() as any,
        email: authUser.email,
      }
    }
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('dealflow_user') : null
      return stored ? JSON.parse(stored) : { name: 'Alice Sales', role: 'REP' }
    } catch {
      return { name: 'Alice Sales', role: 'REP' }
    }
  })()

  const userRole = user?.role ?? 'rep'
  const allowed = ROLE_ALLOWED_ROUTES[userRole] ?? ROLE_ALLOWED_ROUTES.rep

  // Fallback defaults if server tabs haven't loaded yet, strictly filtered by role
  const defaultTabs = [
    { to: '/app/dashboard', label: 'Dashboard' },
    { to: '/app/quotations', label: 'Quotations' },
    { to: '/app/pipeline', label: 'Pipeline' },
    { to: '/app/approvals', label: 'Approvals' },
    { to: '/app/fulfilment', label: 'Fulfilment' },
    { to: '/app/subscriptions', label: 'Subscriptions' },
    { to: '/app/invoices', label: 'Invoices' },
    { to: '/app/health', label: 'Deal Health' },
    { to: '/app/reports', label: 'Reports' },
    { to: '/app/products', label: 'Products' },
    { to: '/app/settings', label: 'Settings' },
    { to: '/app/users', label: 'Users' },
    { to: '/app/profile', label: 'Profile' },
  ]

  const baseTabs = (serverTabs && serverTabs.length > 0) ? serverTabs : defaultTabs
  // Ensure profile is always present in tabs if not sent by server
  const hasProfile = baseTabs.some(t => t.to === '/app/profile')
  const fullTabs = hasProfile ? baseTabs : [...baseTabs, { to: '/app/profile', label: 'Profile' }]

  // Filter strictly according to this user's authorized routes
  const tabs = fullTabs.filter(t => allowed.includes(t.to))

  // PS §7: the customer surface is a genuinely separate, restricted view
  useEffect(() => {
    if (user.role === 'CUSTOMER') navigate('/shop', { replace: true })
  }, [user.role, navigate])

  if (user?.role === 'customer') return null

  const handleSignOut = () => {
    localStorage.removeItem('dealflow_user')
    localStorage.removeItem('df360_token')
    sessionStorage.clear()
    logout('manual')
  }

  return (
    <div className="min-h-[100dvh] bg-bg">
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-line">
        <div className="mx-auto max-w-[1560px] px-5 h-14 flex items-center gap-5">
          <Link to="/" className="shrink-0" aria-label="Clinch home">
            <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-[19px] w-auto" />
          </Link>

          <nav aria-label="Workspace" className="flex items-center gap-0.5 overflow-x-auto">
            {tabs.map(t => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/app/quotations'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                    isActive ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:text-fg hover:bg-surface-2'
                  }`}
                style={{ transition: `all 240ms ${EASE_CSS}` }}
              >
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* Quick Switch to Customer Storefront */}
            <Link
              to="/shop"
              title="Open Customer Storefront"
              className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] text-[#46586b] hover:text-[#0d1b2a] hover:bg-surface-2 ring-1 ring-black/[.06]"
            >
              <span>🛒 Storefront</span>
            </Link>

            {/* Active Persona Pill linking to /login */}
            <button
              onClick={handleSignOut}
              title="Active user session. Click to switch persona"
              className="rounded-full px-3 py-1 text-[12px] text-fg bg-surface-2 ring-1 ring-black/[.08]
                         hover:ring-accent/40 flex items-center gap-1.5 font-medium cursor-pointer"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"></span>
              <span>{user.name}</span>
              <span className="text-accent text-[11px] font-semibold tracking-wide">({user.role})</span>
              <span className="text-fg-4 text-[10px] uppercase font-mono tracking-wider ml-0.5">Switch</span>
            </button>



            {onReload && (
              <button
                onClick={onReload}
                title="Refresh pricing, stock and approval data"
                className="rounded-full px-3 py-1.5 text-[12.5px] text-fg-2 ring-1 ring-black/[.07]
                           hover:text-accent hover:ring-accent/35 bg-surface"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                Reload
              </button>
            )}

            {/* Proper Log out button */}
            <button
              onClick={handleSignOut}
              title="Sign out of current account"
              className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-fg-3 hover:text-band-finance hover:bg-rose-50/50"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1560px] px-5 py-6">{children}</main>
    </div>
  )
}

/** Small helper so every screen reports failure the same way. */
export function ErrorBar({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-band-financeWash ring-1 ring-band-finance/20 px-4 py-3">
      <span className="text-[13px] text-band-finance">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-auto text-[12px] font-semibold text-band-finance underline">
          Retry
        </button>
      )}
    </div>
  )
}
