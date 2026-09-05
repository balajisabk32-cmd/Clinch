/**
 * Authenticated HTTP client.
 *
 * One place attaches the bearer token, and one place reacts to a 401. Scattering
 * either across pages is how a session ends up half-cleared: some screens
 * redirect, others keep rendering with a dead token.
 */

const BASE = import.meta.env.DEV ? '/api' : 'http://localhost:8000'

const TOKEN_KEY = 'clinch_token'
const USER_KEY = 'clinch_user'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'finance' | 'rep' | 'customer'
  is_active: boolean
  created_at?: string
  last_login_at?: string | null
  permissions: string[]
}

export interface Tab { to: string; label: string }

/* ── Token storage ─────────────────────────────────────────────────────────
   localStorage is a deliberate, stated trade-off: it survives a refresh but is
   readable by any script on the origin. It is safe HERE only because the token
   grants nothing on its own — every privileged action is re-checked against the
   database server-side, so a stolen token cannot exceed the role it was issued
   for, and revoking the account kills it on the next request.            */
export const tokenStore = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set(token: string, user: AuthUser) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } catch { /* private mode: session lives in memory only */ }
  },
  cachedUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch { return null }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      // Legacy keys from the mock-auth era. Left behind they would keep
      // resurrecting a fake identity that no longer means anything.
      for (const stale of ['dealflow_user', 'dealflow_token', 'dealflow_active_role']) {
        localStorage.removeItem(stale)
      }
    } catch { /* nothing to clear */ }
  },
}

export class ApiError extends Error {
  status: number
  detail: any
  constructor(status: number, detail: any, message: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

/** Fired on 401 so the AuthContext can tear the session down exactly once. */
export const SESSION_EXPIRED = 'clinch:session-expired'

export async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = init
  const token = auth ? tokenStore.get() : null

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    })
  } catch (err: any) {
    clearTimeout(timer)
    throw new ApiError(0, null,
      err?.name === 'AbortError'
        ? 'The server took too long to respond.'
        : 'Cannot reach the server.')
  }
  clearTimeout(timer)

  if (res.status === 401) {
    // If a non-auth request received 401, verify with /auth/me before declaring session expired.
    // This prevents transient blips from evicting active users during quick UI mutations.
    if (path !== '/auth/me' && path !== '/auth/login' && token) {
      try {
        const verifyRes = await fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (verifyRes.ok) {
          let detail: any = null
          try { detail = (await res.json()).detail } catch { /* ignore */ }
          throw new ApiError(401, detail, 'Unauthorized action.')
        }
      } catch (checkErr) {
        if (checkErr instanceof ApiError) throw checkErr
      }
    }

    tokenStore.clear()
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED))
    throw new ApiError(401, null, 'Your session has expired. Please sign in again.')
  }

  if (!res.ok) {
    let detail: any = null
    try { detail = (await res.json()).detail } catch { /* non-JSON error body */ }
    const message =
      (typeof detail === 'object' && detail?.message) ||
      (typeof detail === 'string' && detail) ||
      `Request failed (${res.status}).`
    throw new ApiError(res.status, detail, message)
  }

  return res.status === 204 ? (null as T) : ((await res.json()) as T)
}

export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; expires_in: number
              user: AuthUser; tabs: Tab[] }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }), auth: false },
    ),

  me: () => request<AuthUser & { tabs: Tab[] }>('/auth/me'),

  listUsers: () => request<AuthUser[]>('/admin/users'),

  createUser: (body: { name: string; email: string; password: string; role: string }) =>
    request<AuthUser>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),

  setStatus: (id: string, is_active: boolean) =>
    request<AuthUser>(`/admin/users/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ is_active }) }),

  resetPassword: (id: string, password: string) =>
    request<{ ok: boolean }>(`/admin/users/${id}/reset-password`,
      { method: 'POST', body: JSON.stringify({ password }) }),
}

/* ── Validation, mirroring core/security.py exactly ────────────────────────
   The server is the control; this exists so the form can respond as the user
   types. If the two ever disagree the server wins and the form is the bug. */

export const EMAIL_RE =
  /^(?!\.)(?!.*\.\.)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}(?<!\.)@(?!-)[A-Za-z0-9-]{1,63}(?<!-)(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*\.[A-Za-z]{2,63}$/

export function validateEmail(email: string): string | null {
  const e = (email || '').trim().toLowerCase()
  if (!e) return 'Email is required.'
  if (e.length > 254) return 'Email address is too long.'
  if (!EMAIL_RE.test(e)) return 'Enter a valid email address.'
  return null
}

export const SPECIALS = '!@#$%^&*()_+-=[]{}|;:,.<>?'

export interface PasswordCheck {
  label: string
  met: boolean
}

export function passwordChecks(pw: string): PasswordCheck[] {
  const p = pw || ''
  return [
    { label: 'At least 8 characters', met: p.length >= 8 },
    { label: 'Uppercase and lowercase letters',
      met: /[A-Z]/.test(p) && /[a-z]/.test(p) },
    { label: 'At least one number', met: /[0-9]/.test(p) },
    { label: 'At least one special character',
      met: [...p].some(c => SPECIALS.includes(c)) },
  ]
}

export function passwordScore(pw: string): { score: number; label: string } {
  const p = pw || ''
  if (!p) return { score: 0, label: 'Empty' }
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/[0-9]/.test(p) && [...p].some(c => SPECIALS.includes(c))) score++
  return { score, label: ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][score] }
}

export const passwordValid = (pw: string) => passwordChecks(pw).every(c => c.met)
