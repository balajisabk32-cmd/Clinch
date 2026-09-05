import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  Briefcase,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react'
import { Ambient } from '../components/Ambient'
import { Bezel, Eyebrow } from '../components/ui'
import { EASE_CSS } from '../lib/motion'

export interface UserSession {
  name: string
  email: string
  role: 'CUSTOMER' | 'MANAGER' | 'REP' | 'ADMIN'
  tier?: string
  title: string
  badge: string
}

const PERSONAS: Record<string, UserSession> = {
  CUSTOMER: {
    name: 'John Acme',
    email: 'customer@acmecorp.com',
    role: 'CUSTOMER',
    tier: 'GOLD',
    title: 'Acme Corp Procurement Buyer',
    badge: 'Gold tier · customer portal access',
  },
  MANAGER: {
    name: 'Bob Manager',
    email: 'manager@dealflow360.com',
    role: 'MANAGER',
    title: 'Sales Operations Manager',
    badge: 'Governance & Approval Authority',
  },
  REP: {
    name: 'Alice Sales',
    email: 'rep@dealflow360.com',
    role: 'REP',
    title: 'Senior Enterprise Account Exec',
    badge: 'Dynamic CPQ Quotation Builder',
  },
  ADMIN: {
    name: 'Dave Admin',
    email: 'admin@dealflow360.com',
    role: 'ADMIN',
    title: 'Master Systems Administrator',
    badge: 'Full Master Platform Control',
  },
}

export default function Login() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<'CUSTOMER' | 'MANAGER' | 'REP' | 'ADMIN'>('REP')
  const [email, setEmail] = useState('rep@dealflow360.com')
  const [password, setPassword] = useState('Password123!')
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const activePersona = PERSONAS[selectedRole]

  const handleSelectRole = (role: 'CUSTOMER' | 'MANAGER' | 'REP' | 'ADMIN') => {
    setSelectedRole(role)
    const p = PERSONAS[role]
    setEmail(p.email)
    if (role === 'CUSTOMER') {
      setUseMagicLink(true)
      setPassword('')
    } else {
      setUseMagicLink(false)
      setPassword('Password123!')
    }
    setFeedback(null)
  }

  /**
   * The demo personas map onto the seeded engine users. Signing in fetches a
   * REAL signed token: permissions are enforced server-side, so a session
   * without one is refused anything privileged no matter what role the browser
   * claims to hold.
   */
  const ENGINE_EMAIL: Record<string, string> = {
    REP: 'rao@dealflow.example',
    MANAGER: 'shah@dealflow.example',
    FINANCE: 'menon@dealflow.example',
    ADMIN: 'admin@dealflow.example',
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)

    let token = ''
    let permissions: string[] = []
    try {
      const res = await fetch(
        `${import.meta.env.DEV ? '/api' : 'http://localhost:8000'}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ENGINE_EMAIL[selectedRole] ?? '' }),
        },
      )
      if (res.ok) {
        const body = await res.json()
        token = body.token ?? ''
        permissions = body.user?.permissions ?? []
      }
    } catch {
      // Engine unreachable. The session still opens so the UI is browsable,
      // but without a token every privileged call will be refused -- which is
      // the correct failure mode, not a silent grant.
    }

    const session = {
      ...activePersona,
      email: email.trim(),
      permissions,
      loggedInAt: new Date().toISOString(),
    }
    localStorage.setItem('dealflow_token', token)
    localStorage.setItem('dealflow_user', JSON.stringify(session))
    localStorage.setItem('dealflow_active_role', selectedRole)

    setTimeout(() => {
      setIsSubmitting(false)
      const destination = selectedRole === 'ADMIN'
        ? 'RevOps Master Admin Portal'
        : selectedRole === 'MANAGER'
        ? 'Approvals & Governance Queue'
        : selectedRole === 'CUSTOMER'
        ? 'Corporate Deal Room'
        : 'CPQ Sales Workspace'

      setFeedback(`Authenticated as ${session.name} (${selectedRole}). Launching ${destination}...`)
      setTimeout(() => {
        if (selectedRole === 'ADMIN') {
          navigate('/app/admin')
        } else if (selectedRole === 'MANAGER') {
          navigate('/app/approvals')
        } else {
          navigate('/app/quotations')
        }
      }, 450)
    }, 350)
  }

  const renderRoleIcon = (role: 'CUSTOMER' | 'MANAGER' | 'REP' | 'ADMIN') => {
    switch (role) {
      case 'CUSTOMER':
        return <Building2 size={20} className="mb-1.5" />
      case 'MANAGER':
        return <Briefcase size={20} className="mb-1.5" />
      case 'REP':
        return <FileText size={20} className="mb-1.5" />
      case 'ADMIN':
        return <ShieldCheck size={20} className="mb-1.5" />
    }
  }

  return (
    <div className="relative min-h-screen bg-bg flex flex-col justify-center items-center px-4 py-12">
      <Ambient />

      {/* Top Header / Back Link */}
      <div className="absolute top-6 left-6 flex items-center gap-4 z-20">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium
                     bg-surface text-fg-2 ring-1 ring-black/[.07] hover:text-accent hover:ring-accent/35"
          style={{ transition: `all 300ms ${EASE_CSS}` }}
        >
          <ArrowLeft size={14} />
          <span>Back to Showcase</span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-[540px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-[28px] w-auto" />
          </div>
          <div className="mb-2">
            <Eyebrow>DealFlow360 Workspace Access</Eyebrow>
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-fg tracking-tight">
            Sign In to Open Workspace
          </h1>
          <p className="text-fg-3 text-[14px] mt-1.5 max-w-sm mx-auto">
            Select a verified persona to test role-isolated governance, dynamic CPQ, and fulfillment.
          </p>
        </div>

        {/* Double-Bezel Login Card */}
        <Bezel className="shadow-lift-2">
          <div className="p-6 sm:p-8 bg-surface rounded-[1.75rem]">
            {/* 1. Persona Selector Strip (Customer, Manager, Rep, Admin) */}
            <div className="mb-6">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-fg-3 mb-2.5">
                Select Persona (Customer, Manager, Rep, Admin)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['CUSTOMER', 'MANAGER', 'REP', 'ADMIN'] as const).map((r) => {
                  const isActive = selectedRole === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleSelectRole(r)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                        isActive
                          ? 'bg-accent/10 border-accent text-accent font-semibold shadow-sm'
                          : 'bg-surface-2/60 border-black/[.06] text-fg-2 hover:bg-surface-2 hover:text-fg'
                      }`}
                      style={{ transition: `all 200ms ${EASE_CSS}` }}
                    >
                      {renderRoleIcon(r)}
                      <span className="text-[12px] capitalize font-medium">{r.toLowerCase()}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Persona Details Pill */}
            <div className="mb-6 rounded-xl bg-surface-2/70 p-3.5 border border-black/[.05] flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-fg flex items-center gap-2">
                  <span>{activePersona.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent font-bold">
                    {activePersona.badge}
                  </span>
                </div>
                <div className="text-[12px] text-fg-3">{activePersona.title}</div>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-fg mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-black/[.12] bg-surface px-3.5 py-2.5 text-[14px] text-fg
                             focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </div>

              {!useMagicLink ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-semibold text-fg">
                      Password
                    </label>
                    <span className="text-[11px] font-mono text-fg-3">Demo: Password123!</span>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-black/[.12] bg-surface px-3.5 py-2.5 text-[14px] text-fg
                               focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                  />
                </div>
              ) : (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[12px] text-amber-700 flex items-start gap-2.5">
                  <KeyRound size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Passwordless Authentication:</span> One-time magic link token will be automatically verified for Acme Corp.
                  </div>
                </div>
              )}

              {feedback && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-[12.5px] text-emerald-700 font-medium animate-fadeIn flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{feedback}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-fg py-3
                           font-display text-[14px] font-semibold text-white shadow-lift-1 hover:bg-accent
                           active:scale-[.98] transition-all disabled:opacity-60"
                style={{ transition: `all 250ms ${EASE_CSS}` }}
              >
                {isSubmitting ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>
                      {selectedRole === 'ADMIN'
                        ? 'Launch Admin Portal'
                        : `Open Workspace as ${activePersona.name}`}
                    </span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-line text-center">
              <span className="text-[12px] text-fg-3">
                Quick Navigation:{' '}
                <Link to="/app/admin" className="text-accent font-semibold hover:underline">
                  Admin Portal
                </Link>{' '}
                ·{' '}
                <Link to="/app/quotations" className="text-accent font-medium hover:underline">
                  Sales Quotations
                </Link>{' '}
                ·{' '}
                <Link to="/app/health" className="text-accent font-medium hover:underline">
                  Deal Health
                </Link>
              </span>
            </div>
          </div>
        </Bezel>
      </div>
    </div>
  )
}
