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
    if (path === '/auth/login') {
      let detail: any = null
      try { detail = (await res.json()).detail } catch { /* ignore */ }
      const message =
        (typeof detail === 'object' && detail?.message) ||
        (typeof detail === 'string' && detail) ||
        'Email or password is incorrect.'
      throw new ApiError(401, detail, message)
    }

    // If there was no token sent, this was an anonymous public request
    // (such as the landing page reading live engine data). It is NOT an expired session.
    if (!token) {
      throw new ApiError(401, null, 'Authentication required.')
    }

    // If the user is viewing the public landing page, do not force-redirect to /login
    if (typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '')) {
      tokenStore.clear()
      throw new ApiError(401, null, 'Authentication required.')
    }

    // If a non-auth request received 401, verify with /auth/me before declaring session expired.
    // This prevents transient blips from evicting active users during quick UI mutations.
    if (path !== '/auth/me' && token) {
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

/* ── Customer storefront ───────────────────────────────────────────────────
   A separate surface with a separate client, so nothing here can accidentally
   be called from an internal screen and vice versa. Every one of these paths
   is refused outright for an internal role, and every internal path is refused
   for a customer -- the permission sets are disjoint on the server. */

export interface ShopProduct {
  sku: string; name: string; category: string; description: string
  uom: string; tax_pct: number
  is_recurring: boolean; recurrence: string | null; is_promoted: boolean
  list_price: number; your_price: number
  availability: 'in_stock' | 'low_stock' | 'made_to_order'
  variants: any[]
  image: string | null
}

export interface CartLine {
  sku: string; name: string; category: string; qty: number
  list_price: number; your_price: number; line_total: number; is_recurring: boolean
  image: string | null
}

export interface Cart {
  lines: CartLine[]; subtotal: number; count: number; tier: string
}

export interface ShopMe extends AuthUser {
  company: string; gst_number: string | null; phone: string | null; city: string | null
  tier: 'Bronze' | 'Silver' | 'Gold'
  lifetime_value: number
  next_tier: string | null
  remaining: number | null
  progress_pct: number | null
  locked: boolean
}

export interface ShopQuoteLine {
  id: number; name: string; category: string; qty: number
  unit_price: number; discount_pct: number; line_total: number
}

export interface ShopQuote {
  ref: string; customer: string; status: string; awaiting_us: boolean
  currency: string; subtotal: number; discount_total: number
  tax_total: number; total: number; recurring_total: number
  can_confirm: boolean; can_negotiate: boolean
  comments: Array<{ line_id: number | null; author: string; body: string | null
                    counter_discount_pct: number | null; created_at: string }>
  lines: ShopQuoteLine[]
}

export interface RegisterBody {
  name: string; email: string; password: string; company: string
  gst_number?: string; phone?: string; address?: string
  city?: string; postcode?: string
}

/* ── Admin: subscription plans and rep reporting ───────────────────────── */

export interface SubscriptionPlan {
  id: number; name: string; code: string
  billing_cycle: 'monthly' | 'quarterly' | 'yearly'
  base_price: number; proration_rule: string
  cancellation_notice_days: number; is_active: boolean; created_at: string
}

export interface RepScorecard {
  rep: string; period: string
  quotes_built: number; deals_closed_won: number; booked_revenue: number
  avg_discount_pct: number; margin_leakage: number; outliers_flagged: number
  avg_approval_hours: number; compliance_rate_pct: number
  available_reps: string[]
  deals: Array<{ ref: string; customer: string; closed_at: string
                 approval_hours: number | null; value: number; avg_discount: number }>
}

export const adminApi = {
  plans: (includeInactive = false) =>
    request<SubscriptionPlan[]>(
      `/admin/subscriptions${includeInactive ? '?include_inactive=true' : ''}`),

  createPlan: (body: Partial<SubscriptionPlan>) =>
    request<SubscriptionPlan>('/admin/subscriptions',
      { method: 'POST', body: JSON.stringify(body) }),

  updatePlan: (id: number, body: Partial<SubscriptionPlan>) =>
    request<SubscriptionPlan>(`/admin/subscriptions/${id}`,
      { method: 'PUT', body: JSON.stringify(body) }),

  deactivatePlan: (id: number) =>
    request<{ id: number; is_active: boolean; message: string }>(
      `/admin/subscriptions/${id}`, { method: 'DELETE' }),

  repPerformance: (rep: string, period: string) => {
    const qs = new URLSearchParams({ period })
    if (rep && rep !== 'All reps') qs.set('rep', rep)
    return request<RepScorecard>(`/admin/reports/rep-performance?${qs}`)
  },

  /** Export URL. The browser fetches it with the bearer header via `download`. */
  exportUrl: (kind: 'csv' | 'pdf', rep: string, period: string) => {
    const qs = new URLSearchParams({ period })
    if (rep && rep !== 'All reps') qs.set('rep', rep)
    return `/admin/reports/rep-performance/export/${kind}?${qs}`
  },
}

/**
 * Download a binary export.
 *
 * A plain <a href> cannot carry the Authorization header, so the endpoint would
 * answer 401 and the browser would save the error page under a .pdf name -- a
 * file that opens to nothing. Fetching it as a blob keeps the header and lets
 * the failure surface as a real error instead.
 */
export async function downloadExport(path: string, filename: string): Promise<void> {
  const token = tokenStore.get()
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    throw new ApiError(res.status, null,
      res.status === 403 ? 'Only administrators can export reports.'
        : `Export failed (${res.status}).`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on the next tick: revoking synchronously can beat the click in
  // some browsers and produce a zero-byte file.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const shopApi = {
  register: (body: RegisterBody) =>
    request<{ access_token: string; token_type: string; user: AuthUser & {
      company: string; tier: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(body), auth: false },
    ),

  me: () => request<ShopMe>('/shop/me'),

  catalog: (params: { category?: string; q?: string } = {}) => {
    const qs = new URLSearchParams()
    if (params.category && params.category !== 'All') qs.set('category', params.category)
    if (params.q) qs.set('q', params.q)
    const tail = qs.toString()
    return request<{ tier: string; categories: string[]; products: ShopProduct[] }>(
      `/shop/catalog${tail ? `?${tail}` : ''}`)
  },

  product: (sku: string) => request<ShopProduct>(`/shop/catalog/${sku}`),

  cart: () => request<Cart>('/shop/cart'),

  setCartLine: (sku: string, qty: number) =>
    request<Cart>('/shop/cart', { method: 'POST', body: JSON.stringify({ sku, qty }) }),

  removeCartLine: (sku: string) =>
    request<Cart>(`/shop/cart/${sku}`, { method: 'DELETE' }),

  requestQuotation: (note?: string) =>
    request<{ ref: string; state: string; rep: string; message: string }>(
      '/shop/quote-requests',
      { method: 'POST', body: JSON.stringify({ note: note ?? '' }) }),

  quotes: () => request<Omit<ShopQuote, 'lines'>[]>('/shop/quotes'),

  quote: (ref: string) => request<ShopQuote>(`/shop/quotes/${ref}`),

  confirm: (ref: string, body: { counter_discount_pct?: number | null
                                 line_id?: number | null
                                 comment?: string } = {}) =>
    request<{ ref: string; state: string; approval_required: boolean
              risk_score: number; risk_band: string
              routed_to?: string; needs_finance?: boolean
              fulfilment_suggestion?: any; message: string }>(
      `/shop/quotes/${ref}/confirm`,
      { method: 'POST', body: JSON.stringify(body) }),

  negotiate: (ref: string, body: { line_id?: number | null
                                   counter_discount_pct?: number | null
                                   comment?: string }) =>
    request<any>(`/shop/quotes/${ref}/request`,
      { method: 'POST', body: JSON.stringify(body) }),
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
