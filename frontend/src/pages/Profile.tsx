import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'

interface RoleDetail {
  title: string
  description: string
  tone: string
  allowedModules: { name: string; path: string; desc: string }[]
  restrictedModules: { name: string; reason: string }[]
}

const ROLE_METADATA: Record<string, RoleDetail> = {
  admin: {
    title: 'RevOps Administrator',
    description: 'System setup, catalog pricing, discount tier configuration, user provisioning, and governance auditing.',
    tone: 'bg-purple-500/10 text-purple-700 ring-purple-500/25',
    allowedModules: [
      { name: 'Sales Dashboard', path: '/app/dashboard', desc: 'Central sales & governance hub' },
      { name: 'Quotations & Pipeline', path: '/app/quotations', desc: 'Inspect orders and customer quotes' },
      { name: 'Product Catalogue', path: '/app/products', desc: 'Global SKU pricing and margins' },
      { name: 'Discount Settings', path: '/app/settings', desc: 'Policy Simulator & approval threshold rules' },
      { name: 'User Management', path: '/app/users', desc: 'Provision, deactivate, and audit system operators' },
      { name: 'Subscription Plans', path: '/app/admin/subscriptions', desc: 'Define recurring subscription tier plans' },
      { name: 'Rep Performance Reports', path: '/app/admin/reports', desc: 'Quota and margin leakage breakdown' },
      { name: 'Deal Health', path: '/app/health', desc: 'Pipeline risk metrics and stalled quotation radar' },
      { name: 'Executive Reports', path: '/app/reports', desc: 'Executive governance reporting & discount leakage' },
    ],
    restrictedModules: [
      { name: 'Quotation-to-Shipment Task Panels', reason: 'Warehouse fulfillment splits, invoice dispatch, payment registration, and recurring billing reconciliation are reserved exclusively for Finance Manager under Segregation of Duties (PS §3).' },
      { name: 'Discount Approvals Queue', reason: 'Quotation discount sign-offs are strictly segregated between Sales Managers (Level 1) and Finance Managers (Level 2).' },
    ],
  },
  manager: {
    title: 'Sales Manager',
    description: 'Level 1 quotation approvals, discount tier policy configuration, rep cluster pipeline oversight, and executive reporting.',
    tone: 'bg-amber-500/10 text-amber-700 ring-amber-500/25',
    allowedModules: [
      { name: 'Sales Dashboard', path: '/app/dashboard', desc: 'Pipeline overview and pending review queues' },
      { name: 'Quotations & Pipeline', path: '/app/quotations', desc: 'Review team quotations across assigned rep clusters' },
      { name: 'Approvals Queue (Level 1)', path: '/app/approvals', desc: 'First-level sign-off on quotes exceeding rep ceilings' },
      { name: 'Discount Governance & Settings', path: '/app/settings', desc: 'Configure discount tiers, category ceilings, and approval chains' },
      { name: 'Deal Health Monitor', path: '/app/health', desc: 'Track deal velocity and detect stalled deals' },
      { name: 'Reports & Analytics', path: '/app/reports', desc: 'Track revenue, margin leakage, and approval times' },
      { name: 'Product Catalogue', path: '/app/products', desc: 'Explore products, pricing, and variants' },
    ],
    restrictedModules: [
      { name: 'Quotation-to-Shipment Operations', reason: 'Warehouse fulfillment splits, invoice dispatch, and recurring billing reconciliation are restricted to Finance Manager.' },
      { name: 'Second-Level Finance Sign-offs', reason: 'High-risk discounts (Score ≥ 60) require Finance Manager sign-off before releasing to customer.' },
      { name: 'System User Provisioning', reason: 'User provisioning and catalog creation are restricted to Administrators.' },
    ],
  },
  finance: {
    title: 'Finance & Operations Manager',
    description: 'Second-level high-risk discount approvals, multi-warehouse fulfillment splits & backorders, recurring billing and credit note reconciliation.',
    tone: 'bg-blue-500/10 text-blue-700 ring-blue-500/25',
    allowedModules: [
      { name: 'Sales Dashboard', path: '/app/dashboard', desc: 'Financial health overview and pipeline values' },
      { name: 'Quotations & Pipeline', path: '/app/quotations', desc: 'Inspect financial terms on all open orders' },
      { name: 'Level 2 Approvals', path: '/app/approvals', desc: 'Final sign-off on high-risk discounts (Score ≥ 60) and severe breaches' },
      { name: 'Multi-Warehouse Fulfilment', path: '/app/fulfilment', desc: 'Manages warehouse fulfillment splits and backorder decisions' },
      { name: 'Subscriptions & Billing', path: '/app/subscriptions', desc: 'Reconciles recurring billing cycles, mid-cycle prorations, and credit notes' },
      { name: 'Invoices & Ledgers', path: '/app/invoices', desc: 'Order-to-cash ledger settlement, invoice dispatch, and payments' },
      { name: 'Reports', path: '/app/reports', desc: 'Leakage audits and financial summaries' },
      { name: 'Deal Health', path: '/app/health', desc: 'Monitor deals flagged for financial review' },
      { name: 'Product Catalogue', path: '/app/products', desc: 'Explore product inventory and pricing' },
    ],
    restrictedModules: [
      { name: 'Discount Tier Policy Setting', reason: 'Governance rule configuration is reserved for Sales Management & Admin to separate duties from revenue booking.' },
      { name: 'User Management', reason: 'Provisioning accounts is restricted to Administrators.' },
    ],
  },
  rep: {
    title: 'Sales Representative',
    description: 'Quotation drafting, intelligent discount application within assigned limits, counterfactual coaching, and upsell recommendations.',
    tone: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25',
    allowedModules: [
      { name: 'Sales Dashboard', path: '/app/dashboard', desc: 'Track your personal active deals and quotes' },
      { name: 'Quotations & Pipeline', path: '/app/quotations', desc: 'Draft quotes, build lines, and submit for auto-approval' },
      { name: 'Deal Health', path: '/app/health', desc: 'Check risk scores and identify stalled deals' },
      { name: 'Product Catalogue', path: '/app/products', desc: 'Browse available inventory, specs, and tier pricing' },
    ],
    restrictedModules: [
      { name: 'Quotation Approvals Queue', reason: 'Sales representatives cannot approve their own quotations. Over-ceiling quotes route to Managers.' },
      { name: 'Quotation-to-Shipment Operations', reason: 'Warehouse fulfillment splits, invoice dispatch, and billing reconciliation are restricted to Finance Manager.' },
      { name: 'Discount Policy Settings', reason: 'Setting discount thresholds and approval rules requires Sales Management authority.' },
      { name: 'Platform User Provisioning', reason: 'User provisioning is strictly an Administrator function.' },
    ],
  },
}

export default function Profile() {
  const { user, logout } = useAuth()
  const roleInfo = ROLE_METADATA[user?.role ?? 'rep'] || ROLE_METADATA.rep

  return (
    <Workspace>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        {/* Header Profile Card */}
        <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-fg text-white flex items-center justify-center font-display text-2xl font-bold shadow-md shrink-0">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold text-fg leading-tight">
                  {user?.name}
                </h1>
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ring-1 ${roleInfo.tone}`}>
                  {roleInfo.title}
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active Account
                </span>
              </div>
              <p className="text-sm text-fg-2 mt-1">{user?.email}</p>
              <p className="text-xs text-fg-3 mt-0.5">User ID: <span className="font-mono">{user?.id}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => logout('manual')}
              className="inline-flex items-center gap-2 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-5 py-2.5 font-display text-sm font-semibold hover:bg-rose-100 hover:ring-rose-300 active:scale-[.98] shadow-sm cursor-pointer"
              style={{ transition: `all 240ms ${EASE_CSS}` }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* Role & Access Overview */}
        <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift p-6">
          <h2 className="font-display text-base font-bold text-fg flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Role-Based Authorization Profile
          </h2>
          <p className="text-sm text-fg-2 mt-1.5 leading-relaxed">
            {roleInfo.description}
          </p>

          <div className="mt-4 pt-4 border-t border-line">
            <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mb-2.5">
              Active Security Permissions ({user?.permissions?.length ?? 0})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(user?.permissions ?? []).map((perm: string) => (
                <span
                  key={perm}
                  className="rounded-md bg-surface-2 ring-1 ring-black/[.07] px-2.5 py-1 font-mono text-[11px] text-fg font-medium"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Two-column layout: Accessible Modules vs Restricted Modules */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Accessible Modules */}
          <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Authorized Modules ({roleInfo.allowedModules.length})
              </h3>
              <span className="text-[11px] font-mono text-emerald-600 font-medium">Access Granted</span>
            </div>
            <p className="text-xs text-fg-3">
              These are the specific areas you have permission to view and operate:
            </p>

            <div className="flex flex-col gap-2">
              {roleInfo.allowedModules.map(m => (
                <Link
                  key={m.path}
                  to={m.path}
                  className="group p-3 rounded-xl bg-surface-2/60 hover:bg-surface-2 ring-1 ring-black/[.04] hover:ring-accent/35 flex items-start justify-between gap-3 transition-all"
                >
                  <div>
                    <div className="font-display text-[13px] font-semibold text-fg group-hover:text-accent">
                      {m.name}
                    </div>
                    <div className="text-[11.5px] text-fg-3 mt-0.5">{m.desc}</div>
                  </div>
                  <span className="text-fg-3 group-hover:text-accent group-hover:translate-x-0.5 transition-transform text-xs">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Role Governance & Restricted Modules */}
          <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Governance Boundaries & Restrictions
              </h3>
              <span className="text-[11px] font-mono text-amber-600 font-medium">RBAC Enforced</span>
            </div>
            <p className="text-xs text-fg-3">
              Separation of duties prevents conflicts of interest. The following areas are locked for your role:
            </p>

            {roleInfo.restrictedModules.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-purple-500/5 ring-1 ring-purple-500/15">
                <div className="text-xs font-semibold text-purple-700">No restrictions applied</div>
                <div className="text-[11.5px] text-purple-600 mt-1">Super Administrator has full administrative clearance across all platform capabilities.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {roleInfo.restrictedModules.map(r => (
                  <div
                    key={r.name}
                    className="p-3 rounded-xl bg-red-50/40 ring-1 ring-red-200/50 flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-red-800">
                      <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3.5a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {r.name}
                    </div>
                    <div className="text-[11px] text-red-700 leading-relaxed pl-5">
                      {r.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Workspace>
  )
}
