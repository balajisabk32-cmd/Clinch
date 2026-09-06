import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, inr, type Warehouse } from '../lib/api'
import { ErrorBar, Workspace } from '../components/Workspace'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { NumberField } from '../components/NumberField'
import { cn } from '../lib/cn'
import { EASE_CSS } from '../lib/motion'

/**
 * Fulfilment Detail — wireframe screen 8, PS B6.
 *
 * Shows how an order would ship, lets operations commit it, and surfaces the
 * "Consolidate Remaining Backorder" prompt the spec requires.
 *
 * The objective toggle is not decorative: minimising cost and minimising
 * shipments are genuinely different objectives once a fixed per-shipment charge
 * exists, and the engine evaluates the whole warehouse subset lattice for each.
 * Committing is a separate, deliberate act — until Accept is pressed the split
 * is only a recommendation and no stock is reserved.
 */

interface Allocation {
  warehouse: string; sku: string; name: string; qty: number
  unit_ship_cost: number; cost: number
}
interface OrderStatus {
  ref: string; customer: string | null; state: string
  stage: number; stages: string[]
  allowed_transitions: string[]
  can_allocate: boolean; can_ship: boolean
  can_invoice: boolean; can_take_payment: boolean
  allocated: boolean
  shipped: Array<{ warehouse: string; sku: string; qty: number; at: string }>
  invoice: {
    ref: string; amount: number; amount_paid: number; outstanding: number
    status: string; due_date: string | null; paid_at: string | null
    method_label: string | null
    payments: Array<{ at: string; amount: number; method_label?: string }>
  } | null
}

interface Split {
  ref: string; objective: string
  allocations: Allocation[]
  backorders: Array<{ sku: string; name: string; qty: number; status: string }>
  shipment_count: number; total_cost: number
  warehouses_used: string[]; subsets_evaluated: number
  fully_allocated: boolean; consolidation_available: boolean
  explanation: string
}

/** "2026-09-06T05:11:37+00:00" -> "6 Sep 2026, 05:11". */
const when = (iso?: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function FulfilmentDetail() {
  const navigate = useNavigate()
  const { ref = '' } = useParams()
  const [objective, setObjective] = useState<'cost' | 'shipments'>('cost')
  const [split, setSplit] = useState<Split | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [consolidated, setConsolidated] = useState<Split | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /* Manual override quantities, keyed "<depot>|<sku>".

     This was keyed by depot alone, so an order with two hardware lines (say 10
     monitors and 10 docks) showed one row per depot, filled it with the FIRST
     sku's availability, and committed every unit under that sku -- the second
     line silently vanished and the availability figures on screen belonged to a
     product the operator was not looking at. */
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [manual, setManual] = useState<Record<string, number> | null>(null)

  /* The order's ACTUAL state, not just a plan for it.

     This screen used to load the split plan and the warehouse list and nothing
     else, so it had no idea whether the order had already shipped, been
     invoiced or been paid. Every button was offered at every stage -- pressing
     "Confirm & Ship" on a shipped order surfaced the state machine's own
     refusal ("Q-1042 is FULFILLED; CONFIRMED is not a legal next state") to a
     finance user as if they had made a mistake. And the invoice/payment tail
     rendered only as the RESULT of clicking Confirm in that session, so a
     reload made the whole settlement half of quote-to-cash disappear. */
  const load = useCallback(() => {
    if (!ref) return
    Promise.all([api.split(ref, objective), api.warehouses(), api.fulfilmentStatus(ref)])
      .then(([s, w, st]) => {
        setSplit(s); setWarehouses(w); setStatus(st)
        setError(null); setManual(null)
      })
      .catch(e => setError(
        e?.message?.includes('404')
          ? `No order ${ref}.`
          : `Could not plan this shipment (${e?.message ?? 'unknown error'}).`))
  }, [ref, objective])
  useEffect(load, [load])

  /** Per-depot rollup — the wireframe's Qty Fulfilled / Shipments / Cost table. */
  const byDepot = useMemo(() => {
    if (!split) return []
    const map = new Map<string, { qty: number; cost: number; lines: Allocation[] }>()
    for (const a of split.allocations) {
      const row = map.get(a.warehouse) ?? { qty: 0, cost: 0, lines: [] }
      row.qty += a.qty; row.cost += a.cost; row.lines.push(a)
      map.set(a.warehouse, row)
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v }))
  }, [split])

  /** The shippable lines on this order: every sku the split touched, plus
      anything it could not place at all. */
  const demand = useMemo(() => {
    if (!split) return []
    const map = new Map<string, { sku: string; name: string; qty: number }>()
    for (const a of split.allocations) {
      const row = map.get(a.sku) ?? { sku: a.sku, name: a.name, qty: 0 }
      row.qty += a.qty
      map.set(a.sku, row)
    }
    for (const b of split.backorders) {
      const row = map.get(b.sku) ?? { sku: b.sku, name: b.name, qty: 0 }
      row.qty += b.qty
      map.set(b.sku, row)
    }
    return [...map.values()]
  }, [split])

  /** Free stock for a sku at a depot, straight off the warehouse feed. */
  const freeAt = useCallback(
    (depot: string, sku: string) =>
      warehouses.find(w => w.name === depot)?.stock.find(r => r.sku === sku)?.available ?? 0,
    [warehouses])

  /* Carriage and the fixed per-shipment charge, priced the way the engine
     prices them. Without this the screen showed a single total and an operator
     comparing plans could not see that opening a second depot costs a whole
     extra shipment charge -- which is exactly the question "why is one depot
     cheaper than two?" that the number is there to answer. */
  const costOf = useCallback((rows: Array<{ warehouse: string; sku: string; qty: number }>) => {
    const used = [...new Set(rows.filter(r => r.qty > 0).map(r => r.warehouse))]
    const variable = rows.reduce((sum, r) => {
      const w = warehouses.find(x => x.name === r.warehouse)
      return sum + r.qty * (w?.ship_cost_weight ?? 0)
    }, 0)
    const fixed = used.reduce((sum, n) =>
      sum + (warehouses.find(x => x.name === n)?.fixed_shipment_cost ?? 0), 0)
    return { variable, fixed, total: variable + fixed, depots: used.length }
  }, [warehouses])

  /** What the suggestion would cost if every unit went to one depot instead.
      Shown beside the suggestion so the recommendation is auditable. */
  const alternatives = useMemo(() => {
    if (!split || warehouses.length === 0) return []
    return warehouses.map(w => {
      const short = demand.filter(d => freeAt(w.name, d.sku) < d.qty)
      const rows = demand.map(d => ({
        warehouse: w.name, sku: d.sku,
        qty: Math.min(d.qty, freeAt(w.name, d.sku)),
      }))
      const c = costOf(rows)
      return {
        name: w.name, ...c,
        unmet: demand.reduce((n, d) => n + Math.max(0, d.qty - freeAt(w.name, d.sku)), 0),
        feasible: short.length === 0,
      }
    })
  }, [split, warehouses, demand, freeAt, costOf])

  const manualCost = useMemo(() => {
    if (!manual) return null
    return costOf(Object.entries(manual).map(([k, qty]) => {
      const [warehouse, sku] = k.split('|')
      return { warehouse, sku, qty }
    }))
  }, [manual, costOf])

  /* What happens after the goods leave.
     Confirming used to be the end of the screen: the order shipped, a toast
     appeared, and the operator was left to find Invoices in the nav and search
     for the reference by hand. The money half of quote-to-cash is the half the
     business cares about, so the flow continues here instead of stopping. */
  const [shipped, setShipped] = useState<any>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [paying, setPaying] = useState(false)

  const confirmAndShip = async () => {
    setBusy(true); setError(null)
    try {
      const res = await api.confirmOrder(ref)
      setShipped(res)
      setNotice(null)
      load()
    } catch (e: any) {
      setError(e?.message?.includes('403')
        ? 'Your role is not permitted to ship this order - this is a Finance or Admin action.'
        : `Could not confirm fulfilment (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  const generateInvoice = async () => {
    setBusy(true); setError(null)
    try {
      setInvoice(await api.generateInvoice(ref))
    } catch (e: any) {
      setError(`Could not generate the invoice (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  /* Settlement methods the SERVER accepts.

     These were two hardcoded buttons, "Bank" and "Cash". Neither string is a
     method the API recognises, so both produced a 422 the operator could do
     nothing about. */
  const [methods, setMethods] = useState<Array<{ key: string; label: string }>>([])
  const [method, setMethod] = useState('bank_transfer')
  useEffect(() => {
    api.paymentMethods()
      .then(m => { setMethods(m); setMethod(p => m.some(x => x.key === p) ? p : (m[0]?.key ?? p)) })
      .catch(() => { /* falls back to bank transfer */ })
  }, [])

  const liveInvoice = invoice ?? status?.invoice ?? null

  const registerPayment = async () => {
    if (!liveInvoice) return
    setPaying(true); setError(null)
    try {
      const paid = await api.registerPayment(liveInvoice.ref, method, liveInvoice.outstanding
        ?? liveInvoice.amount)
      setInvoice(paid)
      load()
    } catch (e: any) {
      setError(`Could not register the payment (${e?.message ?? 'unknown error'}).`)
    } finally { setPaying(false) }
  }

  const act = async (fn: () => Promise<any>, message: string) => {
    setBusy(true); setError(null)
    try { await fn(); setNotice(message); load() }
    catch (e: any) {
      setError(e?.message?.includes('403')
        ? 'Your role is not permitted to commit warehouse allocations — this is a Finance or Admin action.'
        : `Action failed (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  if (!split) {
    return (
      <Workspace onReload={load}>
        {error ? <ErrorBar message={error} onRetry={load} />
               : <p className="text-[13px] text-fg-3">Planning shipment…</p>}
      </Workspace>
    )
  }

  const backCount = split.backorders.reduce((a, b) => a + b.qty, 0)

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-center gap-4">
          <div>
            <Link to="/app/fulfilment"
                  className="font-mono text-[11px] text-fg-3 hover:text-accent">
              ← Fulfilment &amp; Stock
            </Link>
            <h1 className="font-display text-[19px] font-bold text-fg tracking-tight mt-1">
              Fulfilment Detail · {ref}
            </h1>
          </div>

          {/* Objective toggle (PS B6) */}
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
              Optimise for
            </span>
            <div className="flex bg-surface-2 rounded-full p-1 gap-1">
              {(['shipments', 'cost'] as const).map(o => (
                <button
                  key={o}
                  onClick={() => setObjective(o)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${
                    objective === o ? 'bg-fg text-white' : 'text-fg-2 hover:text-fg'}`}
                  style={{ transition: `all 280ms ${EASE_CSS}` }}
                >
                  {o === 'shipments' ? 'Fewest shipments' : 'Lowest cost'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {notice && (
          <div className="rounded-xl bg-band-autoWash ring-1 ring-band-auto/25 px-4 py-2.5
                          text-[13px] text-band-auto">{notice}</div>
        )}

        {/* Where this order stands.

            The screen showed a split plan and three buttons with no indication
            of whether the goods had shipped, the invoice had been raised, or
            the money had arrived. "Customer request -> fulfilment -> payment"
            was the one thing the fulfilment screen could not tell you. */}
        {status && (
          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Order progress</span>
              <span className="key text-fg-3">
                {status.customer ? `${status.customer} · ` : ''}{status.state}
              </span>
            </div>
            <div className="px-4 py-4">
              <ol className="grid grid-cols-5 gap-1">
                {status.stages.map((label, i) => {
                  const done = i <= status.stage
                  const here = i === status.stage
                  return (
                    <li key={label} className="flex flex-col gap-1.5">
                      <div className="flex items-center">
                        <span className={cn('h-[2px] flex-1 rounded-full',
                          i === 0 ? 'bg-transparent' : done ? 'bg-band-auto' : 'bg-line-2')} />
                        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0 mx-0.5',
                          here ? 'bg-band-auto ring-4 ring-band-autoWash'
                            : done ? 'bg-band-auto' : 'bg-line-2')} />
                        <span className={cn('h-[2px] flex-1 rounded-full',
                          i === status.stages.length - 1 ? 'bg-transparent'
                            : i < status.stage ? 'bg-band-auto' : 'bg-line-2')} />
                      </div>
                      <span className={cn(
                        'font-mono text-[9.5px] uppercase tracking-eyebrow text-center',
                        here ? 'text-band-auto font-semibold'
                          : done ? 'text-fg-2' : 'text-fg-4')}>
                        {label}
                      </span>
                    </li>
                  )
                })}
              </ol>
              <p className="mt-3 text-[12px] text-fg-3 text-center">
                {status.state === 'PAID'
                  ? 'Settled. Nothing further is required on this order.'
                  : status.can_take_payment
                    ? 'Invoiced and awaiting payment.'
                    : status.can_invoice
                      ? 'Shipped. Raise the invoice to continue.'
                      : status.can_ship
                        ? status.allocated
                          ? 'Stock is reserved. Confirm to ship it.'
                          : 'Accept a split to reserve stock, then confirm to ship.'
                        : 'This order is not ready to ship yet.'}
              </p>
            </div>
          </section>
        )}

        {/* Headline numbers */}
        <div className="grid sm:grid-cols-4 gap-3">
          {[
            { label: 'Units allocated', value: split.allocations.reduce((a, x) => a + x.qty, 0) },
            { label: 'Shipments', value: split.shipment_count },
            { label: 'Shipping cost', value: inr(split.total_cost) },
            { label: 'Backordered', value: backCount, alert: backCount > 0 },
          ].map(s => (
            <div key={s.label} className="panel p-4 shadow-lift">
              <div className={`font-display text-[26px] font-bold tabular-nums leading-none
                               ${s.alert ? 'text-band-finance' : 'text-fg'}`}>
                {s.value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-accent mt-2">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[12.5px] text-fg-2">
          {split.explanation}
        </p>

        {/* Why this plan and not another.

            The screen used to show one number -- "Shipping cost 57" -- with
            nothing to compare it against, so a plan that shipped everything
            from the dearer-per-unit depot looked like a mistake. It is not: a
            depot charges per unit AND a flat charge for opening a shipment at
            all, so the cheaper per-unit depot can still lose, and opening a
            second depot to spread the load pays the flat charge twice. Pricing
            the single-depot alternatives beside the recommendation makes that
            arithmetic visible instead of asking the operator to trust it. */}
        {alternatives.length > 1 && (
          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Why this plan</span>
              <span className="key text-fg-3">
                {objective === 'cost' ? 'lowest cost' : 'fewest shipments'}
              </span>
            </div>
            <div className="px-4 py-3.5 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1
                              font-mono text-[11.5px] tabular-nums">
                <span className="text-fg-3">
                  Carriage{' '}
                  <span className="text-fg-2">
                    {inr(split.allocations.reduce((a, x) => a + x.cost, 0))}
                  </span>
                </span>
                <span className="text-fg-3">
                  Shipment charge &times;{split.shipment_count}{' '}
                  <span className="text-fg-2">
                    {inr(split.total_cost - split.allocations.reduce((a, x) => a + x.cost, 0))}
                  </span>
                </span>
                <span className="text-fg font-semibold">
                  Recommended {inr(split.total_cost)}
                </span>
              </div>

              <table className="grid-table">
                <thead>
                  <tr>
                    <th>If everything shipped from</th>
                    <th className="text-right w-24">Carriage</th>
                    <th className="text-right w-28">Shipment</th>
                    <th className="text-right w-24">Total</th>
                    <th className="w-40">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {alternatives.map(alt => {
                    const chosen = split.warehouses_used.length === 1
                      && split.warehouses_used[0] === alt.name
                    return (
                      <tr key={alt.name} className="border-b border-line last:border-0">
                        <td className="font-medium text-fg">{alt.name}</td>
                        <td className="num text-fg-2">{inr(alt.variable)}</td>
                        <td className="num text-fg-2">{inr(alt.fixed)}</td>
                        <td className={`num font-semibold ${
                          chosen ? 'text-band-auto' : 'text-fg-2'}`}>
                          {inr(alt.total)}
                        </td>
                        <td className="text-[12px]">
                          {!alt.feasible
                            ? <span className="text-band-finance">
                                short {alt.unmet} unit{alt.unmet === 1 ? '' : 's'}
                              </span>
                            : chosen
                              ? <span className="text-band-auto">chosen</span>
                              : <span className="text-fg-3">
                                  {inr(alt.total - split.total_cost)} dearer
                                </span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <p className="text-[12px] text-fg-3">
                A depot charges per unit shipped plus a flat charge for opening a shipment.
                Splitting one order across two depots pays that flat charge twice, so a
                single depot usually wins unless it cannot cover the order. Backorders
                outrank cost: a plan that leaves fewer units unshipped is preferred even
                when it is dearer.
              </p>
            </div>
          </section>
        )}

        {/* Per-depot breakdown */}
        <section className="panel">
          <div className="px-4 py-3 border-b border-line flex items-center gap-3">
            <h2 className="font-display text-[14px] font-semibold text-fg">Suggested split</h2>
            <span className="font-mono text-[10.5px] text-fg-3">
              optimal over {split.subsets_evaluated} warehouse combination(s)
            </span>
          </div>
          <div className="scroll-x">
            <table className="grid-table min-w-[620px]">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Lines</th>
                  <th className="text-right font-medium w-32">Qty fulfilled</th>
                  <th className="text-right font-medium w-32">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byDepot.map(d => (
                  <tr key={d.name} className="border-b border-line last:border-0">
                    <td className="font-medium text-fg">{d.name}</td>
                    <td>
                      {d.lines.map(l => (
                        <div key={l.sku} className="text-[12.5px] text-fg-2">
                          {l.name} <span className="font-mono text-fg-3">×{l.qty}</span>
                        </div>
                      ))}
                    </td>
                    <td className="text-right font-mono tabular-nums text-fg font-semibold">
                      {d.qty}
                    </td>
                    <td className="text-right font-mono tabular-nums text-fg-2">
                      {inr(d.cost)}
                    </td>
                  </tr>
                ))}
                {byDepot.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-fg-3">
                    Nothing physical to ship on this order.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Backorders + consolidation (PS B6) */}
        {split.backorders.length > 0 && (
          <section className="rounded-2xl bg-band-financeWash ring-1 ring-band-finance/20 p-4
                              flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="font-display text-[14px] font-semibold text-band-finance">
                  Backorder — {backCount} unit(s) cannot ship yet
                </h2>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {split.backorders.map(b => (
                    <li key={b.sku} className="text-[12.5px] text-fg-2">
                      {b.name} <span className="font-mono">×{b.qty}</span> — {b.status.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => act(async () => setConsolidated(await api.consolidate(ref)),
                                   'Remaining backorder consolidated into one shipment.')}
                disabled={busy}
                className="rounded-full bg-fg text-white px-4 py-2 font-display text-[12.5px]
                           font-semibold hover:shadow-lift-lg active:scale-[.98] disabled:opacity-40"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                Consolidate Remaining Backorder
              </button>
            </div>
            {consolidated && (
              <p className="text-[12.5px] text-fg-2 border-t border-band-finance/20 pt-2.5">
                {consolidated.explanation}{' '}
                {consolidated.allocations.map(a =>
                  `${a.name} ×${a.qty} from ${a.warehouse}`).join(', ')}
              </p>
            )}
          </section>
        )}

        {/* Manual override */}
        {manual !== null && (
          <section className="panel p-4 shadow-lift">
            <h2 className="font-display text-[14px] font-semibold text-fg mb-1">Manual override</h2>
            <p className="text-[12.5px] text-fg-2 mb-3">
              Set the quantity to take from each depot, per product. Free stock is shown
              beside each field; committing more than a depot holds, or more than the order
              needs, is refused by the server.
            </p>

            <div className="flex flex-col gap-4">
              {demand.map(d => {
                const placed = warehouses.reduce(
                  (n, w) => n + (manual[`${w.name}|${d.sku}`] ?? 0), 0)
                return (
                  <div key={d.sku} className="rounded-xl ring-1 ring-black/[.06] bg-surface-2/40 p-3">
                    <div className="flex items-baseline justify-between gap-3 mb-2.5">
                      <span className="text-[13px] font-medium text-fg">{d.name}</span>
                      <span className={`font-mono text-[11px] tabular-nums ${
                        placed === d.qty ? 'text-band-auto'
                          : placed > d.qty ? 'text-band-finance' : 'text-fg-3'}`}>
                        {placed} / {d.qty} placed
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {warehouses.map(w => {
                        const key = `${w.name}|${d.sku}`
                        const avail = freeAt(w.name, d.sku)
                        return (
                          <label key={key} className="flex items-center gap-3">
                            <span className="text-[12.5px] text-fg-2 flex-1 truncate">{w.name}</span>
                            <span className="font-mono text-[11px] text-fg-3 shrink-0">
                              {avail} free
                            </span>
                            <span className="w-20 shrink-0">
                              <NumberField
                                value={manual[key] ?? 0}
                                min={0}
                                max={Math.min(avail, d.qty)}
                                step={1}
                                ariaLabel={`${d.name} from ${w.name}`}
                                onCommit={n => setManual(m => ({ ...(m ?? {}), [key]: n }))}
                              />
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {manualCost && (
              <div className="mt-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-1
                              border-t border-line pt-3 font-mono text-[11.5px] tabular-nums">
                <span className="text-fg-3">
                  Carriage <span className="text-fg-2">{inr(manualCost.variable)}</span>
                </span>
                <span className="text-fg-3">
                  Shipment charge &times;{manualCost.depots}{' '}
                  <span className="text-fg-2">{inr(manualCost.fixed)}</span>
                </span>
                <span className="text-fg font-semibold">
                  This override {inr(manualCost.total)}
                </span>
                <span className={manualCost.total > split.total_cost
                  ? 'text-band-finance' : 'text-band-auto'}>
                  {manualCost.total === split.total_cost ? 'same as suggested'
                    : manualCost.total > split.total_cost
                      ? `${inr(manualCost.total - split.total_cost)} more than suggested`
                      : `${inr(split.total_cost - manualCost.total)} less than suggested`}
                </span>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => act(() => api.allocate(ref, {
                  allocations: Object.entries(manual)
                    .filter(([, q]) => q > 0)
                    .map(([key, qty]) => {
                      const [warehouse, sku] = key.split('|')
                      return { warehouse, sku, qty }
                    }),
                }), 'Manual allocation committed.')}
                disabled={busy || Object.values(manual).every(q => q <= 0)}
                className="rounded-full bg-fg text-white px-4 py-2 font-display text-[12.5px]
                           font-semibold disabled:opacity-40"
              >
                Commit override
              </button>
              <button onClick={() => setManual(null)}
                      className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2
                                 font-display text-[12.5px] font-semibold text-fg-2">
                Cancel
              </button>
            </div>
          </section>
        )}

        {/* Commit actions (PS B6).

            Each is offered only while the state machine would accept it. They
            used to be rendered unconditionally, so the screen invited an action
            the server was certain to refuse and then showed the refusal as an
            error. A control that cannot work should not be there. */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => act(() => api.allocate(ref, { objective }),
                               'Suggested split accepted — stock reserved.')}
            hidden={!!status && !status.can_allocate}
            disabled={busy || split.allocations.length === 0}
            className="rounded-full bg-fg text-white px-5 py-2.5 font-display text-[13px]
                       font-semibold hover:shadow-lift-lg active:scale-[.98] disabled:opacity-35"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            Accept Suggested Split
          </button>
          <button
            onClick={() => setManual(Object.fromEntries(
              split.allocations.map(a => [`${a.warehouse}|${a.sku}`, a.qty])))}
            hidden={!!status && !status.can_allocate}
            disabled={busy || split.allocations.length === 0}
            className="rounded-full ring-1 ring-black/[.09] bg-surface px-5 py-2.5
                       font-display text-[13px] font-semibold text-fg
                       hover:ring-accent/40 hover:text-accent disabled:opacity-35"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            Manual Override
          </button>
          <button
            onClick={confirmAndShip}
            hidden={!!status && !status.can_ship}
            disabled={busy}
            className="rounded-full ring-1 ring-band-auto/30 bg-band-autoWash text-band-auto
                       px-5 py-2.5 font-display text-[13px] font-semibold
                       hover:shadow-lift active:scale-[.98] disabled:opacity-35"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            Confirm &amp; Ship
          </button>
          {status && !status.can_allocate && !status.can_ship && (
            <p className="text-[12.5px] text-fg-2">
              {status.state === 'PAID'
                ? 'This order has shipped, been invoiced and been paid.'
                : 'The goods have shipped. What remains is billing, below.'}
            </p>
          )}
          <p className="text-[12px] text-fg-3 basis-full">
            Accepting reserves stock against this order. Confirming ships it &mdash; on-hand and
            reserved both fall, and the movement is written to the stock ledger.
          </p>
        </div>

        {/* Order logistics and settlement.

            Rendered from the ORDER'S state, not from the result of a click. It
            was gated on `shipped`, a variable set only by confirmAndShip in the
            current session, so reloading the page on an order that had already
            shipped, been invoiced and been paid showed none of it. The money
            half of quote-to-cash existed but was unreachable. */}
        {status && (status.shipped.length > 0 || liveInvoice) && (
          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Logistics &amp; settlement</span>
              <span className="key text-fg-3">{ref}</span>
            </div>

            <div className="px-4 py-3.5 flex flex-col gap-3.5">
              {status.shipped.length > 0 && (
                <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
                  <div className="rail rail-auto flex flex-col gap-0.5">
                    <span className="metric-label">Tracking</span>
                    <span className="key text-fg text-[13px]">
                      {shipped?.tracking ?? `CLNCH-${ref.replace(/[^0-9]/g, '')}`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="metric-label">Dispatched from</span>
                    <span className="text-[12.5px] text-fg">
                      {status.shipped.map(m =>
                        `${m.qty}x ${m.sku} from ${m.warehouse}`).join(' \u00b7 ')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="metric-label">Shipped</span>
                    <span className="text-[12.5px] text-fg">
                      {when(status.shipped[0]?.at) ?? '\u2014'}
                    </span>
                  </div>
                </div>
              )}

              {/* Billing. */}
              {!liveInvoice ? (
                status.can_invoice ? (
                  <div className="border-t border-line pt-3.5">
                    <button onClick={generateInvoice} disabled={busy} className="ctl ctl-primary">
                      Generate invoice &amp; billing schedule
                    </button>
                    <p className="mt-2 text-[12px] text-fg-3">
                      Raises the invoice, including any recurring lines on their own schedule.
                      It appears in the customer&rsquo;s portal immediately, where they can pay it.
                    </p>
                  </div>
                ) : null
              ) : (
                <div className="border-t border-line pt-3.5 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="metric-label">Invoice</span>
                      <span className="key text-fg text-[13px]">{liveInvoice.ref}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="metric-label">Amount</span>
                      <AnimatedNumber
                        value={liveInvoice.amount} format="inr"
                        className="font-display text-[17px] font-bold text-fg leading-none"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="metric-label">Outstanding</span>
                      <span className={cn('font-mono text-[15px] font-semibold tabular-nums',
                        (liveInvoice.outstanding ?? 0) > 0 ? 'text-band-finance' : 'text-band-auto')}>
                        {inr(liveInvoice.outstanding ?? 0)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="metric-label">Status</span>
                      <span className={cn('font-mono text-[12px] font-semibold uppercase',
                        String(liveInvoice.status).toLowerCase() === 'paid'
                          ? 'text-band-auto' : 'text-band-finance')}>
                        {liveInvoice.status}
                      </span>
                    </div>
                    {liveInvoice.paid_at && (
                      <div className="flex flex-col gap-0.5">
                        <span className="metric-label">Settled</span>
                        <span className="text-[12.5px] text-fg">
                          {when(liveInvoice.paid_at)}
                          {liveInvoice.method_label ? ` \u00b7 ${liveInvoice.method_label}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {(liveInvoice.payments?.length ?? 0) > 0 && (
                    <div className="flex flex-col gap-1 border-t border-line pt-2.5">
                      <span className="metric-label">Payments received</span>
                      {liveInvoice.payments.map((pmt: any, i: number) => (
                        <div key={i} className="flex items-baseline justify-between gap-4
                                                font-mono text-[11.5px] tabular-nums">
                          <span className="text-fg-3">
                            {when(pmt.at)}{pmt.method_label ? ` \u00b7 ${pmt.method_label}` : ''}
                          </span>
                          <span className="text-fg">{inr(pmt.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-3">
                    <button onClick={() => api.downloadInvoice(liveInvoice.ref)} className="ctl">
                      Download PDF
                    </button>
                    <button onClick={() => navigate('/app/invoices')} className="ctl">
                      Open in Invoices
                    </button>

                    {status.can_take_payment ? (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-[12px] text-fg-3">Register payment</span>
                        <select
                          value={method}
                          onChange={e => setMethod(e.target.value)}
                          aria-label="Payment method"
                          className="rounded-lg bg-surface px-2.5 py-1.5 text-[12.5px] text-fg-2
                                     ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                        >
                          {(methods.length ? methods
                            : [{ key: 'bank_transfer', label: 'Bank transfer' }]).map(m => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                        <button onClick={registerPayment} disabled={paying}
                                className="ctl ctl-primary">
                          {paying ? 'Recording\u2026' : `Record ${inr(liveInvoice.outstanding ?? 0)}`}
                        </button>
                      </div>
                    ) : (
                      <span className="ml-auto text-[12.5px] text-band-auto font-medium">
                        Settled &mdash; this deal is closed.
                      </span>
                    )}
                  </div>

                  <p className="text-[12px] text-fg-3">
                    The customer can also settle this themselves from their portal; either way
                    it lands on the same invoice.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </Workspace>
  )
}
