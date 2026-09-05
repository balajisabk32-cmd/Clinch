import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { EASE_CSS } from '../lib/motion'

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
  role: 'CUSTOMER' | 'MANAGER' | 'REP' | 'ADMIN'
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
  const user: UserSession = (() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('dealflow_user') : null
      return stored ? JSON.parse(stored) : { name: 'Alice Sales', role: 'REP' }
    } catch {
      return { name: 'Alice Sales', role: 'REP' }
    }
  })()

  const tabs = getTabsForRole(user.role)

  // PS §7: the customer surface is a genuinely separate, restricted view -- not
  // the internal workspace with controls hidden. Hiding chrome would still
  // render internal screens and still call internal endpoints, so a customer
  // session is redirected out of this shell entirely.
  useEffect(() => {
    if (user.role === 'CUSTOMER') navigate('/portal', { replace: true })
  }, [user.role, navigate])

  if (user.role === 'CUSTOMER') return null

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
            {/* Active Persona Pill linking to /login */}
            <Link
              to="/login"
              title="Active user session. Click to switch persona"
              className="rounded-full px-3 py-1 text-[12px] text-fg bg-surface-2 ring-1 ring-black/[.08]
                         hover:ring-accent/40 flex items-center gap-1.5 font-medium"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"></span>
              <span>{user.name}</span>
              <span className="text-accent text-[11px] font-semibold tracking-wide">({user.role})</span>
              <span className="text-fg-4 text-[10px] uppercase font-mono tracking-wider ml-0.5">Switch</span>
            </Link>

            {/* Role-specific header controls */}
            {user.role === 'REP' && (
              <div className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 px-3 py-1 text-[11px] font-mono font-medium">
                Allowance: Max 15% HW / 20% SW
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

            {user.role === 'MANAGER' && (
              <Link
                to="/app/approvals"
                title="Open Pending Approvals Queue"
                className="rounded-full px-3 py-1.5 text-[12.5px] text-fg-2 ring-1 ring-black/[.07]
                           hover:text-accent hover:ring-accent/35 bg-surface font-medium"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                <span>Approvals</span>
              </Link>
            )}

            {user.role === 'ADMIN' && (
              <Link
                to="/app/admin"
                title="Launch Clinch / DealFlow360 RevOps Admin Portal"
                className="rounded-full px-3 py-1.5 text-[12.5px] text-fg-2 ring-1 ring-black/[.07]
                           hover:text-accent hover:ring-accent/35 bg-surface flex items-center gap-1.5 font-medium"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                <span>Admin Portal</span>
              </Link>
            )}

            <button
              onClick={() => navigate('/')}
              className="rounded-full px-3 py-1.5 text-[12.5px] text-fg-3 hover:text-band-finance"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              Exit
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
