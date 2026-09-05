import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Portal from './pages/Portal'
import Dashboard from './pages/Dashboard'
import Quotations from './pages/Quotations'
import Builder from './pages/Builder'
import Approvals from './pages/Approvals'
import Fulfilment from './pages/Fulfilment'
import FulfilmentDetail from './pages/FulfilmentDetail'
import Subscriptions from './pages/Subscriptions'
import Invoices from './pages/Invoices'
import DealHealth from './pages/DealHealth'
import Reports from './pages/Reports'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Settings from './pages/Settings'
import AdminUsers from './pages/AdminUsers'
import CustomerLayout from './customer/CustomerLayout'
import CustomerShop from './customer/pages/Shop'
import CustomerProductDetail from './customer/pages/ProductDetail'
import CustomerCart from './customer/pages/Cart'
import CustomerWishlist from './customer/pages/Wishlist'
import CustomerQuotations from './customer/pages/Quotations'
import CustomerQuotationDetail from './customer/pages/QuotationDetail'
import CustomerAccount from './customer/pages/Account'
import CustomerOrderTracking from './customer/pages/OrderTracking'
import Profile from './pages/Profile'
import './index.css'

/*
 * Role map, mirroring the server's permission matrix (api/auth.py).
 *
 * These guards are for the person using the app: they keep someone from
 * clicking into a screen that would only refuse them. They are NOT the control
 * — every endpoint behind each screen re-checks the caller's role against the
 * database, so editing localStorage buys nothing but a 403.
 */
const ALL_INTERNAL = ['admin', 'manager', 'finance', 'rep']
const APPROVERS = ['manager', 'finance']
const FINANCE_ONLY = ['finance']
const POLICY = ['admin', 'manager']
const ADMIN_ONLY = ['admin']

const guard = (element: React.ReactElement, roles: string[]) => (
  <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>
)

/*
 * Reuse the root across hot updates.
 *
 * main.tsx re-executes whenever Vite hot-updates something it imports, and a
 * second createRoot() call on the same DOM node makes React lose track of the
 * tree it already owns -- which surfaces as "removeChild: the node to be
 * removed is not a child of this node" and an ErrorBoundary screen, mid-demo,
 * with nothing actually wrong with the app. Production runs this module once,
 * so this only ever matters while developing -- which is exactly when it bites.
 */
const container = document.getElementById('root')!
const w = window as unknown as { __clinchRoot?: ReturnType<typeof createRoot> }
const root = w.__clinchRoot ?? (w.__clinchRoot = createRoot(container))

root.render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* ── Public ─────────────────────────────────────────────── */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

            {/* Customer surface: deliberately OUTSIDE the /app tree and outside
                the internal shell. Access is by signed, single-quote token, so
                it carries no role guard of its own. */}
            <Route path="/portal" element={<Portal />} />
            <Route path="/portal/:token" element={<Portal />} />

                        {/* Customer storefront (Unified Hub - Protech / DealFlow360) */}
            <Route element={<CustomerLayout />}>
              <Route path="/shop" element={<CustomerShop />} />
              <Route path="/shop/:id" element={<CustomerProductDetail />} />
              <Route path="/cart" element={<CustomerCart />} />
              <Route path="/wishlist" element={<CustomerWishlist />} />
              <Route path="/quotations" element={<CustomerQuotations />} />
              <Route path="/quotations/:id" element={<CustomerQuotationDetail />} />
              <Route path="/my/quotations" element={<CustomerQuotations />} />
              <Route path="/my/quotations/:id" element={<CustomerQuotationDetail />} />
              <Route path="/account" element={<CustomerAccount />} />
              <Route path="/orders/:id" element={<CustomerOrderTracking />} />
            </Route>

            {/* ── Internal workspace ─────────────────────────────────── */}
            <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/app/dashboard" element={guard(<Dashboard />, ALL_INTERNAL)} />
            <Route path="/app/quotations" element={guard(<Quotations view="list" />, ALL_INTERNAL)} />
            <Route path="/app/pipeline" element={guard(<Quotations view="pipeline" />, ALL_INTERNAL)} />
            <Route path="/app/quotations/:ref" element={guard(<Builder />, ALL_INTERNAL)} />
            <Route path="/app/health" element={guard(<DealHealth />, ALL_INTERNAL)} />
            <Route path="/app/products" element={guard(<Products />, ALL_INTERNAL)} />
            <Route path="/app/products/:sku" element={guard(<ProductDetail />, ALL_INTERNAL)} />

            {/* Approvals: manager signs off at tier one, finance at tier two. */}
            <Route path="/app/approvals" element={guard(<Approvals />, APPROVERS)} />

            {/* Quotation-to-shipment task panels: restricted exclusively to Finance Manager (PS §3 SoD). */}
            <Route path="/app/fulfilment" element={guard(<Fulfilment />, FINANCE_ONLY)} />
            <Route path="/app/fulfilment/:ref" element={guard(<FulfilmentDetail />, FINANCE_ONLY)} />
            <Route path="/app/subscriptions" element={guard(<Subscriptions />, FINANCE_ONLY)} />
            <Route path="/app/invoices" element={guard(<Invoices />, FINANCE_ONLY)} />

            {/* Reporting and governance policy. */}
            <Route path="/app/reports" element={guard(<Reports />, APPROVERS)} />
            <Route path="/app/settings" element={guard(<Settings />, POLICY)} />

            {/* Profile page for all internal users */}
            <Route path="/app/profile" element={guard(<Profile />, ALL_INTERNAL)} />

            {/* ── Admin only ─────────────────────────────────────────── */}
            <Route path="/app/users" element={guard(<AdminUsers />, ADMIN_ONLY)} />
            <Route path="/admin" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/admin/users" element={<Navigate to="/app/users" replace />} />

            <Route path="/app/*" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
