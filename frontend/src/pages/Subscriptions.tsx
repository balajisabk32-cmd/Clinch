import { useCallback, useEffect, useState } from 'react'
import { api, inr } from '../lib/api'
import { ErrorBar, Workspace } from '../components/Workspace'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { EASE_CSS } from '../lib/motion'

/**
 * Subscriptions & Billing — wireframe screens 9 and 10, PS A5/B7.
 *
 * The list and the billing detail sit side by side so a mid-cycle change and
 * its proration are visible in one view.
 *
 * The proration arithmetic is printed verbatim — "240.00 x 5 x (11/31 days
 * remaining) = 425.81 credit". Reviewers check the maths, and an exposed
 * numerator and denominator is unfalsifiable in a way a final figure is not.
 */

interface Sub {
  id: number; ref: string; customer: string; plan: string; sku: string
  cycle: 'monthly' | 'quarterly' | 'yearly'
  qty: number; unit_price: number
  start_date: string; next_bill_date: string
  status: 'active' | 'paused' | 'cancelled'
}

interface Ledger {
  ref: string; customer: string
  one_time_lines: Array<{ sku: string; name: string; qty: number; amount: number }>
  one_time_total: number
  recurring_lines: Array<{ subscription_id: number; plan: string; cycle: string
                           qty: number; unit_price: number; amount: number
                           next_bill_date: string | null; status: string }>
  recurring_total: number
  schedule: Array<{ due_date: string; amount: number; status: string; note: string }>
  invoice_today: number
}

interface Proration {
  kind: 'credit_note' | 'charge' | 'none'
  credit: number; days_remaining: number; days_in_cycle: number
  delta_qty: number; new_qty: number; formula: string
  credit_note_ref: string | null
  period_start: string; period_end: string
}

const STATUS_TONE: Record<string, string> = {
  active: 'bg-band-autoWash text-band-auto ring-band-auto/25',
  paused: 'bg-band-managerWash text-band-manager ring-band-manager/25',
  cancelled: 'bg-surface-2 text-fg-3 ring-black/[.07]',
}

export default function Subscriptions() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'active' | 'paused' | 'cancelled'>('ALL')
  const [newQty, setNewQty] = useState('')
  const [proration, setProration] = useState<Proration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.subscriptions()
      .then(r => {
        setSubs(r as Sub[]); setError(null)
        setSelected(s => s ?? (r[0]?.id ?? null))
      })
      .catch(e => setError(`Could not load subscriptions (${e?.message ?? 'unknown error'}).`))
  }, [])
  useEffect(load, [load])

  const current = subs.find(s => s.id === selected) ?? null

  // The billing detail is per ORDER, because the whole point of hybrid billing
  // is that hardware and a subscription share one ledger.
  useEffect(() => {
    if (!current) { setLedger(null); return }
    api.orderBilling(current.ref)
      .then(l => setLedger(l as Ledger))
      .catch(() => setLedger(null))
  }, [current?.ref])

  const change = async (action: 'change_qty' | 'cancel') => {
    if (!current) return
    setBusy(true); setError(null)
    try {
      const body = action === 'cancel'
        ? { action: 'cancel' }
        : { new_qty: Number(newQty || current.qty) }
      const res = await api.changeSubscription(current.id, body)
      setProration(res as Proration)
      setNewQty('')
      load()
    } catch (e: any) {
      setError(e?.message?.includes('403')
        ? 'Your role is not permitted to modify subscriptions — this is a Finance or Admin action.'
        : `Could not apply the change (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  const visible = subs.filter(s => filter === 'ALL' || s.status === filter)

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">Subscriptions</h1>
          <div className="flex bg-surface-2 rounded-full p-1 gap-1 ml-2">
            {(['ALL', 'active', 'paused', 'cancelled'] as const).map(f => (
              <button
                key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium capitalize ${
                  filter === f ? 'bg-fg text-white' : 'text-fg-2 hover:text-fg'}`}
                style={{ transition: `all 280ms ${EASE_CSS}` }}
              >
                {f === 'ALL' ? 'All' : f}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-[12px] text-fg-3 tabular-nums">
            Run-rate{' '}
            <b className="text-fg ml-1.5">
              {inr(subs.filter(s => s.status === 'active')
                       .reduce((a, s) => a + s.qty * s.unit_price, 0))}
            </b>
          </span>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
          {/* ── List (screen 9) ──────────────────────────────────── */}
          <section className="panel">
            <div className="scroll-x">
              <table className="grid-table min-w-[600px]">
                <thead>
                  <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                                 border-b border-line">
                    <th className="text-left font-medium px-4 py-2.5">Customer</th>
                    <th className="text-left font-medium px-3 py-2.5">Plan</th>
                    <th className="text-left font-medium px-3 py-2.5 w-24">Cycle</th>
                    <th className="text-left font-medium px-3 py-2.5 w-28">Next bill</th>
                    <th className="text-right font-medium px-3 py-2.5 w-28">Amount</th>
                    <th className="text-left font-medium px-4 py-2.5 w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(s => (
                    <tr
                      key={s.id}
                      onClick={() => { setSelected(s.id); setProration(null) }}
                      className={`border-b border-line last:border-0 cursor-pointer
                                  ${selected === s.id ? 'bg-accent-wash' : 'hover:bg-surface-2/60'}`}
                      style={{ transition: `background 200ms ${EASE_CSS}` }}
                    >
                      <td className="px-4 py-2.5 text-fg font-medium">{s.customer}</td>
                      <td className="px-3 py-2.5 text-fg-2">
                        {s.plan}
                        <span className="block font-mono text-[10px] text-fg-3">
                          {s.ref} · ×{s.qty}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-fg-2 capitalize">{s.cycle}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-fg-2">
                        {s.status === 'cancelled' ? '—' : s.next_bill_date}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">
                        {inr(s.qty * s.unit_price)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full ring-1 px-2 py-0.5 font-mono text-[10px]
                                          font-semibold uppercase ${STATUS_TONE[s.status] ?? ''}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-[13px] text-fg-3">
                      No {filter === 'ALL' ? '' : filter} subscriptions.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Billing detail (screen 10) ───────────────────────── */}
          {current && (
            <aside className="flex flex-col gap-4 lg:sticky lg:top-[72px]">
              <section className="panel p-5
                                  flex flex-col gap-4">
                <div>
                  <div className="font-mono text-[11px] text-accent">{current.ref}</div>
                  <h2 className="font-display text-[17px] font-bold text-fg mt-0.5">
                    {current.customer} · {current.plan}
                  </h2>
                </div>

                {/* Hybrid ledger: PS B7 requires both kinds on ONE order */}
                {ledger && (
                  <>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mb-2">
                        One-time lines (from originating order)
                      </div>
                      {ledger.one_time_lines.length === 0 ? (
                        <p className="text-[12.5px] text-fg-3">None on this order.</p>
                      ) : ledger.one_time_lines.map(l => (
                        <div key={l.sku} className="flex justify-between text-[12.5px] py-0.5">
                          <span className="text-fg-2">{l.name} <span className="font-mono text-fg-3">×{l.qty}</span></span>
                          <span className="font-mono tabular-nums text-fg">{inr(l.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[12.5px] pt-1.5 mt-1.5 border-t border-line">
                        <span className="text-fg-3">Invoiced today</span>
                        <AnimatedNumber value={ledger.invoice_today} format="inr"
                                        className="text-fg font-semibold" />
                      </div>
                    </div>

                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mb-2">
                        Recurring lines
                      </div>
                      {ledger.recurring_lines.map(r => (
                        <div key={r.subscription_id} className="flex justify-between text-[12.5px] py-0.5">
                          <span className="text-fg-2">
                            {r.plan}
                            <span className="font-mono text-fg-3"> ×{r.qty} · {r.cycle}</span>
                          </span>
                          <span className="font-mono tabular-nums text-fg">{inr(r.amount)}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mb-2">
                        Upcoming billing schedule
                      </div>
                      {ledger.schedule.slice(0, 3).map((b, i) => (
                        <div key={i} className="flex justify-between text-[12.5px] py-0.5">
                          <span className="font-mono text-fg-2">{b.due_date}</span>
                          <span className="font-mono tabular-nums text-fg-2">{inr(b.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* Modify / cancel with visible proration */}
              <section className="panel p-5
                                  flex flex-col gap-3">
                <h3 className="font-display text-[14px] font-semibold text-fg">
                  Modify subscription
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] text-fg-2">Quantity</span>
                  <span className="font-mono text-[13px] text-fg-3">{current.qty}</span>
                  <span className="text-fg-4">→</span>
                  <input
                    type="number" min={0}
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    placeholder={String(current.qty)}
                    disabled={current.status === 'cancelled'}
                    className="w-20 rounded-lg bg-surface px-2 py-1.5 text-center font-mono
                               tabular-nums text-fg ring-1 ring-black/[.08]
                               outline-none focus:ring-accent/40 disabled:opacity-40"
                  />
                  <button
                    onClick={() => change('change_qty')}
                    disabled={busy || !newQty || current.status === 'cancelled'}
                    className="ml-auto rounded-full bg-fg text-white px-4 py-1.5 font-display
                               text-[12.5px] font-semibold disabled:opacity-35"
                    style={{ transition: `all 320ms ${EASE_CSS}` }}
                  >
                    Apply
                  </button>
                </div>

                <button
                  onClick={() => change('cancel')}
                  disabled={busy || current.status === 'cancelled'}
                  className="rounded-full ring-1 ring-band-finance/30 text-band-finance
                             bg-band-financeWash py-1.5 font-display text-[12.5px] font-semibold
                             disabled:opacity-35"
                  style={{ transition: `all 320ms ${EASE_CSS}` }}
                >
                  Cancel Subscription
                </button>

                {proration && (
                  <div className={`rounded-xl px-3.5 py-3 ring-1 ${
                    proration.kind === 'credit_note'
                      ? 'bg-band-autoWash ring-band-auto/25'
                      : proration.kind === 'charge'
                      ? 'bg-band-managerWash ring-band-manager/25'
                      : 'bg-surface-2 ring-black/[.06]'}`}>
                    <div className="font-mono text-[9.5px] uppercase tracking-eyebrow mb-1.5
                                    text-fg-3">
                      {proration.kind === 'credit_note' ? 'Credit note issued'
                        : proration.kind === 'charge' ? 'Additional charge'
                        : 'No proration'}
                    </div>
                    {/* The figure leads; the arithmetic backs it up. A credit
                        is money going back to the customer, so it rolls and
                        recolours like every other changing number in Clinch. */}
                    {proration.kind !== 'none' && (
                      <AnimatedNumber
                        value={Math.abs(proration.credit)}
                        format="inr" precision={2}
                        polarity={proration.kind === 'credit_note' ? 'higher-better' : 'lower-better'}
                        className="font-display text-[22px] font-bold text-fg leading-none mb-1.5"
                      />
                    )}
                    {/* The arithmetic, shown rather than summarised. */}
                    <p className="font-mono text-[12.5px] text-fg-2 leading-relaxed">
                      {proration.formula}
                    </p>
                    <p className="text-[11px] text-fg-3 mt-1.5">
                      Period {proration.period_start} → {proration.period_end}
                      {proration.credit_note_ref && ` · ${proration.credit_note_ref}`}
                    </p>
                  </div>
                )}
              </section>
            </aside>
          )}
        </div>
      </div>
    </Workspace>
  )
}
