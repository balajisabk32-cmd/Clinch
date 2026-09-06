import type { ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { EASE_CSS } from '../lib/motion'

/**
 * Route guard.
 *
 * Three states, in this order, and the order is the whole point:
 *
 *   1. still checking  -> spinner. Deciding before /auth/me answers is what
 *      causes both the content flash and the redirect loop.
 *   2. not signed in   -> /login, carrying `from` so the user lands back where
 *      they were trying to go.
 *   3. signed in, wrong role -> a real 403 screen. Redirecting instead would
 *      bounce a manager who clicked an admin link straight back to the page
 *      with the link on it, and round they go.
 */

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-bg grid place-items-center px-6">{children}</div>
  )
}

export function AuthLoading({ label = 'Checking your session…' }: { label?: string } = {}) {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-4">
        <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-7 w-auto opacity-90" />
        <div
          className="w-6 h-6 rounded-full border-2 border-line border-t-accent animate-spin"
          role="status"
          aria-label={label}
        />
        <p className="text-[12.5px] text-fg-3">{label}</p>
      </div>
    </Centered>
  )
}

function AccessDenied({ role, allowed }: { role: string; allowed: string[] }) {
  const { logout } = useAuth()
  return (
    <Centered>
      <div className="max-w-[44ch] rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift
                      p-7 flex flex-col gap-3.5">
        <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-6 w-auto self-start" />
        <div className="inline-flex items-center gap-2">
          <span className="rounded-full bg-band-financeWash text-band-finance ring-1
                           ring-band-finance/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold">
            403
          </span>
          <h1 className="font-display text-[19px] font-bold text-fg">Access denied</h1>
        </div>
        <p className="text-[13.5px] leading-relaxed text-fg-2">
          This area is restricted to{' '}
          <b className="text-fg">{allowed.join(' and ')}</b> users. You are signed in
          as <b className="text-fg">{role}</b>.
        </p>
        <p className="text-[12.5px] text-fg-3">
          If you need access, ask an administrator to change your role — permissions
          are enforced on the server, so this is not something the browser can grant.
        </p>
        <div className="flex gap-2 pt-1">
          <a
            href="/app/dashboard"
            className="rounded-full bg-fg text-white px-4 py-2 font-display text-[12.5px]
                       font-semibold hover:shadow-lift-lg active:scale-[.98]"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            Return to dashboard
          </a>
          <button
            onClick={() => logout('manual')}
            className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2
                       font-display text-[12.5px] font-semibold text-fg-2 hover:text-fg"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            Sign in as someone else
          </button>
        </div>
      </div>
    </Centered>
  )
}

export function ProtectedRoute({
  children, allowedRoles,
}: { children: ReactElement; allowedRoles?: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <AuthLoading />

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // A customer never belongs in the internal workspace at all. They now have a
  // storefront of their own, so send them there rather than to the single-quote
  // token portal, which they may not even hold a link for.
  if (user.role === 'customer') {
    if (!localStorage.getItem('df360_token')) {
      return <Navigate to="/login" replace />
    }
    return <Navigate to="/shop" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDenied role={user.role} allowed={allowedRoles} />
  }

  return children
}

/** Keeps a signed-in user off /login instead of showing the form again. */
export function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()
  if (isLoading) return <AuthLoading />
  if (isAuthenticated) {
    const from = (location.state as any)?.from || ''
    if (from.startsWith('/shop') || from.startsWith('/cart') || from.startsWith('/quotations') || from.startsWith('/account')) {
      return children
    }
    if (!localStorage.getItem('clinch_token')) {
      return children
    }
    if (user?.role === 'customer' && !localStorage.getItem('df360_token')) {
      return children
    }
    return <Navigate to={user?.role === 'customer' ? '/shop' : '/app/dashboard'} replace />
  }
  return children
}
