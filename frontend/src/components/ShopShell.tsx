import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom'
import { ShoppingBag, FileText, Store } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { shopApi, type ShopMe } from '../lib/authClient'
import { AuthLoading } from './ProtectedRoute'
import { AnimatedNumber } from './motion/AnimatedNumber'
import { cn } from '../lib/cn'

/**
 * Customer shell — the storefront's chrome.
 *
 * DESIGN READ: a B2B trade counter for a buyer with a budget. Composed and
 * roomy, the same family as the quotation document, and deliberately NOT the
 * internal cockpit: a customer must never be able to mistake one for the other.
 *
 * There is no route from here into /app/*. That is not politeness — the server
 * refuses every internal path for a customer token, so a link would only ever
 * produce a 403. The nav shows what exists for this person.
 */

const TIER_STYLE: Record<string, string> = {
  Bronze: 'bg-band-managerWash text-band-manager ring-band-manager/25',
  Silver: 'bg-surface-2 text-fg-2 ring-black/[.10]',
  Gold: 'bg-band-autoWash text-band-auto ring-band-auto/25',
}

/** Route guard for the storefront. Mirrors ProtectedRoute, opposite population. */
export function CustomerRoute({ children }: { children: React.ReactElement }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <AuthLoading />
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  // An internal user in the storefront is not a permissions error to explain,
  // it is a wrong turn to correct: send them to their own workspace.
  if (user.role !== 'customer') return <Navigate to="/app/dashboard" replace />
  return children
}

export function ShopShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [me, setMe] = useState<ShopMe | null>(null)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    shopApi.me().then(setMe).catch(() => { /* header degrades, page still works */ })
  }, [])

  // The badge follows the cart across pages without each page having to push to
  // it: any screen that changes the basket dispatches this, and only the shell
  // listens.
  useEffect(() => {
    const refresh = () => shopApi.cart().then(c => setCartCount(c.count)).catch(() => {})
    refresh()
    window.addEventListener('clinch:cart-changed', refresh)
    return () => window.removeEventListener('clinch:cart-changed', refresh)
  }, [])

  const tab = ({ isActive }: { isActive: boolean }) => cn(
    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium',
    'transition-colors duration-200',
    isActive ? 'bg-fg text-white' : 'text-fg-2 hover:text-fg hover:bg-surface-2',
  )

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col">
      <header className="border-b border-line bg-surface sticky top-0 z-30">
        <div className="mx-auto max-w-[1180px] px-5 h-16 flex items-center gap-6">
          <Link to="/shop" aria-label="Clinch storefront" className="shrink-0">
            <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-[19px] w-auto" />
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/shop" end className={tab}>
              <Store size={13} /> Shop
            </NavLink>
            <NavLink to="/my/quotations" className={tab}>
              <FileText size={13} /> My quotations
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {me && (
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-[12.5px] font-medium text-fg">{me.company}</span>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  {user?.name}
                </span>
              </div>
            )}
            {me && (
              <span className={cn(
                'rounded-full ring-1 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase',
                TIER_STYLE[me.tier] ?? TIER_STYLE.Bronze,
              )}>
                {me.tier}
              </span>
            )}

            <NavLink to="/cart" className={tab} aria-label="Basket">
              <ShoppingBag size={14} />
              {cartCount > 0 && (
                <AnimatedNumber value={cartCount} format="int" className="text-[12px]" />
              )}
            </NavLink>

            <button
              onClick={() => logout('manual')}
              className="text-[12.5px] text-fg-3 hover:text-band-finance transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tier progress. Shown because it is the customer's own standing, and
            because a threshold you cannot see is not an incentive. Hidden for
            negotiated accounts, whose tier is contractual rather than earned. */}
        {me && !me.locked && me.next_tier && (
          <div className="border-t border-line bg-surface-2/50">
            <div className="mx-auto max-w-[1180px] px-5 py-2 flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 shrink-0">
                {me.next_tier} tier
              </span>
              <div className="h-1.5 flex-1 max-w-[280px] rounded-full bg-surface-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-700"
                  style={{ width: `${me.progress_pct ?? 0}%` }}
                />
              </div>
              <span className="text-[11.5px] text-fg-3">
                <AnimatedNumber value={me.remaining ?? 0} format="inr" flash={false}
                                className="text-[11.5px] text-fg-2 font-semibold" />
                {' '}more to unlock {me.next_tier} pricing
              </span>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 py-10 flex-1">{children}</main>

      <footer className="border-t border-line bg-surface mt-auto">
        <div className="mx-auto max-w-[1180px] px-5 py-5 flex flex-wrap items-center
                        justify-between gap-3 text-[11.5px] text-fg-3">
          <span>Clinch — B2B commerce and quotation platform</span>
          <span>Prices shown are your {me?.tier ?? 'account'} tier rates, excluding tax.</span>
        </div>
      </footer>
    </div>
  )
}

/** Every screen that changes the basket calls this so the header badge keeps up. */
export const cartChanged = () =>
  window.dispatchEvent(new CustomEvent('clinch:cart-changed'))
