import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Send } from 'lucide-react'
import { ApiError, shopApi, type ShopQuote } from '../lib/authClient'
import { ShopShell } from '../components/ShopShell'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { cn } from '../lib/cn'

/**
 * One quotation, and the negotiation on it.
 *
 * The discount request posts to the SAME engine the token portal uses: the
 * counter is re-scored as if accepted and, if it breaks a threshold, the
 * quotation re-enters approval automatically. The customer is told that this is
 * what will happen, because a request that silently vanishes into a queue is
 * how buyers end up phoning their rep to ask what happened.
 */

const STATUS_TONE: Record<string, string> = {
  'Confirmed':                     'bg-band-autoWash text-band-auto ring-band-auto/25',
  'Under Negotiation':             'bg-band-managerWash text-band-manager ring-band-manager/25',
  'Awaiting your account manager': 'bg-surface-2 text-fg-2 ring-black/[.08]',
  'Draft':                         'bg-surface-2 text-fg-3 ring-black/[.08]',
  'Declined':                      'bg-band-financeWash text-band-finance ring-band-finance/25',
  'Ready for your review':         'bg-accent-wash text-accent ring-accent/25',
}

export default function MyQuotationDetail() {
  const { ref = '' } = useParams()
  const location = useLocation() as { state?: { justRequested?: boolean; rep?: string } }
  const [q, setQ] = useState<ShopQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [discount, setDiscount] = useState('')
  const [lineId, setLineId] = useState<string>('all')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    shopApi.quote(ref).then(d => { setQ(d); setError(null) })
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load that quotation.'))
  }, [ref])
  useEffect(load, [load])

  useEffect(() => {
    if (location.state?.justRequested) {
      setNotice(`Request sent${location.state.rep ? ` to ${location.state.rep}` : ''}. `
                + 'You will see a priced quotation here once it has been reviewed.')
    }
  }, [location.state])

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const pct = discount.trim() === '' ? null : Number(discount)
      if (pct !== null && (!Number.isFinite(pct) || pct <= 0 || pct > 100)) {
        setError('Enter a discount between 0 and 100, or leave it blank to send a comment only.')
        setBusy(false)
        return
      }
      if (pct === null && !comment.trim()) {
        setError('Add a comment or a requested discount.')
        setBusy(false)
        return
      }
      const res = await shopApi.negotiate(ref, {
        line_id: lineId === 'all' ? null : Number(lineId),
        counter_discount_pct: pct,
        comment: comment.trim() || undefined,
      })
      setDiscount('')
      setComment('')
      setNotice(
        res?.re_entered
          ? 'Sent. Because that rate is above your account manager’s own limit, the '
            + 'quotation has gone for approval automatically — no one has to resubmit it.'
          : 'Sent to your account manager.',
      )
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send your request.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !q) {
    return (
      <ShopShell>
        <div className="py-20 text-center">
          <p className="text-[14px] text-band-finance">{error}</p>
          <Link to="/my/quotations" className="mt-3 inline-block text-[13px] text-accent hover:underline">
            Back to my quotations
          </Link>
        </div>
      </ShopShell>
    )
  }
  if (!q) {
    return <ShopShell><p className="py-20 text-center text-[13px] text-fg-3">Loading…</p></ShopShell>
  }

  return (
    <ShopShell>
      <div className="flex flex-col gap-6 max-w-[880px]">
        <Link to="/my/quotations"
              className="self-start inline-flex items-center gap-1.5 text-[12.5px] text-fg-3
                         hover:text-accent transition-colors">
          <ArrowLeft size={13} /> My quotations
        </Link>

        <div className="flex flex-wrap items-start gap-4">
          <div>
            <h1 className="font-display text-[32px] font-bold text-fg tracking-tight leading-[1.1]">
              Quotation {q.ref}
            </h1>
            <p className="text-[13.5px] text-fg-2 mt-2">Prepared for {q.customer}</p>
          </div>
          <span className={cn(
            'ml-auto rounded-full ring-1 px-3.5 py-1.5 font-mono text-[11px] font-semibold',
            STATUS_TONE[q.status] ?? 'bg-surface-2 text-fg-2 ring-black/[.08]',
          )}>
            {q.status}
          </span>
        </div>

        {notice && (
          <div className="rounded-xl bg-accent-wash ring-1 ring-accent/25 px-4 py-3
                          text-[13px] text-fg leading-relaxed">{notice}</div>
        )}
        {error && (
          <div role="alert" className="rounded-xl bg-band-financeWash ring-1 ring-band-finance/20
                                       px-4 py-3 text-[13px] text-band-finance">{error}</div>
        )}

        {q.lines.length === 0 ? (
          <div className="bezel">
            <div className="bezel-core px-6 py-12 text-center">
              <p className="text-[14px] text-fg-2">
                Your account manager is preparing this quotation.
              </p>
              <p className="text-[12.5px] text-fg-3 mt-1.5">
                Priced lines will appear here once they have reviewed your request.
              </p>
            </div>
          </div>
        ) : (
          <section className="bezel">
            <div className="bezel-core overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[14px] min-w-[560px]">
                  <thead>
                    <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                                   border-b border-line">
                      <th className="text-left font-medium px-6 py-4">Item</th>
                      <th className="text-right font-medium px-4 py-4 w-20">Qty</th>
                      <th className="text-right font-medium px-4 py-4 w-32">Unit price</th>
                      <th className="text-right font-medium px-4 py-4 w-24">Discount</th>
                      <th className="text-right font-medium px-6 py-4 w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.lines.map(l => (
                      <tr key={l.id} className="border-b border-line last:border-0">
                        <td className="px-6 py-4">
                          <div className="text-fg font-medium">{l.name}</div>
                          <div className="font-mono text-[10.5px] text-fg-3 mt-0.5">{l.category}</div>
                        </td>
                        <td className="px-4 py-4 text-right font-mono tabular-nums text-fg-2">
                          {l.qty}
                        </td>
                        <td className="px-4 py-4 text-right font-mono tabular-nums text-fg-2">
                          ₹{l.unit_price.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-4 text-right font-mono tabular-nums text-fg-2">
                          {l.discount_pct > 0 ? `${l.discount_pct}%` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <AnimatedNumber value={l.line_total} format="inr"
                                          className="font-semibold text-fg" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-line px-6 py-5 flex flex-col items-end gap-2
                              font-mono text-[13px] tabular-nums">
                <span className="text-fg-3 flex items-baseline">
                  Subtotal
                  <AnimatedNumber value={q.subtotal} format="inr" flash={false}
                                  className="ml-3 text-fg-2 font-semibold" />
                </span>
                <span className="text-fg-3 flex items-baseline">
                  Discount
                  <AnimatedNumber value={q.discount_total} format="inr" prefix="−"
                                  polarity="higher-better"
                                  className="ml-3 text-band-auto font-semibold" />
                </span>
                <span className="text-fg-3 flex items-baseline">
                  Tax
                  <AnimatedNumber value={q.tax_total} format="inr" flash={false}
                                  className="ml-3 text-fg-2 font-semibold" />
                </span>
                <span className="text-[20px] text-fg font-semibold mt-2 flex items-baseline">
                  Total
                  <AnimatedNumber value={q.total} format="inr"
                                  className="ml-3 text-[20px] font-semibold" />
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Conversation so far */}
        {q.comments.length > 0 && (
          <section className="rounded-2xl bg-surface ring-1 ring-black/[.06] p-5 flex flex-col gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3
                           inline-flex items-center gap-1.5">
              <MessageSquare size={12} /> Conversation
            </h2>
            {q.comments.map((c, i) => (
              <div key={i} className="rounded-xl bg-surface-2 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] font-semibold text-fg">{c.author}</span>
                  <span className="font-mono text-[10.5px] text-fg-3">{c.created_at}</span>
                </div>
                {c.body && <p className="text-[13px] text-fg-2 mt-1 leading-relaxed">{c.body}</p>}
                {c.counter_discount_pct != null && (
                  <p className="mt-1.5 font-mono text-[11.5px] text-band-manager">
                    Requested {c.counter_discount_pct}%
                    {c.line_id != null ? ` on line ${c.line_id + 1}` : ' across the order'}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Ask for a better price */}
        {q.can_negotiate && q.lines.length > 0 && (
          <section className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift
                              p-5 flex flex-col gap-4">
            <div>
              <h2 className="font-display text-[16px] font-semibold text-fg">
                Ask for a better price
              </h2>
              <p className="text-[12.5px] text-fg-3 mt-1 leading-relaxed">
                Your request goes straight to your account manager. If the rate you ask for
                is above what they can approve themselves, it is escalated automatically —
                you do not need to chase anyone.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Applies to
                </span>
                <select
                  value={lineId}
                  onChange={e => setLineId(e.target.value)}
                  className="rounded-lg bg-surface px-3 py-2.5 text-[13px] text-fg
                             ring-1 ring-black/[.08] outline-none focus:ring-accent/45"
                >
                  <option value="all">The whole order</option>
                  {q.lines.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Discount you are asking for (%)
                </span>
                <input
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 20"
                  className="rounded-lg bg-surface px-3 py-2.5 text-[13px] text-fg font-mono
                             ring-1 ring-black/[.08] outline-none focus:ring-accent/45
                             placeholder:text-fg-4 placeholder:font-sans"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                Message
              </span>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="Can we improve the rate on the setup service?"
                className="rounded-lg bg-surface px-3 py-2.5 text-[13px] text-fg resize-y
                           ring-1 ring-black/[.08] outline-none focus:ring-accent/45
                           placeholder:text-fg-4"
              />
            </label>

            <button
              onClick={send}
              disabled={busy}
              className="self-start inline-flex items-center gap-2 rounded-full bg-fg text-white
                         px-5 py-2.5 font-display text-[13px] font-semibold
                         hover:shadow-lift-lg active:scale-[.98]
                         disabled:opacity-45 disabled:cursor-not-allowed transition-all"
            >
              {busy ? 'Sending…' : <>Send to my account manager <Send size={14} /></>}
            </button>
          </section>
        )}
      </div>
    </ShopShell>
  )
}
