import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, inr, type Warehouse } from '../lib/api'
import { ErrorBar, Workspace } from '../components/Workspace'
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
interface Split {
  ref: string; objective: string
  allocations: Allocation[]
  backorders: Array<{ sku: string; name: string; qty: number; status: string }>
  shipment_count: number; total_cost: number
  warehouses_used: string[]; subsets_evaluated: number
  fully_allocated: boolean; consolidation_available: boolean
  explanation: string
}

export default function FulfilmentDetail() {
  const { ref = '' } = useParams()
  const [objective, setObjective] = useState<'cost' | 'shipments'>('cost')
  const [split, setSplit] = useState<Split | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [consolidated, setConsolidated] = useState<Split | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState<Record<string, number> | null>(null)

  const load = useCallback(() => {
    if (!ref) return
    Promise.all([api.split(ref, objective), api.warehouses()])
      .then(([s, w]) => { setSplit(s); setWarehouses(w); setError(null); setManual(null) })
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

        {/* Headline numbers */}
        <div className="grid sm:grid-cols-4 gap-3">
          {[
            { label: 'Units allocated', value: split.allocations.reduce((a, x) => a + x.qty, 0) },
            { label: 'Shipments', value: split.shipment_count },
            { label: 'Shipping cost', value: inr(split.total_cost) },
            { label: 'Backordered', value: backCount, alert: backCount > 0 },
          ].map(s => (
            <div key={s.label} className="rounded-2xl bg-surface ring-1 ring-black/[.055] p-4 shadow-lift">
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

        {/* Per-depot breakdown */}
        <section className="panel">
          <div className="px-4 py-3 border-b border-line flex items-center gap-3">
            <h2 className="font-display text-[14px] font-semibold text-fg">Suggested split</h2>
            <span className="font-mono text-[10.5px] text-fg-3">
              optimal over {split.subsets_evaluated} warehouse combination(s)
            </span>
          </div>
          <div className="scroll-x">
            <table className="w-full text-[13px] min-w-[620px]">
              <thead>
                <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                               border-b border-line">
                  <th className="text-left font-medium px-4 py-2.5">Warehouse</th>
                  <th className="text-left font-medium px-3 py-2.5">Lines</th>
                  <th className="text-right font-medium px-3 py-2.5 w-32">Qty fulfilled</th>
                  <th className="text-right font-medium px-4 py-2.5 w-32">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byDepot.map(d => (
                  <tr key={d.name} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-fg">{d.name}</td>
                    <td className="px-3 py-3">
                      {d.lines.map(l => (
                        <div key={l.sku} className="text-[12.5px] text-fg-2">
                          {l.name} <span className="font-mono text-fg-3">×{l.qty}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-fg font-semibold">
                      {d.qty}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg-2">
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
          <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] p-4 shadow-lift">
            <h2 className="font-display text-[14px] font-semibold text-fg mb-1">Manual override</h2>
            <p className="text-[12.5px] text-fg-2 mb-3">
              Set the quantity to take from each depot. Available stock is shown per depot;
              committing more than is available is refused.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {warehouses.map(w => {
                const sku = split.allocations[0]?.sku
                const avail = w.stock.find(s => s.sku === sku)?.available ?? 0
                return (
                  <label key={w.name} className="flex items-center gap-3">
                    <span className="text-[13px] text-fg flex-1">{w.name}</span>
                    <span className="font-mono text-[11px] text-fg-3">{avail} free</span>
                    <input
                      type="number" min={0} max={avail}
                      value={manual[w.name] ?? 0}
                      onChange={e => setManual({ ...manual, [w.name]: Number(e.target.value) })}
                      className="w-20 rounded-lg bg-surface px-2 py-1 text-center font-mono
                                 tabular-nums text-fg ring-1 ring-black/[.08]
                                 outline-none focus:ring-accent/40"
                    />
                  </label>
                )
              })}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => act(() => api.allocate(ref, {
                  allocations: Object.entries(manual)
                    .filter(([, q]) => q > 0)
                    .map(([warehouse, qty]) => ({
                      warehouse, qty,
                      sku: split.allocations[0]?.sku ?? '',
                      name: split.allocations[0]?.name ?? '',
                      unit_ship_cost: warehouses.find(w => w.name === warehouse)?.ship_cost_weight ?? 1,
                    })),
                }), 'Manual allocation committed.')}
                disabled={busy}
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

        {/* Commit actions (PS B6) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => act(() => api.allocate(ref, { objective }),
                               'Suggested split accepted — stock reserved.')}
            disabled={busy || split.allocations.length === 0}
            className="rounded-full bg-fg text-white px-5 py-2.5 font-display text-[13px]
                       font-semibold hover:shadow-lift-lg active:scale-[.98] disabled:opacity-35"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            Accept Suggested Split
          </button>
          <button
            onClick={() => setManual(Object.fromEntries(byDepot.map(d => [d.name, d.qty])))}
            disabled={busy || split.allocations.length === 0}
            className="rounded-full ring-1 ring-black/[.09] bg-surface px-5 py-2.5
                       font-display text-[13px] font-semibold text-fg
                       hover:ring-accent/40 hover:text-accent disabled:opacity-35"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            Manual Override
          </button>
          <button
            onClick={() => act(() => api.confirmOrder(ref),
                               'Order fulfilled — reserved stock has shipped.')}
            disabled={busy}
            className="rounded-full ring-1 ring-band-auto/30 bg-band-autoWash text-band-auto
                       px-5 py-2.5 font-display text-[13px] font-semibold
                       hover:shadow-lift active:scale-[.98] disabled:opacity-35"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            Confirm &amp; Ship
          </button>
          <p className="text-[12px] text-fg-3 basis-full">
            Accepting reserves stock against this order. Confirming ships it — on-hand and
            reserved both fall, and the movement is written to the stock ledger.
          </p>
        </div>
      </div>
    </Workspace>
  )
}
