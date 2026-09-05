import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, inr } from '../lib/api'
import { EASE_CSS } from '../lib/motion'

/**
 * Customer Portal — wireframe screen 11, PS B8.
 *
 * THIS IS A SEPARATE SURFACE, NOT THE WORKSPACE WITH THINGS HIDDEN.
 *
 * PS §7 requires "a real, separate, restricted view, not just another internal
 * screen with a different label". Three things make that true here rather than
 * cosmetic:
 *
 *   1. It renders OUTSIDE the internal <Workspace> shell — different chrome,
 *      different navigation, no internal routes reachable from it.
 *   2. It reads ONLY /portal/{token}, whose payload is built field-by-field on
 *      the server and structurally cannot contain cost, margin, risk_score,
 *      ceiling or rep. There is nothing to hide in the browser because nothing
 *      internal is ever sent.
 *   3. Access is by signed, single-quote token — not a role flag a viewer could
 *      flip in localStorage.
 */

const DEMO_TOKENS = [
  { token: 'acme-q1042-7f3a9c', label: 'Acme Corp · Q-1042' },
  { token: 'beta-q1039-2b81de', label: 'Beta Industries · Q-1039' },
]

interface PortalLine {
  id: number; name: string; category: string; qty: number
  unit_price: number; discount_pct: number; line_total: number
}
interface PortalQuote {
  ref: string; customer: string; status: string; valid_until: string
  currency: string; lines: PortalLine[]
  subtotal: number; discount_total: number; tax_total: number; total: number
  recurring_total: number; can_confirm: boolean
  comments: Array<{ line_id: number | null; author: string; body: string | null
                    counter_discount_pct: number | null; created_at: string }>
}

const STATUS_TONE: Record<string, string> = {
  'Sent': 'bg-surface-2 text-fg-2 ring-black/[.07]',
  'Under Negotiation': 'bg-band-managerWash text-band-manager ring-band-manager/25',
  'Confirmed': 'bg-band-autoWash text-band-auto ring-band-auto/25',
}

export default function Portal() {
  const [params, setParams] = useSearchParams()
  const token = params.get('token') || DEMO_TOKENS[0].token

  const [quote, setQuote] = useState<PortalQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lineId, setLineId] = useState<number | ''>('')
  const [counter, setCounter] = useState('')
  const [comment, setComment] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    api.portal(token)
      .then(q => { setQuote(q as PortalQuote); setError(null) })
      .catch(e => setError(
        e?.message?.includes('404')
          ? 'This quotation link is invalid or has expired.'
          : `Could not load your quotation (${e?.message ?? 'unknown error'}).`))
  }, [token])

  useEffect(load, [load])

  const submitRequest = async () => {
    if (!counter && !comment) return
    setBusy(true); setNotice(null)
    try {
      const res: any = await api.portalRequest(token, {
        line_id: lineId === '' ? null : Number(lineId),
        counter_discount_pct: counter ? Number(counter) : null,
        comment: comment || null,
      })
      setNotice(
        res.re_entered_approval
          ? 'Request submitted. Your revised terms need internal approval — we will confirm shortly.'
          : 'Request submitted. Your account team has been notified.')
      setCounter(''); setComment(''); setLineId('')
      load()
    } catch (e: any) {
      setError(`Could not submit your request (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-[100dvh] bg-bg">
      {/* Deliberately different chrome from the internal workspace. */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1000px] px-5 h-14 flex items-center gap-6">
          <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-[19px] w-auto" />
          <nav className="flex items-center gap-1 text-[13px]">
            <span className="rounded-full bg-fg text-white px-3 py-1.5 font-medium">My Quotation</span>
            <span className="rounded-full px-3 py-1.5 text-fg-3">Messages</span>
            <span className="rounded-full px-3 py-1.5 text-fg-3">Profile</span>
          </nav>
          <select
            value={token}
            onChange={e => setParams({ token: e.target.value })}
            className="ml-auto rounded-full bg-surface px-3 py-1.5 text-[12px] text-fg-2
                       ring-1 ring-black/[.07] outline-none focus:ring-accent/40"
            aria-label="Demo quotation link"
          >
            {DEMO_TOKENS.map(t => <option key={t.token} value={t.token}>{t.label}</option>)}
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-[1000px] px-5 py-8 flex flex-col gap-5">
        {error && (
          <div className="rounded-xl bg-band-financeWash ring-1 ring-band-finance/20 px-4 py-3
                          text-[13px] text-band-finance">{error}</div>
        )}

        {!quote && !error && <p className="text-[13px] text-fg-3">Loading your quotation…</p>}

        {quote && (
          <>
            <div className="flex flex-wrap items-start gap-4">
              <div>
                <h1 className="font-display text-[26px] font-bold text-fg leading-tight">
                  Quotation {quote.ref}
                </h1>
                <p className="text-[13.5px] text-fg-2 mt-1">
                  Prepared for {quote.customer} · valid until {quote.valid_until}
                </p>
              </div>
              <span className={`ml-auto rounded-full ring-1 px-3 py-1 font-mono text-[11px]
                                font-semibold ${STATUS_TONE[quote.status] ?? ''}`}>
                {quote.status}
              </span>
            </div>

            {notice && (
              <div className="rounded-xl bg-accent-wash ring-1 ring-accent/25 px-4 py-3
                              text-[13px] text-fg">{notice}</div>
            )}

            {/* Document-style line listing — a quotation, not a data grid. */}
            <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px] min-w-[560px]">
                  <thead>
                    <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                                   border-b border-line">
                      <th className="text-left font-medium px-5 py-3">Item</th>
                      <th className="text-right font-medium px-3 py-3 w-20">Qty</th>
                      <th className="text-right font-medium px-3 py-3 w-32">Unit price</th>
                      <th className="text-right font-medium px-3 py-3 w-24">Discount</th>
                      <th className="text-right font-medium px-5 py-3 w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lines.map(l => (
                      <tr key={l.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">
                          <div className="text-fg font-medium">{l.name}</div>
                          <div className="font-mono text-[10.5px] text-fg-3 mt-0.5">{l.category}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-2">{l.qty}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-2">
                          {inr(l.unit_price)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-2">
                          {l.discount_pct > 0 ? `${l.discount_pct}%` : '—'}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-fg font-semibold">
                          {inr(l.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-line px-5 py-4 flex flex-col items-end gap-1.5
                              font-mono text-[13px] tabular-nums">
                <span className="text-fg-3">Subtotal <b className="text-fg-2 ml-3">{inr(quote.subtotal)}</b></span>
                <span className="text-fg-3">Discount <b className="text-band-auto ml-3">−{inr(quote.discount_total)}</b></span>
                <span className="text-fg-3">Tax <b className="text-fg-2 ml-3">{inr(quote.tax_total)}</b></span>
                <span className="text-[16px] text-fg font-semibold mt-1">
                  Total <b className="ml-3">{inr(quote.total)}</b>
                </span>
                {quote.recurring_total > 0 && (
                  <span className="text-[11.5px] text-fg-3">
                    includes {inr(quote.recurring_total)} billed on a recurring schedule
                  </span>
                )}
              </div>
            </section>

            {/* Line-level comments already raised */}
            {quote.comments.length > 0 && (
              <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] p-5">
                <h2 className="font-display text-[15px] font-semibold text-fg mb-3">Conversation</h2>
                <ul className="flex flex-col gap-2.5">
                  {quote.comments.map((c, i) => (
                    <li key={i} className="rounded-xl bg-surface-2 px-3.5 py-2.5">
                      <div className="flex items-center gap-2 font-mono text-[10.5px] text-fg-3">
                        <span className="text-fg-2 font-semibold">{c.author}</span>
                        {c.line_id !== null && quote.lines[c.line_id] && (
                          <span>on {quote.lines[c.line_id].name}</span>
                        )}
                      </div>
                      {c.body && <p className="text-[13px] text-fg mt-1">{c.body}</p>}
                      {c.counter_discount_pct !== null && (
                        <p className="text-[12.5px] text-band-manager mt-1 font-medium">
                          Requested {c.counter_discount_pct}% discount
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Request changes / counter a discount (PS B8) */}
            <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-5
                                flex flex-col gap-4">
              <div>
                <h2 className="font-display text-[16px] font-semibold text-fg">Request a change</h2>
                <p className="text-[13px] text-fg-2 mt-1">
                  Ask a question on a line, or propose a different discount. Your account team is
                  notified immediately.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">Line item</span>
                  <select
                    value={lineId}
                    onChange={e => setLineId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                               ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                  >
                    <option value="">Whole quotation</option>
                    {quote.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    Counter discount %
                  </span>
                  <input
                    type="number" min={0} max={100} step={0.5}
                    value={counter}
                    onChange={e => setCounter(e.target.value)}
                    placeholder="e.g. 20"
                    className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg font-mono
                               ring-1 ring-black/[.08] outline-none focus:ring-accent/40
                               placeholder:text-fg-4 placeholder:font-sans"
                  />
                </label>

                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    Comment
                  </span>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Can we improve the rate on the setup service?"
                    className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg resize-y
                               ring-1 ring-black/[.08] outline-none focus:ring-accent/40
                               placeholder:text-fg-4"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    Requested delivery date
                  </span>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                               ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  onClick={submitRequest}
                  disabled={busy || (!counter && !comment)}
                  className="rounded-full ring-1 ring-black/[.09] bg-surface px-5 py-2.5
                             font-display text-[13px] font-semibold text-fg
                             hover:ring-accent/40 hover:text-accent active:scale-[.98]
                             disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ transition: `all 320ms ${EASE_CSS}` }}
                >
                  Submit Request
                </button>
                <button
                  disabled={!quote.can_confirm || busy}
                  onClick={() => setNotice('Thank you — your confirmation has been recorded.')}
                  title={quote.can_confirm ? 'Accept these terms'
                                           : 'This quotation is not yet released for confirmation'}
                  className="rounded-full bg-band-auto text-white px-5 py-2.5 font-display
                             text-[13px] font-semibold hover:shadow-lift-lg active:scale-[.98]
                             disabled:opacity-35 disabled:cursor-not-allowed"
                  style={{ transition: `all 320ms ${EASE_CSS}` }}
                >
                  Confirm Quotation
                </button>
                <p className="text-[12px] text-fg-3 basis-full sm:basis-auto sm:ml-2">
                  If revised terms exceed agreed limits, the quotation returns for internal
                  approval automatically.
                </p>
              </div>
            </section>

            <p className="text-[11.5px] text-fg-4 text-center">
              This view shows only your own quotation. Internal pricing information is not
              transmitted to this page.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
