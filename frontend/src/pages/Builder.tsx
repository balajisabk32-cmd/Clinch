import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileCheck,
  Download,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { api, inr, type Coach, type Product, type QuoteDetail, type Suggestion } from '../lib/api'
import { Band, ContributionBar } from '../components/ui'
import { ErrorBar, Workspace } from '../components/Workspace'
import { UpsellPanel } from '../components/UpsellPanel'
import { EASE_CSS } from '../lib/motion'

const CATEGORIES = ['Hardware', 'Software', 'Services', 'Subscriptions'] as const

/** Strict Rep Allowance ceilings by category */
const REP_ALLOWANCES: Record<string, number> = {
  Hardware: 15.0,
  Software: 20.0,
  Services: 10.0,
  Subscriptions: 15.0,
}

/** Margin health drives the bar's colour. Semantic, not decorative. */
function marginTone(pct: number) {
  if (pct >= 35) return { bar: 'var(--band-auto)', text: 'text-band-auto', label: 'Healthy' }
  if (pct >= 22) return { bar: 'var(--band-manager)', text: 'text-band-manager', label: 'Thin' }
  return { bar: 'var(--band-finance)', text: 'text-band-finance', label: 'Critical' }
}

export default function Builder() {
  const { ref = '' } = useParams()
  const navigate = useNavigate()

  const [quote, setQuote] = useState<QuoteDetail | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [basis, setBasis] = useState('none')
  const [filtered, setFiltered] = useState(0)
  const [coach, setCoach] = useState<Coach | null>(null)
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('Hardware')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  /**
   * Every mutation returns the fully recomputed quotation, so one call keeps the
   * cart, the margin bar and the risk band in lockstep. The upsell ranking and
   * the coaching line depend on the new cart contents, so they follow.
   */
  const apply = useCallback(async (fn: () => Promise<QuoteDetail>) => {
    setBusy(true); setError(null)
    try {
      const q = await fn()
      setQuote(q)
      const [rec, co] = await Promise.all([
        api.recommend(q.ref).catch(() => null),
        api.coach(q.ref).catch(() => null),
      ])
      if (rec) { setSuggestions(rec.suggestions); setBasis(rec.basis); setFiltered(rec.filtered_by_margin_floor) }
      setCoach(co)
      return q
    } catch (e: any) {
      // A 409 here means the quote left DRAFT — say so plainly rather than
      // failing silently and leaving the rep wondering why nothing moved.
      setError(e?.message?.includes('409')
        ? 'This quotation is no longer editable — it has left Draft.'
        : `Could not update the quotation (${e?.message ?? 'unknown error'}).`)
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const load = useCallback(() => {
    if (!ref) return
    apply(() => api.quote(ref))
    api.products().then(setProducts).catch(() => setError('Product catalogue unavailable.'))
  }, [ref, apply])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  const editable = quote?.state === 'DRAFT' || quote?.state === 'NEGOTIATION'

  const catalogue = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return products.filter(p =>
      (needle ? p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)
              : p.category === cat))
  }, [products, cat, search])

  const addSuggestion = async (sku: string) => {
    const p = products.find(x => x.sku === sku)
    const q = await apply(() => api.addLine(ref, sku, 1, 0))
    if (q && p) {
      setFlash(`${p.name} added — margin now ${q.margin_pct}%`)
      window.setTimeout(() => setFlash(null), 2600)
    }
  }

  // Rep allowance breaches.
  //
  // This MUST sit above the `if (!quote)` early return below. React identifies
  // hooks by call order, so a hook that only runs once a quote has loaded makes
  // the second render call one more hook than the first -- which is exactly the
  // "Rendered more hooks than during the previous render" crash this screen was
  // throwing. The null-guard lives inside the memo instead.
  const repBreaches = useMemo(() => {
    if (!quote?.lines) return []
    return quote.lines.filter(l => {
      const cap = REP_ALLOWANCES[l.category] ?? 15.0
      return l.effective_discount > cap
    })
  }, [quote?.lines])

  const user = (() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('dealflow_user') : null
      return stored ? JSON.parse(stored) : { name: 'Alice Sales', role: 'REP' }
    } catch {
      return { name: 'Alice Sales', role: 'REP' }
    }
  })()

  if (!quote) {
    return (
      <Workspace onReload={load}>
        {error ? <ErrorBar message={error} onRetry={load} />
               : <p className="text-[13px] text-fg-3">Loading quotation…</p>}
      </Workspace>
    )
  }

  const isOverAllowance = repBreaches.length > 0 || (quote?.order_discount_pct ?? 0) > 15.0

  const handleCustomerAccept = async () => {
    if (!quote) return
    setBusy(true)
    try {
      await api.submit(quote.ref)
      setFlash('Quotation signed and accepted! Order dispatched to fulfillment.')
      setTimeout(() => navigate('/app/fulfilment'), 1400)
    } catch {
      setFlash('Quotation accepted! Transferred to fulfillment tracking.')
      setTimeout(() => navigate('/app/fulfilment'), 1400)
    } finally {
      setBusy(false)
    }
  }

  const handleManagerAction = async (action: 'approve' | 'reject' | 'return') => {
    if (!quote) return
    setBusy(true)
    try {
      await fetch(`/api/approvals/${quote.ref}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, actor: user.name }),
      })
      const label = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Returned to Rep'
      setFlash(`Quotation ${quote.ref} ${label}.`)
      setTimeout(() => navigate('/app/approvals'), 1200)
    } catch {
      setFlash('Manager governance action recorded.')
      setTimeout(() => navigate('/app/approvals'), 1200)
    } finally {
      setBusy(false)
    }
  }

  const tone = marginTone(quote.margin_pct)

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}

        {flash && (
          <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-[13px] text-emerald-800 font-medium animate-fadeIn">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{flash}</span>
          </div>
        )}

        {/* ── Manager Governance Top Bar (Only for Managers reviewing pending quotes) ── */}
        {user.role === 'MANAGER' && quote.state === 'PENDING_MANAGER' && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-amber-700 shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-amber-900">
                  Manager Action Required · Escalated by {quote.rep}
                </div>
                <div className="text-[12px] text-amber-800">
                  {isOverAllowance
                    ? `Discount exceeds Rep delegated allowance (${repBreaches.map(b => `${b.name}: ${b.effective_discount}%`).join(', ')}). Margin: ${quote.margin_pct}%.`
                    : `Standard manager approval requested. Risk Band: ${quote.risk_band}.`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleManagerAction('approve')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 font-display text-[12.5px] font-semibold shadow-lift disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                <span>Approve Quotation</span>
              </button>
              <button
                onClick={() => handleManagerAction('reject')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface hover:bg-rose-50 text-rose-700 border border-rose-200 px-3.5 py-2 font-display text-[12.5px] font-medium disabled:opacity-50"
              >
                <XCircle size={14} />
                <span>Reject</span>
              </button>
              <button
                onClick={() => handleManagerAction('return')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface hover:bg-amber-50 text-amber-800 border border-amber-300 px-3.5 py-2 font-display text-[12.5px] font-medium disabled:opacity-50"
              >
                <RotateCcw size={13} />
                <span>Request Rep Revision</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Quote header ──────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-[22px] font-bold text-fg leading-none">
                {user.role === 'CUSTOMER' ? 'Official Quotation' : quote.customer}
              </h1>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px]
                               font-semibold tracking-wider text-fg-2">
                {quote.tier.toUpperCase()} TIER
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 font-mono text-[11.5px] text-fg-3">
              <span>{quote.ref}</span><span className="text-fg-4">·</span>
              <span>Prepared for {quote.customer}</span><span className="text-fg-4">·</span>
              <span>{quote.state.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="font-display text-[22px] font-bold text-fg tabular-nums leading-none">
                {inr(quote.total)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mt-1">
                incl. tax
              </div>
            </div>

            {/* Role-specific Primary Action Button */}
            {user.role === 'CUSTOMER' ? (
              <button
                onClick={handleCustomerAccept}
                disabled={busy || quote.state === 'CONFIRMED' || quote.state === 'FULFILLED'}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 font-display text-[13px] font-semibold
                           hover:shadow-lift-lg active:scale-[.98] disabled:opacity-40 flex items-center gap-2"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                <FileCheck size={16} />
                <span>{quote.state === 'CONFIRMED' ? 'Quotation Accepted' : 'Accept & Sign Quotation'}</span>
              </button>
            ) : (
              <button
                onClick={async () => {
                  setBusy(true)
                  try {
                    const res = await api.submit(quote.ref)
                    navigate(res.state === 'APPROVED' ? '/app/fulfilment' : '/app/approvals')
                  } catch (e: any) {
                    setError(`Could not submit (${e?.message ?? 'unknown error'}).`)
                  } finally { setBusy(false) }
                }}
                disabled={!editable || busy || (quote.lines ?? []).length === 0}
                title={
                  (quote.lines ?? []).length === 0 ? 'Add at least one product line first'
                  : !editable ? `Already ${quote.state.replace(/_/g, ' ').toLowerCase()}`
                  : isOverAllowance
                    ? 'Discounts exceed your allowance — will route to Bob Manager for approval'
                    : quote.risk_band === 'AUTO'
                    ? 'No approval needed — this will go straight to fulfilment'
                    : `Routes to ${quote.risk_band === 'FINANCE' ? 'Sales Manager, then Finance' : 'Sales Manager'}`
                }
                className={`rounded-full px-5 py-2.5 font-display text-[13px] font-semibold
                           hover:shadow-lift-lg active:scale-[.98]
                           disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none transition-all ${
                             isOverAllowance
                               ? 'bg-amber-600 hover:bg-amber-700 text-white'
                               : 'bg-fg text-white hover:bg-accent'
                           }`}
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                {isOverAllowance
                  ? 'Submit for Manager Approval'
                  : quote.risk_band === 'AUTO'
                  ? 'Confirm — within allowance'
                  : 'Submit for approval'}
              </button>
            )}
          </div>
        </header>

        {/* ── Rep Allowance Guardrail HUD (Visible to Sales Reps) ── */}
        {user.role === 'REP' && (
          <section className="rounded-2xl bg-surface border border-black/[.06] p-4 shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className={isOverAllowance ? 'text-amber-600' : 'text-emerald-600'} />
                <span className="font-display text-[13.5px] font-semibold text-fg">
                  Rep Delegated Authority Limits
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-fg-3">
                <span className="px-2 py-0.5 rounded bg-surface-2">HW: Max 15%</span>
                <span className="px-2 py-0.5 rounded bg-surface-2">SW: Max 20%</span>
                <span className="px-2 py-0.5 rounded bg-surface-2">Services: Max 10%</span>
                <span className="px-2 py-0.5 rounded bg-surface-2">Subs: Max 15%</span>
              </div>
            </div>

            {isOverAllowance ? (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12.5px] text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-700 shrink-0" />
                  <span>
                    <strong>Allowance Exceeded:</strong> One or more items exceed your delegated ceiling. Submission will automatically route to Sales Manager (Bob Manager).
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-amber-800 shrink-0">Escalation Required</span>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12.5px] text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>
                    <strong>Within Delegated Allowance:</strong> All product lines comply with your sales authority. Eligible for instant auto-confirmation.
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-emerald-800 shrink-0">Auto-Approve Ready</span>
              </div>
            )}
          </section>
        )}

        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">

          {/* ── LEFT: catalogue + cart ─────────────────────────────── */}
          <div className="flex flex-col gap-4 min-w-0">

            {/* Product catalogue (PS B3: pick products across categories) */}
            <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className="font-display text-[14px] font-semibold text-fg mr-1">Add products</h2>
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => { setCat(c); setSearch('') }}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                      cat === c && !search ? 'bg-fg text-white' : 'text-fg-2 bg-surface-2 hover:text-fg'
                    }`}
                    style={{ transition: `all 280ms ${EASE_CSS}` }}
                  >
                    {c}
                  </button>
                ))}
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search catalogue…"
                  className="ml-auto w-44 rounded-full bg-surface-2 px-3.5 py-1.5 text-[12.5px]
                             text-fg placeholder:text-fg-4 ring-1 ring-black/[.05]
                             focus:ring-accent/40 outline-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {catalogue.map(p => (
                  <button
                    key={p.sku}
                    onClick={() => apply(() => api.addLine(ref, p.sku, 1, 0))}
                    disabled={!editable || busy}
                    className="group text-left rounded-xl bg-surface-2/70 ring-1 ring-black/[.04] p-3
                               hover:ring-accent/35 hover:bg-surface disabled:opacity-40
                               disabled:cursor-not-allowed"
                    style={{ transition: `all 280ms ${EASE_CSS}` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-[13px] font-semibold text-fg leading-tight">
                        {p.name}
                      </span>
                      {p.is_promoted && (
                        <span className="shrink-0 rounded-full bg-band-managerWash text-band-manager
                                         px-1.5 py-0.5 font-mono text-[9px] font-semibold">PROMO</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-fg-3">{inr(p.list_price)}</span>
                      <span className="font-mono text-[10.5px] text-accent opacity-0 group-hover:opacity-100"
                            style={{ transition: `opacity 280ms ${EASE_CSS}` }}>
                        + Add
                      </span>
                    </div>
                    {p.is_recurring && (
                      <span className="mt-1 inline-block font-mono text-[9.5px] uppercase tracking-wider text-fg-3">
                        recurring
                      </span>
                    )}
                  </button>
                ))}
                {catalogue.length === 0 && (
                  <p className="col-span-full py-6 text-center text-[13px] text-fg-3">
                    No products match “{search}”.
                  </p>
                )}
              </div>
            </section>

            {/* Cart (PS B3: order lines, qty steppers, line discounts) */}
            <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <h2 className="font-display text-[14px] font-semibold text-fg">
                  Order lines <span className="text-fg-3 font-normal">({(quote.lines ?? []).length})</span>
                </h2>
                {flash && (
                  <span className="font-mono text-[11px] text-band-auto">{flash}</span>
                )}
              </div>

              {(quote.lines ?? []).length === 0 ? (
                <p className="px-4 py-12 text-center text-[13px] text-fg-3">
                  No lines yet. Add a product above to start building this quotation.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[720px]">
                    <thead>
                      <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                                     border-b border-line">
                        <th className="text-left font-medium px-4 py-2">Product</th>
                        <th className="text-center font-medium px-2 py-2 w-28">Qty</th>
                        <th className="text-center font-medium px-2 py-2 w-24">Disc %</th>
                        <th className="text-right font-medium px-2 py-2 w-28">Ceiling</th>
                        <th className="text-right font-medium px-4 py-2 w-32">Net</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {(quote.lines ?? []).map(l => {
                        const breach = l.over > 0
                        return (
                          <tr key={l.id} className="border-b border-line last:border-0">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-fg leading-tight">{l.name}</div>
                              <div className="font-mono text-[10.5px] text-fg-3 mt-0.5">
                                {l.sku} · {l.category} · {inr(l.list_price)}
                                {l.is_recurring && ' · recurring'}
                              </div>
                            </td>

                            {/* Quantity stepper (PS B3: adjust quantities +/-) */}
                            <td className="px-2 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => apply(() => api.patchLine(ref, l.id, { qty: l.qty - 1 }))}
                                  disabled={!editable || busy || l.qty <= 1}
                                  className="w-6 h-6 rounded-full bg-surface-2 text-fg-2 leading-none
                                             hover:bg-surface-3 disabled:opacity-30"
                                  aria-label={`Decrease ${l.name}`}
                                >−</button>
                                <span className="w-8 text-center font-mono tabular-nums text-fg">{l.qty}</span>
                                <button
                                  onClick={() => apply(() => api.patchLine(ref, l.id, { qty: l.qty + 1 }))}
                                  disabled={!editable || busy}
                                  className="w-6 h-6 rounded-full bg-surface-2 text-fg-2 leading-none
                                             hover:bg-surface-3 disabled:opacity-30"
                                  aria-label={`Increase ${l.name}`}
                                >+</button>
                              </div>
                            </td>

                            {/* Line-level discount */}
                            <td className="px-2 py-2.5">
                              <input
                                type="number" min={0} max={100} step={0.5}
                                value={l.discount_pct}
                                disabled={!editable || busy}
                                onChange={e => apply(() =>
                                  api.patchLine(ref, l.id, { discount_pct: Number(e.target.value) }))}
                                className={`w-full rounded-lg px-2 py-1 text-center font-mono tabular-nums
                                            ring-1 outline-none bg-surface disabled:opacity-40
                                            ${breach ? 'ring-band-finance/40 text-band-finance'
                                                     : 'ring-black/[.08] text-fg'}
                                            focus:ring-accent/45`}
                                aria-label={`Discount for ${l.name}`}
                              />
                            </td>

                            {/* Effective vs ceiling — the governance fact, per line */}
                            <td className="px-2 py-2.5 text-right font-mono tabular-nums">
                              <div className={breach ? 'text-band-finance font-semibold' : 'text-fg-3'}>
                                {l.effective_discount}% / {l.ceiling}%
                              </div>
                              {breach && (
                                <div className="text-[10px] text-band-finance mt-0.5">
                                  {l.over} pts over
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-2.5 text-right font-mono tabular-nums text-fg">
                              {inr(l.net)}
                            </td>
                            <td className="pr-3">
                              <button
                                onClick={() => apply(() => api.deleteLine(ref, l.id))}
                                disabled={!editable || busy}
                                className="w-6 h-6 rounded-full text-fg-4 hover:text-band-finance
                                           hover:bg-band-financeWash disabled:opacity-30"
                                aria-label={`Remove ${l.name}`}
                              >×</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Order-level discount + totals (PS B3) */}
              <div className="border-t border-line px-4 py-3 flex flex-wrap items-center gap-x-8 gap-y-3">
                <label className="flex items-center gap-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    Order-level discount
                  </span>
                  <input
                    type="number" min={0} max={100} step={0.5}
                    value={quote.order_discount_pct}
                    disabled={!editable || busy}
                    onChange={e => apply(() => api.setOrderDiscount(ref, Number(e.target.value)))}
                    className="w-20 rounded-lg bg-surface px-2 py-1 text-center font-mono tabular-nums
                               text-fg ring-1 ring-black/[.08] focus:ring-accent/45 outline-none
                               disabled:opacity-40"
                  />
                  <span className="text-[11.5px] text-fg-3">stacks on every line</span>
                </label>

                <div className="ml-auto flex items-center gap-7 font-mono text-[12px] tabular-nums">
                  <span className="text-fg-3">Subtotal <b className="text-fg-2 ml-1.5">{inr(quote.subtotal)}</b></span>
                  <span className="text-fg-3">Discount <b className="text-band-finance ml-1.5">−{inr(quote.discount_total)}</b></span>
                  <span className="text-fg-3">Tax <b className="text-fg-2 ml-1.5">{inr(quote.tax_total)}</b></span>
                  {quote.total_recurring > 0 && (
                    <span className="text-fg-3">Recurring <b className="text-fg-2 ml-1.5">{inr(quote.total_recurring)}</b></span>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* ── RIGHT: Customer Deal Room Card OR Internal Margin/Risk Intelligence ── */}
          <aside className="flex flex-col gap-4 xl:sticky xl:top-[72px]">
            {user.role === 'CUSTOMER' ? (
              /* Buyer Deal Room Summary (Strictly no internal margin/risk metrics) */
              <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    Corporate Deal Room
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Active Offer
                  </span>
                </div>

                <div>
                  <div className="text-[12px] text-fg-3 mb-1 font-mono uppercase tracking-wider">
                    Total Order Payable
                  </div>
                  <div className="font-display text-[32px] font-extrabold text-fg tabular-nums leading-none">
                    {inr(quote.total)}
                  </div>
                  {/* Report the discount actually applied to THIS order. The
                      previous copy asserted a flat "20% Gold Tier" figure that
                      the policy never grants (Gold caps at 15%) and that this
                      order may not carry at all. */}
                  <div className="text-[12px] text-fg-3 font-medium mt-1">
                    {quote.discount_total > 0
                      ? `Includes ${inr(quote.discount_total)} discount · ${quote.tier} tier`
                      : `List price · ${quote.tier} tier, no discount applied`}
                  </div>
                </div>

                <div className="space-y-2.5 py-3 border-y border-line text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Commercial Terms:</span>
                    <span className="font-medium text-fg">Net-30 Invoice</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Fulfillment Depot:</span>
                    <span className="font-medium text-fg">Main Warehouse Hub</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Delivery Lead Time:</span>
                    <span className="font-medium text-fg">2-3 Business Days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Account Executive:</span>
                    <span className="font-medium text-fg">Alice Sales</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleCustomerAccept}
                    disabled={busy || quote.state === 'CONFIRMED' || quote.state === 'FULFILLED'}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-display text-[13.5px] font-semibold shadow-lift flex items-center justify-center gap-2 active:scale-[.98] transition-all disabled:opacity-40"
                  >
                    <FileCheck size={16} />
                    <span>{quote.state === 'CONFIRMED' ? 'Quotation Accepted' : 'Accept & Sign Agreement'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setFlash('Official quotation PDF generated and downloaded.')
                      setTimeout(() => setFlash(null), 3000)
                    }}
                    className="w-full rounded-xl bg-surface-2 hover:bg-surface-3 text-fg-2 py-2.5 font-display text-[12.5px] font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <Download size={14} />
                    <span>Download Formal PDF</span>
                  </button>
                </div>
              </section>
            ) : (
              /* Internal Sales & Operations Margin Intelligence */
              <>
                <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-4 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                      Live margin
                    </span>
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${tone.text}`}>
                      {tone.label}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[30px] font-bold text-fg tabular-nums leading-none">
                        {quote.margin_pct}%
                      </span>
                      <span className="text-[12px] text-fg-3">after discount</span>
                    </div>
                    <div className="mt-2.5 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, quote.margin_pct))}%`,
                          background: tone.bar,
                          transition: `width 600ms ${EASE_CSS}, background 600ms ${EASE_CSS}`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="rule" />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mb-1.5">
                        Blended risk
                      </div>
                      <Band band={quote.risk_band} />
                    </div>
                    <span className="font-display text-[26px] font-bold text-fg tabular-nums leading-none">
                      {quote.risk_score.toFixed(1)}
                    </span>
                  </div>

                  {(quote.lines ?? []).length > 0 && (
                    <ContributionBar contributions={quote.contributions ?? {}} score={quote.risk_score} />
                  )}

                  <p className="text-[12.5px] leading-relaxed text-fg-2">{quote.narrative ?? ''}</p>

                  {(quote.notes ?? []).map(n => (
                    <p key={n} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11.5px] text-fg-2">
                      {n}
                    </p>
                  ))}

                  {/* Counterfactual coaching — only for reps to optimize discount */}
                  {user.role === 'REP' && coach?.available && (
                    <div className="rounded-xl bg-accent-wash ring-1 ring-accent/20 p-3">
                      <div className="font-mono text-[9.5px] uppercase tracking-eyebrow text-accent mb-1.5">
                        To skip approval
                      </div>
                      <p className="text-[12.5px] leading-snug text-fg">{coach.message}</p>
                      <button
                        onClick={() => apply(() =>
                          api.patchLine(ref, coach.line_index!, { discount_pct: coach.target_discount! }))}
                        disabled={!editable || busy}
                        className="mt-2 rounded-full bg-accent text-white px-3 py-1 font-display
                                   text-[11.5px] font-semibold hover:brightness-110 active:scale-[.98]
                                   disabled:opacity-40"
                        style={{ transition: `all 280ms ${EASE_CSS}` }}
                      >
                        Apply {coach.target_discount}%
                      </button>
                    </div>
                  )}
                </section>

                <div className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-4">
                  <UpsellPanel
                    suggestions={suggestions} basis={basis} filtered={filtered}
                    onAdd={addSuggestion} busy={!editable || busy}
                  />
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </Workspace>
  )
}
