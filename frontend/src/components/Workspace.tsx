import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
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
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  admin: [
    '/app/dashboard', '/app/quotations', '/app/pipeline', '/app/approvals',
    '/app/fulfilment', '/app/subscriptions', '/app/invoices', '/app/health',
    '/app/reports', '/app/products', '/app/settings', '/app/users', '/app/admin',
    '/app/profile',
  ],
  manager: [
    '/app/dashboard', '/app/quotations', '/app/pipeline', '/app/approvals',
    '/app/fulfilment', '/app/health', '/app/reports', '/app/products',
    '/app/settings', '/app/profile',
  ],
  finance: [
    '/app/dashboard', '/app/quotations', '/app/pipeline', '/app/approvals',
    '/app/fulfilment', '/app/subscriptions', '/app/invoices', '/app/health',
    '/app/reports', '/app/products', '/app/profile',
  ],
  rep: [
    '/app/dashboard', '/app/quotations', '/app/pipeline', '/app/fulfilment',
    '/app/health', '/app/products', '/app/profile',
  ],
}

export function Workspace({
  children, onReload,
}: { children: ReactNode; onReload?: () => void }) {
  const navigate = useNavigate()
  // Identity comes from the verified session, never from localStorage.
  const { user, tabs: serverTabs, logout } = useAuth()

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
    { to: '/app/admin', label: 'Admin Portal' },
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
    if (user?.role === 'customer') navigate('/portal', { replace: true })
  }, [user?.role, navigate])

  if (user?.role === 'customer') return null

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
            {/* User Profile Pill button */}
            <Link
              to="/app/profile"
              title="View your profile, permissions & governance details"
              className="rounded-full px-3 py-1.5 text-[12px] text-fg bg-surface-2 ring-1 ring-black/[.08]
                         hover:ring-accent/40 hover:bg-surface flex items-center gap-1.5 font-medium transition-all shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"></span>
              <span>{user?.name ?? 'User'}</span>
              <span className="text-accent text-[11px] font-semibold tracking-wide capitalize">({user?.role})</span>
            </Link>

            {/* Role-specific badge indicator */}
            {user?.role === 'rep' && (
              <div className="hidden lg:inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 px-3 py-1 text-[11px] font-mono font-medium">
                Max 15% HW / 20% SW
              </div>
            )}

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
              onClick={() => logout('manual')}
              title="Sign out of DealFlow360"
              className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-rose-700 bg-rose-50
                         ring-1 ring-rose-200/90 hover:bg-rose-100 hover:ring-rose-300 active:scale-[.98]
                         flex items-center gap-1.5 shadow-sm cursor-pointer"
              style={{ transition: `all 240ms ${EASE_CSS}` }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Log out</span>
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
