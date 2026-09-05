import { useCallback, useEffect, useState } from 'react'
import { api, inr } from '../lib/api'
import { ErrorBar, Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'

/**
 * Invoices — wireframe screens 12 and 13, PS §9 rubric step 8.
 *
 * The list and the detail live in one screen: selecting a row opens the
 * lifecycle stepper and the payment form beside it, which keeps the "record a
 * payment, watch the status flip" beat to a single click rather than a page
 * navigation.
 *
 * This is the step most teams never reach, so it is deliberately complete:
 * credit notes appear alongside invoices (a downgrade produces a negative
 * account_move), partial payments are supported, and paying a settled invoice
 * is refused rather than silently double-crediting.
 */

interface Invoice {
  ref: string; order_ref: string; customer: string
  kind: 'invoice' | 'credit_note'
  amount: number; amount_paid: number
  status: 'unpaid' | 'partial' | 'paid' | 'issued'
  due_date: string; method?: string
  lines?: Array<{ sku: string; name: string; qty: number; amount: number }>
}

const STATUS_TONE: Record<string, string> = {
  unpaid: 'bg-band-financeWash text-band-finance ring-band-finance/25',
  partial: 'bg-band-managerWash text-band-manager ring-band-manager/25',
  paid: 'bg-band-autoWash text-band-auto ring-band-auto/25',
  issued: 'bg-surface-2 text-fg-2 ring-black/[.07]',
}

/** Order → Shipped → Invoiced → Paid, per the wireframe stepper. */
const STAGES = ['Order Confirmed', 'Shipped', 'Invoiced', 'Paid']

function stageIndex(inv: Invoice) {
  if (inv.status === 'paid') return 3
  return 2
}

export default function Invoices() {
  const [rows, setRows] = useState<Invoice[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'unpaid' | 'paid'>('ALL')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.invoices()
      .then(r => {
        setRows(r as Invoice[])
        setError(null)
        setSelected(s => s ?? (r[0]?.ref ?? null))
      })
      .catch(e => setError(`Could not load invoices (${e?.message ?? 'unknown error'}).`))
  }, [])
  useEffect(load, [load])

  const current = rows.find(r => r.ref === selected) ?? null
  const visible = rows.filter(r =>
    filter === 'ALL' ? true
      : filter === 'paid' ? r.status === 'paid'
      : r.status !== 'paid')

  const pay = async () => {
    if (!current) return
    const due = current.amount - current.amount_paid
    const value = amount ? Number(amount) : due
    setBusy(true); setError(null); setNotice(null)
    try {
      const res: any = await api.payInvoice(current.ref, { amount: value, method })
      setNotice(
        res.status === 'paid'
          ? `Payment recorded. ${current.ref} is now PAID${
              res.order_state === 'PAID' ? ` and order ${current.order_ref} is closed.` : '.'}`
          : `Partial payment recorded — ${inr(current.amount - res.amount_paid)} still outstanding.`)
      setAmount('')
      load()
    } catch (e: any) {
      setError(
        e?.message?.includes('403')
          ? 'Your role is not permitted to register payments — this is a Finance or Admin action.'
          : e?.message?.includes('409')
          ? 'This invoice is already fully paid.'
          : `Could not record the payment (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[22px] font-bold text-fg">Invoices</h1>
          <div className="flex bg-surface-2 rounded-full p-1 gap-1 ml-2">
            {(['ALL', 'unpaid', 'paid'] as const).map(f => (
              <button
                key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium capitalize ${
                  filter === f ? 'bg-fg text-white' : 'text-fg-2 hover:text-fg'}`}
                style={{ transition: `all 280ms ${EASE_CSS}` }}
              >
                {f === 'ALL' ? 'All' : f}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-[12px] text-fg-3 tabular-nums">
            Outstanding{' '}
            <b className="text-fg ml-1.5">
              {inr(rows.filter(r => r.kind === 'invoice' && r.status !== 'paid')
                      .reduce((a, r) => a + (r.amount - r.amount_paid), 0))}
            </b>
          </span>
        </header>

        {notice && (
          <div className="rounded-xl bg-band-autoWash ring-1 ring-band-auto/25 px-4 py-2.5
                          text-[13px] text-band-auto">{notice}</div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
          {/* ── List (screen 12) ─────────────────────────────────── */}
          <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[560px]">
                <thead>
                  <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                                 border-b border-line">
                    <th className="text-left font-medium px-4 py-2.5">Invoice #</th>
                    <th className="text-left font-medium px-3 py-2.5">Customer</th>
                    <th className="text-right font-medium px-3 py-2.5 w-32">Amount</th>
                    <th className="text-left font-medium px-3 py-2.5 w-24">Status</th>
                    <th className="text-left font-medium px-4 py-2.5 w-28">Due date</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr
                      key={r.ref}
                      onClick={() => { setSelected(r.ref); setNotice(null); setAmount('') }}
                      className={`border-b border-line last:border-0 cursor-pointer
                                  ${selected === r.ref ? 'bg-accent-wash' : 'hover:bg-surface-2/60'}`}
                      style={{ transition: `background 200ms ${EASE_CSS}` }}
                    >
                      <td className="px-4 py-2.5 font-mono text-fg">
                        {r.ref}
                        {r.kind === 'credit_note' && (
                          <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5
                                           font-mono text-[9px] text-fg-3">CREDIT</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-fg font-medium">{r.customer}</td>
                      <td className={`px-3 py-2.5 text-right font-mono tabular-nums font-semibold
                                      ${r.amount < 0 ? 'text-band-auto' : 'text-fg'}`}>
                        {inr(r.amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full ring-1 px-2 py-0.5 font-mono text-[10px]
                                          font-semibold uppercase ${STATUS_TONE[r.status] ?? ''}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{r.due_date}</td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-fg-3">
                      No {filter === 'ALL' ? '' : filter} invoices.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Detail (screen 13) ───────────────────────────────── */}
          {current && (
            <aside className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-5
                              flex flex-col gap-4 lg:sticky lg:top-[72px]">
              <div>
                <div className="font-mono text-[11px] text-accent">{current.ref}</div>
                <h2 className="font-display text-[18px] font-bold text-fg mt-0.5">
                  {current.customer}
                </h2>
                <div className="font-mono text-[11px] text-fg-3 mt-1">
                  from order {current.order_ref} · due {current.due_date}
                </div>
              </div>

              {/* Lifecycle stepper */}
              <div className="flex items-center gap-1">
                {STAGES.map((label, i) => {
                  const done = i <= stageIndex(current)
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-center">
                        {i > 0 && <div className={`h-px flex-1 ${done ? 'bg-band-auto' : 'bg-line-2'}`} />}
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mx-0.5
                                         ${done ? 'bg-band-auto' : 'bg-line-2'}`} />
                        {i < STAGES.length - 1 && (
                          <div className={`h-px flex-1 ${i < stageIndex(current) ? 'bg-band-auto' : 'bg-line-2'}`} />
                        )}
                      </div>
                      <span className={`font-mono text-[8.5px] uppercase tracking-wider text-center
                                        ${done ? 'text-band-auto' : 'text-fg-4'}`}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {current.lines && current.lines.length > 0 && (
                <div className="border-y border-line py-3 flex flex-col gap-1.5">
                  {current.lines.map(l => (
                    <div key={l.sku} className="flex justify-between text-[12.5px]">
                      <span className="text-fg-2">{l.name} <span className="font-mono text-fg-3">×{l.qty}</span></span>
                      <span className="font-mono tabular-nums text-fg">{inr(l.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5 font-mono text-[13px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-fg-3">Invoiced</span><b className="text-fg">{inr(current.amount)}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-3">Paid</span><b className="text-band-auto">{inr(current.amount_paid)}</b>
                </div>
                <div className="flex justify-between border-t border-line pt-1.5">
                  <span className="text-fg-3">Outstanding</span>
                  <b className={current.amount - current.amount_paid > 0 ? 'text-band-finance' : 'text-fg'}>
                    {inr(current.amount - current.amount_paid)}
                  </b>
                </div>
              </div>

              {/* Record payment (rubric step 8) */}
              {current.kind === 'invoice' && current.status !== 'paid' ? (
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="number" min={0} step={0.01}
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder={String(Math.round(current.amount - current.amount_paid))}
                      className="flex-1 rounded-lg bg-surface px-3 py-2 text-[13px] font-mono
                                 tabular-nums text-fg ring-1 ring-black/[.08]
                                 outline-none focus:ring-accent/40 placeholder:text-fg-4"
                      aria-label="Payment amount"
                    />
                    <select
                      value={method}
                      onChange={e => setMethod(e.target.value)}
                      className="rounded-lg bg-surface px-2.5 py-2 text-[12.5px] text-fg-2
                                 ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                      aria-label="Payment method"
                    >
                      <option value="bank_transfer">Bank</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <button
                    onClick={pay}
                    disabled={busy}
                    className="rounded-full bg-fg text-white py-2.5 font-display text-[13px]
                               font-semibold hover:shadow-lift-lg active:scale-[.98]
                               disabled:opacity-40"
                    style={{ transition: `all 320ms ${EASE_CSS}` }}
                  >
                    Record Payment
                  </button>
                  <p className="text-[11.5px] text-fg-3 leading-snug">
                    Leave the amount blank to settle in full. A full payment also closes the
                    originating order.
                  </p>
                </div>
              ) : current.kind === 'credit_note' ? (
                <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-2">
                  Credit note issued against {current.order_ref}. Applied to the customer's balance.
                </p>
              ) : (
                <p className="rounded-lg bg-band-autoWash px-3 py-2.5 text-[12.5px] text-band-auto">
                  Settled in full{current.method ? ` via ${current.method.replace(/_/g, ' ')}` : ''}.
                </p>
              )}
            </aside>
          )}
        </div>
      </div>
    </Workspace>
  )
}
