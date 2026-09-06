import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'

/**
 * What this account can reach, derived from the permissions the SERVER issued.
 *
 * This was a hand-written table of allowed and restricted modules per role, and
 * it had drifted from the matrix it was describing: it told an administrator
 * that fulfilment and approvals were "reserved exclusively for Finance Manager
 * under Segregation of Duties", while the server grants admin every permission
 * and the nav offers those very screens. A second, prose copy of an access
 * model is a copy that goes stale, so there is now one list and each entry
 * names the permission that gates it.
 */
interface ModuleDef {
  name: string
  path: string
  desc: string
  /** The permission the API requires. Absent = available to any signed-in user. */
  needs?: string
  /** Why this is withheld, shown when the account lacks `needs`. */
  withheld?: string
}

const MODULES: ModuleDef[] = [
  { name: 'Sales Dashboard', path: '/app/dashboard',
    desc: 'Central sales and governance hub', needs: 'quote.view' },
  { name: 'Quotations & Pipeline', path: '/app/quotations',
    desc: 'Build, inspect and track quotations', needs: 'quote.view' },
  { name: 'Product Catalogue', path: '/app/products',
    desc: 'Products, pricing and variants', needs: 'product.view' },
  { name: 'Deal Health', path: '/app/health',
    desc: 'Pipeline risk and stalled-deal radar', needs: 'dealhealth.view' },
  { name: 'Approvals Queue', path: '/app/approvals',
    desc: 'Sign off on quotations above a rep ceiling',
    needs: 'approval.manager',
    withheld: 'Approving discounts is a reviewer duty. Reps track their own '
            + 'quotations from the pipeline instead.' },
  { name: 'Fulfilment & Stock', path: '/app/fulfilment',
    desc: 'Warehouse splits, allocation and dispatch',
    needs: 'fulfilment.allocate',
    withheld: 'Committing stock moves goods. It sits with Finance and Ops so '
            + 'the person who books revenue is not the person who ships it.' },
  { name: 'Invoices & Payments', path: '/app/invoices',
    desc: 'Raise invoices and register settlement',
    needs: 'invoice.manage',
    withheld: 'Settling money is separated from selling it (PS §3, '
            + 'segregation of duties).' },
  { name: 'Subscriptions & Billing', path: '/app/subscriptions',
    desc: 'Recurring schedules, proration and credit notes',
    needs: 'billing.modify',
    withheld: 'Changing a live billing schedule is a Finance duty.' },
  { name: 'Discount Settings', path: '/app/settings',
    desc: 'Ceilings, approval chains and the Policy Simulator',
    needs: 'policy.config',
    withheld: 'Setting the limits is separated from selling against them.' },
  { name: 'Reports & Analytics', path: '/app/reports',
    desc: 'Revenue, margin leakage and approval turnaround',
    needs: 'reports.view',
    withheld: 'Portfolio reporting is for reviewers and administrators.' },
  { name: 'User Management', path: '/app/users',
    desc: 'Provision, deactivate and audit operators',
    needs: 'user.manage',
    withheld: 'Creating accounts is an administrator duty; an internal role is '
            + 'an authority grant over other people\u2019s deals.' },
  { name: 'Subscription Plans', path: '/app/admin/subscriptions',
    desc: 'The price book recurring lines are sold from',
    needs: 'plan.manage',
    withheld: 'The master price book is maintained by administrators.' },
  { name: 'Rep Performance Reports', path: '/app/admin/reports',
    desc: 'Per-rep scorecards and exports',
    needs: 'user.manage',
    withheld: 'Individual performance data is restricted to administrators.' },
]

const ROLE_TITLE: Record<string, string> = {
  admin: 'Platform Administrator',
  manager: 'Sales Manager',
  finance: 'Finance / Operations',
  rep: 'Sales Representative',
  customer: 'Customer',
}

const ROLE_TONE: Record<string, string> = {
  admin: 'bg-accent/10 text-accent ring-accent/25',
  manager: 'bg-band-manager/10 text-band-manager ring-band-manager/25',
  finance: 'bg-band-finance/10 text-band-finance ring-band-finance/25',
  rep: 'bg-band-auto/10 text-band-auto ring-band-auto/25',
}

const ROLE_SUMMARY: Record<string, string> = {
  admin: 'System setup, catalogue and pricing, discount policy, user provisioning '
       + 'and governance auditing.',
  manager: 'First-level quotation approvals, discount policy configuration and '
         + 'pipeline oversight across your reps.',
  finance: 'Second-level approvals, warehouse fulfilment, invoicing, payment '
         + 'settlement and recurring billing.',
  rep: 'Build quotations, apply discounts within your ceiling, add upsell lines '
     + 'and track approval status.',
}

export default function Profile() {
  const { user, logout, can } = useAuth()
  const role = user?.role ?? 'rep'
  // Derived, not declared: `can()` reads the permission list the server issued
  // for THIS account, so the two halves of this page cannot disagree with the
  // nav or with what the API will actually allow.
  const allowedModules = MODULES.filter(m => !m.needs || can(m.needs))
  const restrictedModules = MODULES
    .filter(m => m.needs && !can(m.needs))
    .map(m => ({ name: m.name, reason: m.withheld ?? `Requires ${m.needs}.` }))
  const roleInfo = {
    title: ROLE_TITLE[role] ?? role,
    description: ROLE_SUMMARY[role] ?? '',
    tone: ROLE_TONE[role] ?? 'bg-surface-2 text-fg-2 ring-black/[.08]',
    allowedModules,
    restrictedModules,
  }

  return (
    <Workspace>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        {/* Header Profile Card */}
        <div className="panel p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
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
                <span className="rounded-full bg-band-auto/10 text-band-auto ring-1 ring-band-auto/20 px-2.5 py-0.5 text-[11px] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-band-auto"></span>
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
              className="inline-flex items-center gap-2 rounded-full bg-band-financeWash text-band-finance ring-1 ring-band-finance px-5 py-2.5 font-display text-sm font-semibold hover:bg-band-financeWash hover:ring-band-finance active:scale-[.98] shadow-sm cursor-pointer"
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
        <div className="panel p-6">
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
          <div className="panel p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-band-auto"></span>
                Authorized Modules ({roleInfo.allowedModules.length})
              </h3>
              <span className="text-[11px] font-mono text-band-auto font-medium">Access Granted</span>
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
          <div className="panel p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-band-manager"></span>
                Governance Boundaries & Restrictions
              </h3>
              <span className="text-[11px] font-mono text-band-manager font-medium">RBAC Enforced</span>
            </div>
            <p className="text-xs text-fg-3">
              Separation of duties prevents conflicts of interest. The following areas are locked for your role:
            </p>

            {roleInfo.restrictedModules.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-accent/5 ring-1 ring-accent/15">
                <div className="text-xs font-semibold text-accent">No restrictions applied</div>
                <div className="text-[11.5px] text-accent mt-1">Super Administrator has full administrative clearance across all platform capabilities.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {roleInfo.restrictedModules.map(r => (
                  <div
                    key={r.name}
                    className="p-3 rounded-xl bg-band-financeWash ring-1 ring-band-finance/25 flex flex-col gap-1 shadow-xs"
                  >
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-band-finance">
                      <svg className="w-3.5 h-3.5 text-band-finance shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3.5a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {r.name}
                    </div>
                    <div className="text-[11.5px] text-fg-2 font-medium leading-relaxed pl-5">
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
