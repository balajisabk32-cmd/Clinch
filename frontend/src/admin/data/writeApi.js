/**
 * Write-back for the admin panel.
 *
 * The panel's actions previously only mutated local React state, which meant an
 * admin could "create a product", see it appear, and then watch it vanish on the
 * next reload — while the sales workspace never saw it at all. These helpers
 * push each change to the engine so the two surfaces stay one system.
 *
 * Every call is authenticated with the session token, because catalogue and
 * policy edits are permission-gated SERVER-side. A 403 here is the server doing
 * its job, and the caller surfaces it as a toast rather than pretending the
 * change succeeded.
 */

const BASE = import.meta.env.DEV ? '/api' : 'http://localhost:8000'

function authHeaders() {
  let token = null
  try {
    token = localStorage.getItem('clinch_token')
  } catch {
    /* private mode — fall through unauthenticated */
  }
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function send(path, method, body) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: authHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      let detail = null
      try { detail = (await res.json()).detail } catch { /* non-JSON error */ }
      const err = new Error(
        detail?.message ||
        (res.status === 403
          ? 'Your role is not permitted to make this change.'
          : `Request failed (${res.status}).`),
      )
      err.status = res.status
      throw err
    }
    return res.status === 204 ? null : await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Admin product shape -> API product shape. */
function toApiProduct(p) {
  return {
    sku: p.sku || p.id,
    name: p.name,
    category: p.category,
    list_price: Number(p.basePrice ?? p.list_price ?? 0),
    cost: Number(p.cost ?? 0),
    uom: p.unit || p.uom || 'Each',
    tax_pct: Number(p.taxRate ?? p.tax_pct ?? 18),
    description: p.description || '',
    is_recurring: !!p.isRecurring,
    recurrence: p.isRecurring ? (p.recurrence || 'monthly') : null,
    is_promoted: !!p.isPromoted,
  }
}

export const writeApi = {
  createProduct: (p) => send('/products', 'POST', toApiProduct(p)),

  updateProduct: (sku, p) => send(`/products/${sku}`, 'PATCH', toApiProduct(p)),

  /** Tier ceilings and category ceilings both live on the governance policy. */
  savePolicy: (patch) => send('/policy', 'PUT', patch),

  savePriceLists: (rules) => send('/pricelists', 'PUT', { pricelists: rules }),
}

/**
 * Run a write and report the outcome, without ever leaving the UI showing a
 * change the server refused.
 *
 * `onOk` re-syncs from the engine rather than trusting the local edit, so what
 * the admin sees after saving is what actually persisted.
 */
export async function withWrite(fn, { showToast, onOk, okMessage }) {
  try {
    const result = await fn()
    if (okMessage) showToast?.(okMessage, 'success')
    await onOk?.()
    return result
  } catch (err) {
    showToast?.(err.message || 'Could not save the change.', 'error')
    // Re-sync so the screen shows the server's truth, not the rejected edit.
    await onOk?.()
    return null
  }
}
