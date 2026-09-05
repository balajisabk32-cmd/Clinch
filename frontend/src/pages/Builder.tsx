import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, request } from '../lib/authClient'
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
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { StockIndicator } from '../components/StockIndicator'
import { ErrorBar, Workspace } from '../components/Workspace'
import { UpsellPanel } from '../components/UpsellPanel'
import { EASE_CSS } from '../lib/motion'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'

const CATEGORIES = ['Hardware', 'Software', 'Services', 'Subscriptions'] as const

/**
 * Discount ceilings are the SERVER's, fetched from /policy.
 *
 * They used to be a hardcoded table here, and it had drifted: this file
 * promised reps 20% on Software and 15% on Subscriptions while the engine
 * enforced 15% and 12%. A rep would build what the screen called a compliant
 * quote and watch it escalate anyway — the worst kind of wrong, because the
 * tool actively misled the person following it.
 *
 * It also ignored tier. The effective ceiling is min(tier, category), so a
 * Gold customer caps at 14% no matter how generous the category is.
 */
interface PolicyShape {
  tier_ceiling: Record<string, number>
  category_ceiling: Record<string, number>
}

const ceilingFor = (policy: PolicyShape | null, tier: string, category: string) => {
  if (!policy) return null
  return Math.min(
    policy.tier_ceiling?.[tier] ?? 100,
    policy.category_ceiling?.[category] ?? 100,
  )
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
  const [cat, setCat] = useState<'All' | (typeof CATEGORIES)[number]>('All')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [policy, setPolicy] = useState<PolicyShape | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [revisionModalOpen, setRevisionModalOpen] = useState(false)
  const [revisionNote, setRevisionNote] = useState('')

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
      setBusy(false)
      // Refresh recommendations and coaching in background without blocking steppers
      Promise.all([
        api.recommend(q.ref).catch(() => null),
        api.coach(q.ref).catch(() => null),
      ]).then(([rec, co]) => {
        if (rec) { setSuggestions(rec.suggestions); setBasis(rec.basis); setFiltered(rec.filtered_by_margin_floor) }
        if (co) setCoach(co)
      })
      return q
    } catch (e: any) {
      setError(e?.message?.includes('409')
        ? 'This quotation is no longer editable — it has left Draft.'
        : `Could not update the quotation (${e?.message ?? 'unknown error'}).`)
      setBusy(false)
      return null
    }
  }, [])

  const load = useCallback(() => {
    if (!ref) return
    apply(() => api.quote(ref))
    api.products().then(setProducts).catch(() => setError('Product catalogue unavailable.'))
    api.policy().then(setPolicy).catch(() => { /* breach hints degrade quietly */ })
  }, [ref, apply])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  const editable = quote?.state === 'DRAFT' || quote?.state === 'NEGOTIATION'

  const catalogue = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return products.filter(p => {
      const matchSearch = !needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)
      const matchCat = cat === 'All' || p.category?.toLowerCase() === cat.toLowerCase()
      return matchSearch && matchCat
    })
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
    if (!quote?.lines || !policy) return []
    return quote.lines.filter(l => {
      const cap = ceilingFor(policy, quote.tier, l.category)
      return cap !== null && l.effective_discount > cap
    })
  }, [quote?.lines, quote?.tier, policy])

  // Identity comes from the verified session; localStorage is not an
  // authority on who anyone is.
  const { user } = useAuth()

  if (!quote) {
    return (
      <Workspace onReload={load}>
        {error ? <ErrorBar message={error} onRetry={load} />
               : <p className="text-[13px] text-fg-3">Loading quotation…</p>}
      </Workspace>
    )
  }

  const isOverAllowance = Boolean(quote?.risk_band && quote.risk_band !== 'AUTO')

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
      await request(`/approvals/${quote.ref}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, actor: user?.name }),
      })
      const label = action === 'approve' ? 'Approved'
                  : action === 'reject' ? 'Rejected' : 'Returned to Rep'
      setFlash(`Quotation ${quote.ref} ${label}.`)
      setTimeout(() => navigate('/app/approvals'), 1200)
    } catch (err) {
      // Previously this said "Manager governance action recorded." on ANY
      // failure -- including a 403 -- and then navigated away as if it had
      // worked. Say what actually happened and stay put.
      setFlash(err instanceof ApiError
        ? (err.status === 403
            ? 'Your role is not permitted to action this quotation.'
            : err.message)
        : 'Could not record that action.')
    } finally {
      setBusy(false)
    }
  }

  const sendRevision = async () => {
    if (!quote) return
    const note = revisionNote.trim()
    if (note.length < 10) return
    setBusy(true)
    try {
      await request(`/quotes/${quote.ref}/return-revision`, {
        method: 'POST',
        body: JSON.stringify({ manager_notes: note }),
      })
      setFlash(`Quotation ${quote.ref} returned to ${quote.rep} with revision notes.`)
      setRevisionModalOpen(false)
      setRevisionNote('')
      setTimeout(() => navigate('/app/approvals'), 1200)
    } catch (err) {
      setFlash(err instanceof ApiError
        ? (err.status === 403
            ? 'Your role is not permitted to return this quotation.'
            : err.message)
        : 'Could not return quotation.')
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
          <div className="flex items-center gap-2.5 rounded-xl bg-band-autoWash border border-band-auto/25 px-4 py-3 text-[13px] text-band-auto font-medium animate-fadeIn">
            <CheckCircle2 size={16} className="text-band-auto shrink-0" />
            <span>{flash}</span>
          </div>
        )}

        {/* ── Approval audit ───────────────────────────────────────────────
            Who signed this off, and when. The server stamps these from the
            approver's token, so the name here is the account that acted rather
            than a display string the client supplied. */}
        {quote.approved_by_name && (
          <div className="panel rail rail-auto px-4 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <ShieldCheck size={15} className="text-band-auto shrink-0" />
            <span className="text-[13px] text-fg">
              Approved by <b className="font-semibold">{quote.approved_by_name}</b>
              {quote.approved_by_role && (
                <span className="text-fg-2"> ({quote.approved_by_role})</span>
              )}
            </span>
            {quote.approved_at && (
              <span className="font-mono text-[11.5px] text-fg-3">
                on {new Date(quote.approved_at).toLocaleString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>
        )}

        {/* ── Returned for revision ────────────────────────────────────────
            The manager's note, verbatim and in full. This is the whole reason
            the deal is back on the rep's desk, so it is not truncated and not
            hidden behind a tooltip. */}
        {quote.revision_requested && quote.manager_revision_notes && (
          <div className="panel rail rail-manager px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-band-manager shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-display text-[13.5px] font-semibold text-band-manager">
                Returned for revision
              </div>
              <p className="text-[13px] text-fg mt-1 leading-relaxed">
                {quote.manager_revision_notes}
              </p>
              <p className="text-[11.5px] text-fg-3 mt-1.5">
                Make the change and submit again — it will re-route automatically.
              </p>
            </div>
          </div>
        )}

        {/* ── Manager Governance Top Bar (Only for Managers reviewing pending quotes) ── */}
        {user?.role === 'manager' && quote.state === 'PENDING_MANAGER' && (
          <div className="rounded-2xl bg-band-managerWash border border-band-manager/25 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-band-manager shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-band-manager">
                  Manager Action Required · Escalated by {quote.rep}
                </div>
                <div className="text-[12px] text-band-manager">
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
                className="inline-flex items-center gap-1.5 rounded-full bg-band-auto hover:brightness-110 text-white px-4 py-2 font-display text-[12.5px] font-semibold shadow-lift disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                <span>Approve Quotation</span>
              </button>
              <button
                onClick={() => handleManagerAction('reject')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface hover:bg-band-financeWash text-band-finance border border-band-finance px-3.5 py-2 font-display text-[12.5px] font-medium disabled:opacity-50"
              >
                <XCircle size={14} />
                <span>Reject</span>
              </button>
              <button
                onClick={() => { setRevisionModalOpen(true); setRevisionNote('') }}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface hover:bg-band-managerWash text-band-manager border border-band-manager px-3.5 py-2 font-display text-[12.5px] font-medium disabled:opacity-50"
              >
                <RotateCcw size={13} />
                <span>Request Rep Revision</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/app/quotations')}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-3 hover:text-accent transition-colors"
          >
            <span>←</span>
            <span>Back to All Quotations</span>
          </button>
        </div>

        {/* ── Quote header ──────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-[22px] font-bold text-fg leading-none">
                {user?.role === 'customer' ? 'Official Quotation' : quote.customer}
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
              <AnimatedNumber
                value={quote.total} format="inr" polarity="neutral"
                className="font-display text-[20px] font-bold text-fg leading-none"
              />
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mt-1">
                incl. tax
              </div>
            </div>

            {/* Role-specific Primary Action Button */}
            {user?.role === 'customer' ? (
              <button
                onClick={handleCustomerAccept}
                disabled={busy || quote.state === 'CONFIRMED' || quote.state === 'FULFILLED'}
                className="rounded-full bg-band-auto hover:brightness-110 text-white px-6 py-2.5 font-display text-[13px] font-semibold
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
                    const isApproved = res.state === 'APPROVED'
                    const msg = isApproved
                      ? `Quotation ${quote.ref} auto-approved! Redirecting to quotations…`
                      : `Quotation ${quote.ref} submitted for Manager approval! Redirecting to quotations…`
                    setFlash(msg)
                    setTimeout(() => {
                      navigate('/app/quotations', {
                        state: {
                          flash: isApproved
                            ? `Quotation ${quote.ref} auto-approved and released for confirmation.`
                            : `Quotation ${quote.ref} submitted successfully — now pending manager review.`,
                        },
                      })
                    }, 800)
                  } catch (e: any) {
                    setError(`Could not submit (${e?.message ?? 'unknown error'}).`)
                    setBusy(false)
                  }
                }}
                disabled={!editable || busy || (quote.lines ?? []).length === 0}
                title={
                  (quote.lines ?? []).length === 0 ? 'Add at least one product line first'
                  : !editable ? `Already ${quote.state.replace(/_/g, ' ').toLowerCase()}`
                  : quote.risk_band === 'FINANCE'
                  ? 'Routes to Sales Manager, then Finance for approval'
                  : quote.risk_band === 'MANAGER'
                  ? 'Discounts exceed auto-approval limit — routes for manager approval'
                  : 'No approval needed — this will go straight to fulfilment'
                }
                className={`rounded-full px-5 py-2.5 font-display text-[13px] font-semibold
                           hover:shadow-lift-lg active:scale-[.98]
                           disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none transition-all ${
                             quote.risk_band === 'FINANCE'
                               ? 'bg-band-finance hover:brightness-110 text-white'
                               : quote.risk_band === 'MANAGER'
                               ? 'bg-band-manager hover:brightness-110 text-white'
                               : 'bg-fg text-white hover:bg-accent'
                           }`}
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                {quote.risk_band === 'FINANCE'
                  ? 'Submit for Finance Approval'
                  : quote.risk_band === 'MANAGER'
                  ? 'Submit for Manager Approval'
                  : 'Confirm — Auto-Approved'}
              </button>
            )}
          </div>
        </header>

        {/* ── Rep Allowance Guardrail HUD (Visible to Sales Reps) ── */}
        {user?.role === 'rep' && (
          <section className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  size={16}
                  className={
                    quote.risk_band === 'FINANCE'
                      ? 'text-band-finance'
                      : quote.risk_band === 'MANAGER'
                      ? 'text-band-manager'
                      : 'text-band-auto'
                  }
                />
                <span className="font-display text-[13.5px] font-semibold text-fg">
                  Rep Delegated Authority Limits
                </span>
              </div>
              {/* The ceilings that bind THIS quotation, from /policy.
                  These were four hardcoded chips reading 15/20/10/15. Two were
                  simply wrong against the engine (software caps at 15, subs at
                  12), and all four ignored the tier — which is very often the
                  binding one: on a Bronze account every category caps at 5%
                  regardless of what the category allows. A rep reading the old
                  strip on a Bronze deal was told 15% and escalated at 5%. */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-fg-3">
                {policy ? CATEGORIES.map(c => {
                  const cap = ceilingFor(policy, quote.tier, c)
                  const bound = cap !== null
                    && (policy.tier_ceiling?.[quote.tier] ?? 100)
                       <= (policy.category_ceiling?.[c] ?? 100)
                  return (
                    <span key={c}
                          className={`px-2 py-0.5 rounded ${
                            bound ? 'bg-band-managerWash text-band-manager' : 'bg-surface-2'}`}
                          title={bound
                            ? `${quote.tier} tier caps this below the ${c} ceiling`
                            : `${c} category ceiling`}>
                      {c.slice(0, 4)}: max {cap}%
                    </span>
                  )
                }) : (
                  <span className="px-2 py-0.5 rounded bg-surface-2">loading ceilings…</span>
                )}
                {policy && (
                  <span className="text-fg-4">
                    · {quote.tier} tier caps at {policy.tier_ceiling?.[quote.tier]}%
                  </span>
                )}
              </div>
            </div>

            {quote.risk_band === 'FINANCE' ? (
              <div className="rounded-xl bg-band-financeWash border border-band-finance/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12.5px] text-band-finance">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-band-finance shrink-0" />
                  <span>
                    <strong>Finance Clearance Required:</strong> High risk score ({quote.risk_score}) or severe discount breach. Requires second-level Finance approval.
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-band-finance shrink-0">Finance Escalation</span>
              </div>
            ) : quote.risk_band === 'MANAGER' ? (
              <div className="rounded-xl bg-band-managerWash border border-band-manager/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12.5px] text-band-manager">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-band-manager shrink-0" />
                  <span>
                    <strong>Manager Approval Required:</strong> Risk score ({quote.risk_score}) exceeds auto-approval threshold. Submission will route to your sales manager.
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-band-manager shrink-0">Escalation Required</span>
              </div>
            ) : repBreaches.length > 0 ? (
              <div className="rounded-xl bg-band-autoWash border border-band-auto/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12.5px] text-band-auto">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-band-auto shrink-0" />
                  <span>
                    <strong>Within Blended Risk Tolerance:</strong> Minor line overage ({repBreaches.map(b => `${b.name}: ${b.effective_discount}%`).join(', ')}), but total risk score ({quote.risk_score}) is within auto-approval threshold. <strong>No manager sign-off needed.</strong>
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-band-auto shrink-0">Auto-Approve Ready</span>
              </div>
            ) : (
              <div className="rounded-xl bg-band-autoWash border border-band-auto/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12.5px] text-band-auto">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-band-auto shrink-0" />
                  <span>
                    <strong>Within Delegated Allowance:</strong> All product lines comply with your sales authority. Eligible for instant auto-confirmation.
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-band-auto shrink-0">Auto-Approve Ready</span>
              </div>
            )}
          </section>
        )}

        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">

          {/* ── LEFT: catalogue + cart ─────────────────────────────── */}
          <div className="flex flex-col gap-4 min-w-0">

            {/* Product catalogue (PS B3: pick products across categories) */}
            <section className="panel p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className="font-display text-[14px] font-semibold text-fg mr-1">Add products</h2>
                {(['All', ...CATEGORIES] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => { setCat(c); setSearch('') }}
                    className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium
                      transition-colors duration-150 ${
                      cat === c && !search
                        ? 'bg-fg text-white'
                        : 'text-fg-3 bg-surface-2 hover:text-fg'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search catalogue…"
                  className="ml-auto w-48 rounded-md bg-surface px-2.5 py-1.5 text-[12px]
                             text-fg placeholder:text-fg-4 ring-1 ring-black/[.08]
                             focus:ring-accent/45 outline-none"
                />
              </div>

              {/* Dense catalogue.
                  Previously a three-column grid of padded cards: fourteen
                  products filled the viewport and the price — the field a rep
                  scans for — sat at fg-3 on a tinted card, the lowest-contrast
                  text on screen. A rep picking lines wants a price list, so
                  this is one: hairline rows, price right-aligned and tabular,
                  category readable, and the whole catalogue visible at once. */}
              <div className="scroll-x max-h-[340px] overflow-y-auto -mx-4 -mb-4 mt-1">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th className="text-right">List price</th>
                      <th className="text-center w-28">In quote</th>
                      <th className="w-16 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogue.map(p => {
                      const line = quote.lines?.find(l => l.sku === p.sku)
                      const inQuoteQty = line?.qty ?? 0
                      return (
                        <tr
                          key={p.sku}
                          onClick={() => {
                            if (!editable || busy) return
                            if (line) {
                              apply(() => api.patchLine(ref, line.id, { qty: line.qty + 1 }))
                            } else {
                              apply(() => api.addLine(ref, p.sku, 1, 0))
                            }
                          }}
                          className={cn(
                            editable && !busy ? 'cursor-pointer group' : 'opacity-45 cursor-not-allowed',
                            inQuoteQty > 0 && 'bg-accent/[0.04]'
                          )}
                        >
                          <td className="text-fg font-medium">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span>{p.name}</span>
                              {p.is_promoted && (
                                <span className="ml-1.5 rounded-sm bg-band-managerWash text-band-manager
                                                 px-1 py-px font-mono text-[9px] font-semibold align-middle">
                                  PROMO
                                </span>
                              )}
                              {p.is_recurring && (
                                <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-fg-4">
                                  recurring
                                </span>
                              )}
                              {inQuoteQty > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                  Qty: {inQuoteQty}
                                </span>
                              )}
                            </div>
                          </td>
                          <td><span className="key text-fg-3">{p.sku}</span></td>
                          <td className="text-fg-3">{p.category}</td>
                          <td className="num text-fg-2">
                            <AnimatedNumber value={p.list_price} format="inr" flash={false} />
                          </td>
                          <td className="text-center" onClick={e => e.stopPropagation()}>
                            {inQuoteQty > 0 ? (
                              <div className="inline-flex items-center gap-1 bg-surface-2 border border-black/[.08] rounded-md px-1.5 py-0.5 shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!editable || busy || !line) return
                                    if (line.qty > 1) {
                                      apply(() => api.patchLine(ref, line.id, { qty: line.qty - 1 }))
                                    } else {
                                      apply(() => api.deleteLine(ref, line.id))
                                    }
                                  }}
                                  disabled={!editable || busy}
                                  title="Decrease quantity"
                                  className="w-5 h-5 rounded hover:bg-surface-3 text-fg-2 hover:text-fg font-mono text-[11px] font-bold flex items-center justify-center transition-colors disabled:opacity-40"
                                >
                                  -
                                </button>
                                <span className="font-mono text-[11.5px] font-bold text-accent px-1 min-w-[20px] text-center">
                                  {inQuoteQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!editable || busy || !line) return
                                    apply(() => api.patchLine(ref, line.id, { qty: line.qty + 1 }))
                                  }}
                                  disabled={!editable || busy}
                                  title="Increase quantity"
                                  className="w-5 h-5 rounded hover:bg-surface-3 text-fg-2 hover:text-fg font-mono text-[11px] font-bold flex items-center justify-center transition-colors disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span className="font-mono text-[11px] text-fg-4">—</span>
                            )}
                          </td>
                          <td className="text-right">
                            {inQuoteQty > 0 ? (
                              <span className="font-mono text-[11px] text-accent font-semibold">
                                + Add
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] text-accent opacity-0
                                               group-hover:opacity-100 transition-opacity">
                                + Add
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {catalogue.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[12.5px] text-fg-3">
                          No products match “{search}”.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Cart (PS B3: order lines, qty steppers, line discounts) */}
            <section className="panel">
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
                              {/* Live ATP at the quantity on this line. A
                                  subscription has no shelf, so it gets none. */}
                              {!l.is_recurring && (
                                <StockIndicator sku={l.sku} qty={l.qty} className="mt-1" />
                              )}
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
                  <span className="text-fg-3">Subtotal <AnimatedNumber value={quote.subtotal} format="inr" flash={false} className="text-fg-2 ml-1.5 font-semibold" /></span>
                  <span className="text-fg-3">Discount <AnimatedNumber value={quote.discount_total} format="inr" prefix="−" polarity="lower-better" className="text-band-finance ml-1.5 font-semibold" /></span>
                  <span className="text-fg-3">Tax <AnimatedNumber value={quote.tax_total} format="inr" flash={false} className="text-fg-2 ml-1.5 font-semibold" /></span>
                  {quote.total_recurring > 0 && (
                    <span className="text-fg-3">Recurring <AnimatedNumber value={quote.total_recurring} format="inr" flash={false} className="text-fg-2 ml-1.5 font-semibold" /></span>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* ── RIGHT: Customer Deal Room Card OR Internal Margin/Risk Intelligence ── */}
          <aside className="flex flex-col gap-4 xl:sticky xl:top-[72px]">
            {user?.role === 'customer' ? (
              /* Buyer Deal Room Summary (Strictly no internal margin/risk metrics) */
              <section className="panel p-4 flex flex-col gap-3.5">
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    Corporate Deal Room
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-band-auto bg-band-autoWash px-2 py-0.5 rounded-full">
                    Active Offer
                  </span>
                </div>

                <div>
                  <div className="text-[12px] text-fg-3 mb-1 font-mono uppercase tracking-wider">
                    Total Order Payable
                  </div>
                  <AnimatedNumber
                    value={quote.total} format="inr"
                    className="font-display text-[28px] font-extrabold text-fg leading-none"
                  />
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

                {/* Only facts this quotation actually carries. The previous
                    version stated a "Main Warehouse Hub", a "2-3 Business Days"
                    lead time and an account executive called "Alice Sales" —
                    none of which exist in the system. Allocation decides the
                    depot, and it has not run at quotation time, so the honest
                    answer is to say so rather than to invent one. */}
                <div className="space-y-2.5 py-3 border-y border-line text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Reference</span>
                    <span className="key text-fg">{quote.ref}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Pricing tier</span>
                    <span className="font-medium text-fg">{quote.tier}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Account executive</span>
                    <span className="font-medium text-fg">{quote.rep}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Fulfilment depot</span>
                    <span className="text-fg-3 italic">Assigned on confirmation</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleCustomerAccept}
                    disabled={busy || quote.state === 'CONFIRMED' || quote.state === 'FULFILLED'}
                    className="w-full rounded-xl bg-band-auto hover:brightness-110 text-white py-3 font-display text-[13.5px] font-semibold shadow-lift flex items-center justify-center gap-2 active:scale-[.98] transition-all disabled:opacity-40"
                  >
                    <FileCheck size={16} />
                    <span>{quote.state === 'CONFIRMED' ? 'Quotation Accepted' : 'Accept & Sign Agreement'}</span>
                  </button>

                  <button
                    // Really prints. This previously flashed "PDF generated and
                    // downloaded" and produced no file at all; the print
                    // stylesheet in index.css is what makes the output usable.
                    onClick={() => window.print()}
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
                <section className="panel p-4 flex flex-col gap-3.5">
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
                      <AnimatedNumber
                        value={quote.margin_pct} format="pct" precision={1}
                        polarity="higher-better"
                        className="font-display text-[26px] font-bold text-fg leading-none"
                      />
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
                    <AnimatedNumber
                      value={quote.risk_score} format="dec" precision={1}
                      polarity="lower-better"
                      className="font-display text-[24px] font-bold text-fg leading-none"
                    />
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
                  {user?.role === 'rep' && coach?.available && (
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

                <div className="panel p-4">
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
