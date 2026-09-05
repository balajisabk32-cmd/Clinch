import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorBar, Workspace } from '../components/Workspace'
import { useAuth } from '../context/AuthContext'
import {
  ApiError, authApi, passwordChecks, passwordScore, validateEmail,
  type AuthUser,
} from '../lib/authClient'
import { EASE_CSS } from '../lib/motion'

/**
 * Admin user management — the ONLY way an internal account comes into existence.
 *
 * The password meter here is a courtesy to whoever is typing. The API validates
 * independently before hashing, so a request crafted outside this form is held
 * to exactly the same policy.
 */

const ROLE_TONE: Record<string, string> = {
  admin: 'bg-accent-wash text-accent ring-accent/25',
  manager: 'bg-band-managerWash text-band-manager ring-band-manager/25',
  finance: 'bg-band-autoWash text-band-auto ring-band-auto/25',
  rep: 'bg-surface-2 text-fg-2 ring-black/[.08]',
  customer: 'bg-surface-2 text-fg-3 ring-black/[.06]',
}

const ASSIGNABLE = ['rep', 'manager', 'finance', 'admin'] as const

const METER = ['bg-band-finance', 'bg-band-finance', 'bg-band-manager',
               'bg-accent', 'bg-band-auto']

function PasswordField({
  value, onChange, label = 'Password', autoComplete = 'new-password',
}: { value: string; onChange: (v: string) => void; label?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false)
  const checks = passwordChecks(value)
  const { score, label: strength } = passwordScore(value)

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
          {label}
        </span>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            autoComplete={autoComplete}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg bg-surface px-3 py-2 pr-16 text-[13.5px] text-fg
                       ring-1 ring-black/[.09] outline-none focus:ring-accent/45"
          />
          <button
            type="button" onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1
                       text-[11px] font-semibold text-fg-3 hover:text-accent"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>

      {value && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-1">
              {[0, 1, 2, 3].map(i => (
                <div key={i}
                     className={`h-1 flex-1 rounded-full ${i < score ? METER[score] : 'bg-surface-3'}`}
                     style={{ transition: `background 320ms ${EASE_CSS}` }} />
              ))}
            </div>
            <span className="font-mono text-[10.5px] w-12 text-right text-fg-2">{strength}</span>
          </div>
          <ul className="flex flex-col gap-1">
            {checks.map(c => (
              <li key={c.label}
                  className={`flex items-center gap-2 text-[11.5px] ${
                    c.met ? 'text-band-auto' : 'text-fg-3'}`}>
                <span className={`w-3.5 h-3.5 rounded-[4px] grid place-items-center text-[9px]
                                  font-bold ${c.met ? 'bg-band-auto text-white' : 'bg-surface-3'}`}>
                  {c.met ? '✓' : ''}
                </span>
                {c.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const [rows, setRows] = useState<AuthUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resetFor, setResetFor] = useState<AuthUser | null>(null)
  const [resetPw, setResetPw] = useState('')

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'rep' })
  const [emailError, setEmailError] = useState<string | null>(null)

  const load = useCallback(() => {
    authApi.listUsers()
      .then(u => { setRows(u); setError(null) })
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load users.'))
  }, [])
  useEffect(load, [load])

  const canSubmit = useMemo(() =>
    form.name.trim().length > 0 &&
    !validateEmail(form.email) &&
    passwordChecks(form.password).every(c => c.met),
  [form])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const created = await authApi.createUser({
        name: form.name.trim(), email: form.email.trim(),
        password: form.password, role: form.role,
      })
      setNotice(`${created.name} provisioned as ${created.role}. They can sign in now.`)
      setForm({ name: '', email: '', password: '', role: 'rep' })
      setCreating(false)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the user.')
    } finally { setBusy(false) }
  }

  const toggle = async (u: AuthUser) => {
    setError(null)
    try {
      await authApi.setStatus(u.id, !u.is_active)
      setNotice(`${u.name} ${u.is_active ? 'deactivated' : 'reactivated'}.`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the status.')
    }
  }

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetFor) return
    setBusy(true); setError(null)
    try {
      await authApi.resetPassword(resetFor.id, resetPw)
      setNotice(`Password reset for ${resetFor.name}.`)
      setResetFor(null); setResetPw('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password.')
    } finally { setBusy(false) }
  }

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}
        {notice && (
          <div className="rounded-xl bg-band-autoWash ring-1 ring-band-auto/25 px-4 py-2.5
                          text-[13px] text-band-auto">{notice}</div>
        )}

        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-[22px] font-bold text-fg">User management</h1>
            <p className="text-[12.5px] text-fg-3 mt-0.5">
              Internal accounts are created here. There is no public registration.
            </p>
          </div>
          <button
            onClick={() => { setCreating(c => !c); setError(null) }}
            className="ml-auto rounded-full bg-fg text-white px-4 py-2 font-display
                       text-[12.5px] font-semibold hover:shadow-lift-lg active:scale-[.98]"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            {creating ? 'Cancel' : '+ New internal user'}
          </button>
        </header>

        {creating && (
          <form onSubmit={create}
                className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-5
                           grid md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Full name
                </span>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Priya Raman"
                  className="rounded-lg bg-surface px-3 py-2 text-[13.5px] text-fg
                             ring-1 ring-black/[.09] outline-none focus:ring-accent/45
                             placeholder:text-fg-4"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Work email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setEmailError(null) }}
                  onBlur={() => setEmailError(form.email ? validateEmail(form.email) : null)}
                  placeholder="priya@clinch.io"
                  className={`rounded-lg bg-surface px-3 py-2 text-[13.5px] text-fg ring-1
                              outline-none placeholder:text-fg-4
                              ${emailError ? 'ring-band-finance/50' : 'ring-black/[.09] focus:ring-accent/45'}`}
                />
                {emailError && (
                  <span className="text-[11.5px] text-band-finance">{emailError}</span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Role
                </span>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="rounded-lg bg-surface px-3 py-2 text-[13.5px] text-fg
                             ring-1 ring-black/[.09] outline-none focus:ring-accent/45"
                >
                  {ASSIGNABLE.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="text-[11px] text-fg-3">
                  Customers are not created here — they receive a signed link to a
                  single quotation.
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-4">
              <PasswordField
                value={form.password}
                onChange={v => setForm({ ...form, password: v })}
                label="Temporary password"
              />
              <button
                type="submit"
                disabled={!canSubmit || busy}
                className="mt-auto rounded-full bg-fg text-white py-2.5 font-display
                           text-[13px] font-semibold disabled:opacity-40
                           disabled:cursor-not-allowed hover:shadow-lift-lg active:scale-[.98]"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                Create user
              </button>
            </div>
          </form>
        )}

        {resetFor && (
          <form onSubmit={doReset}
                className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-5
                           flex flex-col gap-4 max-w-[480px]">
            <h2 className="font-display text-[15px] font-semibold text-fg">
              Reset password — {resetFor.name}
            </h2>
            <PasswordField value={resetPw} onChange={setResetPw} label="New password" />
            <div className="flex gap-2">
              <button type="submit"
                      disabled={busy || !passwordChecks(resetPw).every(c => c.met)}
                      className="rounded-full bg-fg text-white px-4 py-2 font-display
                                 text-[12.5px] font-semibold disabled:opacity-40">
                Set password
              </button>
              <button type="button" onClick={() => { setResetFor(null); setResetPw('') }}
                      className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2
                                 font-display text-[12.5px] font-semibold text-fg-2">
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[760px]">
              <thead>
                <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                               border-b border-line">
                  <th className="text-left font-medium px-4 py-2.5">Name</th>
                  <th className="text-left font-medium px-3 py-2.5">Email</th>
                  <th className="text-left font-medium px-3 py-2.5 w-24">Role</th>
                  <th className="text-left font-medium px-3 py-2.5 w-28">Created</th>
                  <th className="text-left font-medium px-3 py-2.5 w-28">Last login</th>
                  <th className="text-left font-medium px-3 py-2.5 w-24">Status</th>
                  <th className="text-right font-medium px-4 py-2.5 w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-fg font-medium">
                      {u.name}
                      {u.id === me?.id && (
                        <span className="ml-2 font-mono text-[9.5px] text-fg-3">you</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-fg-2">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full ring-1 px-2 py-0.5 font-mono text-[10px]
                                        font-semibold uppercase ${ROLE_TONE[u.role] ?? ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11.5px] text-fg-3">
                      {u.created_at?.slice(0, 10) ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11.5px] text-fg-3">
                      {u.last_login_at?.slice(0, 10) ?? 'never'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono text-[10.5px] font-semibold ${
                        u.is_active ? 'text-band-auto' : 'text-band-finance'}`}>
                        {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => toggle(u)}
                        disabled={u.id === me?.id}
                        title={u.id === me?.id
                          ? 'You cannot deactivate your own account'
                          : undefined}
                        className="rounded-full ring-1 ring-black/[.08] bg-surface px-3 py-1
                                   text-[11.5px] font-semibold text-fg-2 hover:text-fg
                                   disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => { setResetFor(u); setResetPw('') }}
                        className="ml-2 rounded-full ring-1 ring-black/[.08] bg-surface px-3 py-1
                                   text-[11.5px] font-semibold text-fg-2 hover:text-accent"
                      >
                        Reset password
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !error && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-fg-3">
                    No users yet.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Workspace>
  )
}
