import { lazy, type ReactElement, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Quotations from './pages/Quotations'
import Builder from './pages/Builder'
import DealHealth from './pages/DealHealth'
import Approvals from './pages/Approvals'
import Fulfilment from './pages/Fulfilment'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Reports from './pages/Reports'
import Portal from './pages/Portal'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Invoices from './pages/Invoices'
import Subscriptions from './pages/Subscriptions'
import FulfilmentDetail from './pages/FulfilmentDetail'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const AdminPortal = lazy(() => import('./pages/AdminPortal'))

function RoleGuard({
  allowedRoles,
  children,
  redirectTo = '/app/quotations',
  featureName,
}: {
  allowedRoles: Array<'CUSTOMER' | 'MANAGER' | 'REP' | 'ADMIN'>
  children: ReactElement
  redirectTo?: string
  featureName?: string
}) {
  const user = (() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('dealflow_user') : null
      return stored ? JSON.parse(stored) : { name: 'Alice Sales', role: 'REP' }
    } catch {
      return { name: 'Alice Sales', role: 'REP' }
    }
  })()

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-surface border border-line p-6 text-center shadow-lift">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4 font-mono font-bold text-lg">
            !
          </div>
          <h2 className="font-display text-lg font-bold text-fg mb-1">Access Restricted</h2>
          <p className="text-[13px] text-fg-3 mb-5 leading-relaxed">
            You are signed in as <strong>{user.name}</strong> ({user.role}). {featureName ? `${featureName} is` : 'This area is'} reserved for {allowedRoles.join(' / ')}.
          </p>
          <div className="flex gap-2 justify-center">
            <a
              href={redirectTo}
              className="rounded-full bg-fg text-white px-4 py-2 text-[12.5px] font-semibold hover:bg-accent transition-all"
            >
              Return to My Dashboard
            </a>
            <a
              href="/login"
              className="rounded-full bg-surface-2 text-fg-2 px-4 py-2 text-[12.5px] font-semibold hover:bg-surface-3 transition-all"
            >
              Switch Role
            </a>
          </div>
        </div>
      </div>
    )
  }

  return children
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        {/* Customer surface. Deliberately OUTSIDE the /app workspace tree:
            a customer never reaches an internal route, and the payload they
            receive is field-redacted on the server (PS §7). */}
        <Route path="/portal" element={<Portal />} />
        {/* Workspace, pipeline, quotation builder */}
        <Route path="/app" element={<Navigate to="/app/quotations" replace />} />
        <Route path="/app/quotations" element={<Quotations view="list" />} />
        <Route
          path="/app/pipeline"
          element={
            <RoleGuard allowedRoles={['REP', 'MANAGER', 'ADMIN']} featureName="Pipeline Governance">
              <Quotations view="pipeline" />
            </RoleGuard>
          }
        />
        <Route path="/app/quotations/:ref" element={<Builder />} />
        {/* Approvals Queue Dashboard */}
        <Route
          path="/app/approvals"
          element={
            <RoleGuard allowedRoles={['MANAGER', 'ADMIN']} featureName="Approvals Queue">
              <Approvals />
            </RoleGuard>
          }
        />
        {/* Fulfilment & Delivery Tracking Dashboard */}
        <Route path="/app/fulfilment" element={<Fulfilment />} />
        <Route path="/app/fulfilment/:ref" element={<FulfilmentDetail />} />
        <Route path="/app/invoices" element={<Invoices />} />
        <Route path="/app/subscriptions" element={<Subscriptions />} />
        <Route path="/app/dashboard" element={<Dashboard />} />
        <Route path="/app/settings" element={<Settings />} />
        <Route path="/app/products" element={<Products />} />
        <Route path="/app/products/:sku" element={<ProductDetail />} />
        <Route path="/app/reports" element={<Reports />} />
        {/* Deal Health & Risk Intelligence Dashboard */}
        <Route
          path="/app/health"
          element={
            <RoleGuard allowedRoles={['MANAGER', 'ADMIN']} featureName="Executive Deal Health">
              <DealHealth />
            </RoleGuard>
          }
        />
        {/* Admin Portal (Same-Server Integrated RevOps Governance) */}
        <Route
          path="/app/admin"
          element={
            <RoleGuard allowedRoles={['ADMIN']} featureName="RevOps Master Admin Portal">
              <Suspense
                fallback={
                  <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-[#0b1b33]">
                    <div className="flex items-center gap-3 font-medium text-sm">
                      <div className="w-4 h-4 border-2 border-[#00a3e0] border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading RevOps Admin Portal...</span>
                    </div>
                  </div>
                }
              >
                <AdminPortal />
              </Suspense>
            </RoleGuard>
          }
        />
        <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
        {/* Fallback route */}
        <Route path="/app/*" element={<Navigate to="/app/quotations" replace />} />
      </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
