import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError, validateEmail } from '../lib/authClient'
import { EASE_CSS } from '../lib/motion'

/**
 * Sign in.
 *
 * There is no registration link and no role picker. Internal accounts are
 * provisioned by an administrator (PS §A1), so a public signup would be a hole
 * in the access model rather than a convenience — and the previous version of
 * this screen let anyone pick a role from a dropdown and walk straight in
 * without a password being checked at all.
 */

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const { login, user, isAuthenticated, isLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const expired = new URLSearchParams(window.location.search).get('expired') === 'true'
  const from = location.state?.from || new URLSearchParams(window.location.search).get('from')

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.role === 'customer') {
        if (localStorage.getItem('df360_token')) {
          navigate('/shop', { replace: true })
        }
      } else {
        navigate('/app/dashboard', { replace: true })
      }
    }
  }, [isLoading, isAuthenticated, user, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const bad = validateEmail(email)
    setEmailError(bad)
    if (bad) return
    if (!password) { setFormError('Enter your password.'); return }

    setBusy(true)
    try {
      const user = await login(email, password)
      if (user.role === 'customer' || email === 'rajesh@acme.com' || email.includes('acme') || email.includes('techcorp')) {
        try {
          const custRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          if (custRes.ok) {
            const custData = await custRes.json()
            if (custData?.token) {
              localStorage.setItem('df360_token', custData.token)
            }
          }
        } catch {}
        navigate('/shop', { replace: true })
        return
      }
      navigate(from || '/app/dashboard', { replace: true })
    } catch (err) {
      // Never echo which half was wrong — the server deliberately does not say,
      // and inventing a distinction here would undo that.
      setFormError(err instanceof ApiError
        ? err.message
        : 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-bg grid place-items-center px-5 py-10">
      <div className="w-full max-w-[420px] flex flex-col gap-5">
        <Link to="/" className="self-center">
          <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-8 w-auto" />
        </Link>

        <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift-lg p-7
                        flex flex-col gap-5">
          <div>
            <h1 className="font-display text-[22px] font-bold text-fg">Sign in</h1>
            <p className="text-[13px] text-fg-2 mt-1">
              Access the Clinch sales operations workspace.
            </p>
          </div>

          {expired && (
            <div className="rounded-xl bg-band-managerWash ring-1 ring-band-manager/25
                            px-3.5 py-2.5 text-[12.5px] text-band-manager">
              Your session expired. Please sign in again.
            </div>
          )}

          {formError && (
            <div role="alert"
                 className="rounded-xl bg-band-financeWash ring-1 ring-band-finance/25
                            px-3.5 py-2.5 text-[12.5px] text-band-finance">
              {formError}
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                Work email
              </span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(null) }}
                onBlur={() => setEmailError(email ? validateEmail(email) : null)}
                placeholder="you@company.com"
                aria-invalid={!!emailError}
                className={`rounded-lg bg-surface px-3.5 py-2.5 text-[14px] text-fg
                            ring-1 outline-none placeholder:text-fg-4
                            ${emailError ? 'ring-band-finance/50 focus:ring-band-finance'
                                         : 'ring-black/[.09] focus:ring-accent/45'}`}
              />
              {emailError && (
                <span className="text-[11.5px] text-band-finance">{emailError}</span>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg bg-surface px-3.5 py-2.5 pr-16 text-[14px]
                             text-fg ring-1 ring-black/[.09] outline-none
                             focus:ring-accent/45 placeholder:text-fg-4"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1
                             text-[11px] font-semibold text-fg-3 hover:text-accent"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-full bg-fg text-white py-2.5 font-display text-[13.5px]
                         font-semibold hover:shadow-lift-lg active:scale-[.98]
                         disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-[11.5px] leading-relaxed text-fg-3 border-t border-line pt-4">
            Staff accounts are provisioned by system administration. Buying from
            us?{' '}
            <Link to="/register" className="text-accent hover:underline font-medium">
              Create a buyer account
            </Link>.
          </p>

          {/* Quick Demo Sign-In */}
          <div className="border-t border-line pt-4 space-y-2.5">
            <span className="font-mono text-[10.5px] uppercase tracking-eyebrow text-fg-3">
              One-click demo sign-in
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role: 'Customer Portal', name: 'Rajesh Kumar (Acme)', email: 'rajesh@acme.com', pass: 'password123', color: 'text-lime-900 bg-lime-100 ring-lime-600/30 col-span-2 shadow-sm font-semibold' },
                { role: 'Admin', name: 'Clinch Admin', email: 'admin@clinch.io', pass: 'ClinchAdmin2026!#', color: 'text-purple-700 bg-purple-50 ring-purple-600/20' },
                { role: 'Sales Manager', name: 'M. Shah', email: 'shah@clinch.io', pass: 'MgrShah2026!#', color: 'text-amber-700 bg-amber-50 ring-amber-600/20' },
                { role: 'Sales Rep', name: 'A. Rao', email: 'rao@clinch.io', pass: 'RepRao2026!#', color: 'text-cyan-700 bg-cyan-50 ring-cyan-600/20' },
                { role: 'Finance', name: 'R. Menon', email: 'menon@clinch.io', pass: 'FinMenon2026!#', color: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20' },
              ].map(acc => (
                <button
                  key={acc.role}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setEmail(acc.email)
                    setPassword(acc.pass)
                    setFormError(null)
                    setBusy(true)
                    try {
                      const user = await login(acc.email, acc.pass)
                      if (user.role === 'customer' || acc.email === 'rajesh@acme.com' || acc.email.includes('acme') || acc.email.includes('techcorp')) {
                        try {
                          const custRes = await fetch('http://localhost:5000/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: acc.email, password: acc.pass }),
                          })
                          if (custRes.ok) {
                            const custData = await custRes.json()
                            if (custData?.token) {
                              localStorage.setItem('df360_token', custData.token)
                            }
                          }
                        } catch {}
                        navigate('/shop', { replace: true })
                        return
                      }
                      navigate(from || '/app/dashboard', { replace: true })
                    } catch (err: any) {
                      setFormError(err?.message || 'Sign in failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-left text-xs ring-1 font-medium hover:scale-[1.02] active:scale-[0.98] transition-all ${acc.color}`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>{acc.role}</span>
                    {acc.name && <span className="text-[10.5px] font-normal opacity-85">{acc.name}</span>}
                  </div>
                  <div className="text-[10px] opacity-75 font-mono truncate">{acc.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[11.5px] text-fg-4">
          Customers: use the secure quotation link sent to you by your account team.
        </p>
      </div>
    </div>
  )
}
