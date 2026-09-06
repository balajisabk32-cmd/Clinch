import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ApiError, shopApi, tokenStore, validateEmail,
  passwordChecks, passwordScore, passwordValid,
} from '../lib/authClient'
import { cn } from '../lib/cn'

/**
 * Customer registration.
 *
 * This is the ONE public sign-up in Clinch, and it can only ever produce a
 * customer. Reps, managers, finance and admins are provisioned by an
 * administrator, because an internal role is an authority grant over other
 * people's deals; a customer account has authority over its own basket and
 * nothing else.
 *
 * The role is not a field on this form, and the server does not read one from
 * the body — a request asking for "admin" gets a customer like everyone else.
 */

function PasswordField({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  const checks = passwordChecks(value)
  const { score, label } = passwordScore(value)

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
          Password
        </span>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg bg-surface px-3.5 py-2.5 pr-16 text-[14px] text-fg
                       ring-1 ring-black/[.09] outline-none focus:ring-accent/45"
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1
                       text-[11px] font-semibold text-fg-3 hover:text-accent"
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>

      {value && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {[0, 1, 2, 3].map(i => (
                <span key={i} className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  i < score
                    ? score <= 1 ? 'bg-band-finance'
                      : score === 2 ? 'bg-band-manager' : 'bg-band-auto'
                    : 'bg-surface-3',
                )} />
              ))}
            </div>
            <span className="font-mono text-[10px] text-fg-3 w-20 text-right">
              {label}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {checks.map(c => (
              <li key={c.label} className={cn(
                'flex items-center gap-1.5 text-[11.5px]',
                c.met ? 'text-band-auto' : 'text-fg-3',
              )}>
 <span aria-hidden="true">{c.met ? '' : '○'}</span>{c.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default function Register() {
  const [f, setF] = useState({
    name: '', email: '', password: '', company: '',
    gst_number: '', phone: '', city: '',
  })
  const [emailError, setEmailError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof f) => (v: string) => setF(s => ({ ...s, [k]: v }))

  const ready = f.name.trim() && f.company.trim() && f.email.trim()
    && passwordValid(f.password) && !emailError

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const bad = validateEmail(f.email)
    setEmailError(bad)
    if (bad) return
    if (!f.name.trim()) { setError('Enter your full name.'); return }
    if (!f.company.trim()) { setError('Enter your company name.'); return }
    if (!passwordValid(f.password)) { setError('Choose a stronger password.'); return }

    setBusy(true)
    try {
      const res = await shopApi.register({
        name: f.name.trim(), email: f.email.trim(), password: f.password,
        company: f.company.trim(),
        gst_number: f.gst_number.trim() || undefined,
        phone: f.phone.trim() || undefined,
        city: f.city.trim() || undefined,
      })
      // Registration signs you straight in — a fresh account has nothing to
      // protect yet, and bouncing to a login form to retype what you just typed
      // is friction with no security value.
      tokenStore.set(res.access_token, res.user as any)
      window.location.assign('/shop')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.')
      setBusy(false)
    }
  }

  const field = (
    key: keyof typeof f, label: string,
    opts: { type?: string; placeholder?: string; optional?: boolean } = {},
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
        {label}{opts.optional && <span className="text-fg-4 normal-case"> · optional</span>}
      </span>
      <input
        type={opts.type ?? 'text'}
        value={f[key]}
        onChange={e => set(key)(e.target.value)}
        onBlur={key === 'email' ? () => setEmailError(f.email ? validateEmail(f.email) : null) : undefined}
        placeholder={opts.placeholder}
        aria-invalid={key === 'email' ? !!emailError : undefined}
        className={cn(
          'rounded-lg bg-surface px-3.5 py-2.5 text-[14px] text-fg ring-1 outline-none',
          'placeholder:text-fg-4',
          key === 'email' && emailError
            ? 'ring-band-finance/50 focus:ring-band-finance'
            : 'ring-black/[.09] focus:ring-accent/45',
        )}
      />
      {key === 'email' && emailError && (
        <span className="text-[11.5px] text-band-finance">{emailError}</span>
      )}
    </label>
  )

  return (
    <div className="min-h-[100dvh] bg-bg grid place-items-center px-5 py-12">
      <div className="w-full max-w-[560px] flex flex-col gap-5">
        <Link to="/" className="self-center">
          <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-8 w-auto" />
        </Link>

        <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift-lg p-7
                        flex flex-col gap-5">
          <div>
            <h1 className="font-display text-[24px] font-bold text-fg tracking-tight">
              Create a buyer account
            </h1>
            <p className="text-[13px] text-fg-2 mt-1.5 leading-relaxed">
              Browse the catalogue at your tier pricing, build a basket and request
              a quotation from your account manager.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-band-financeWash ring-1 ring-band-finance/25
                                         px-3.5 py-2.5 text-[12.5px] text-band-finance">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="grid sm:grid-cols-2 gap-4">
              {field('name', 'Full name', { placeholder: 'Priya Sharma' })}
              {field('email', 'Work email', { type: 'email', placeholder: 'you@company.com' })}
            </div>

            <div className="rule" />
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 -mb-1">
              Company details
            </span>

            <div className="grid sm:grid-cols-2 gap-4">
              {field('company', 'Company name', { placeholder: 'Northwind Traders' })}
              {field('city', 'City', { placeholder: 'Bengaluru', optional: true })}
              {field('gst_number', 'GST number', { placeholder: '29ABCDE1234F1Z5', optional: true })}
              {field('phone', 'Phone', { placeholder: '+91 98450 11223', optional: true })}
            </div>

            <div className="rule" />
            <PasswordField value={f.password} onChange={set('password')} />

            <button
              type="submit"
              disabled={busy || !ready}
              className="mt-1 rounded-full bg-fg text-white py-3 font-display text-[13.5px]
                         font-semibold hover:shadow-lift-lg active:scale-[.98]
                         disabled:opacity-45 disabled:cursor-not-allowed transition-all"
            >
              {busy ? 'Creating your account…' : 'Create account'}
            </button>
          </form>

          <p className="text-[12px] text-fg-3 border-t border-line pt-4 leading-relaxed">
            New accounts start on <b className="text-fg">Bronze</b> pricing and move up
            automatically as you buy. Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline font-medium">Sign in</Link>.
          </p>
        </div>

        <p className="text-center text-[11.5px] text-fg-4">
          Clinch staff accounts are provisioned by system administration, not here.
        </p>
      </div>
    </div>
  )
}
