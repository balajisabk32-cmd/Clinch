import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, inr, type QueueRow, type Warehouse } from '../lib/api'
import { ErrorBar, Workspace } from '../components/Workspace'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { EASE_CSS } from '../lib/motion'

/**
 * Fulfilment & Stock — wireframe screen 7, PS A4/B6.
 *
 * Two tables, exactly as the organisation's flow specifies: live stock per
 * depot, and the queue of orders waiting to ship. Both read the running engine;
 * the previous version of this screen rendered a hardcoded SEED_SHIPMENTS array.
 *
 * The stock grid shows all three quantities rather than just "in stock",
 * because on-hand alone is a number you must never sell against — units already
 * reserved for another order are physically present but already spoken for.
 */

const STATUS_TONE: Record<string, string> = {
  Ready: 'bg-band-autoWash text-band-auto ring-band-auto/25',
  'Split Pending': 'bg-band-managerWash text-band-manager ring-band-manager/25',
  Backorder: 'bg-band-financeWash text-band-finance ring-band-finance/25',
}

export default function Fulfilment() {
  const navigate = useNavigate()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    Promise.all([api.warehouses(), api.fulfilmentQueue()])
      .then(([w, q]) => { setWarehouses(w); setQueue(q); setError(null) })
      .catch(e => setError(`Could not load fulfilment data (${e?.message ?? 'unknown error'}).`))
  }, [])
  useEffect(load, [load])

  const needle = search.trim().toLowerCase()
  const matches = (n: string, s: string) =>
    !needle || n.toLowerCase().includes(needle) || s.toLowerCase().includes(needle)

  const totalUnits = queue.reduce((a, r) => a + r.units, 0)
  const totalBack = queue.reduce((a, r) => a + r.backordered, 0)

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-5">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-end gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">Fulfilment &amp; Warehouse Dispatch</h1>
              <span className="rounded-full bg-blue-500/10 text-blue-700 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold ring-1 ring-blue-500/20">
                Finance Manager Only
              </span>
            </div>
            <p className="text-[12.5px] text-fg-3 mt-0.5">
              Manages warehouse fulfillment splits and backorder decisions across live regional depots.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-6 font-mono text-[12px] tabular-nums">
            <span className="text-fg-3">Awaiting <b className="text-fg ml-1.5">{queue.length}</b></span>
            <span className="text-fg-3">Units <b className="text-fg ml-1.5">{totalUnits}</b></span>
            <span className="text-fg-3">
              Backordered <b className={`ml-1.5 ${totalBack ? 'text-band-finance' : 'text-fg'}`}>{totalBack}</b>
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product or order…"
              className="w-52 rounded-full bg-surface px-3.5 py-1.5 text-[12.5px] text-fg
                         ring-1 ring-black/[.07] outline-none focus:ring-accent/40
                         placeholder:text-fg-4 font-sans"
            />
          </div>
        </header>

        {/* ── Stock per warehouse ─────────────────────────────────── */}
        <section className="grid lg:grid-cols-2 gap-4">
          {warehouses.map(w => {
            const rows = w.stock.filter(s => matches(s.name, s.sku))
            const low = rows.filter(s => s.available <= s.reorder_point).length
            return (
              <div key={w.name}
                   className="panel">
                <div className="px-4 py-3 border-b border-line flex items-center gap-3">
                  <h2 className="font-display text-[14px] font-semibold text-fg">{w.name}</h2>
                  <span className="font-mono text-[10.5px] text-fg-3">
                    ship ×{w.ship_cost_weight} · fixed {inr(w.fixed_shipment_cost)}
                  </span>
                  {low > 0 && (
                    <span className="ml-auto rounded-full bg-band-managerWash text-band-manager
                                     px-2 py-0.5 font-mono text-[9.5px] font-semibold
                                     ring-1 ring-band-manager/20">
                      {low} AT / BELOW REORDER
                    </span>
                  )}
                </div>
                <div className="scroll-x">
                  <table className="grid-table min-w-[420px]">
                    <thead>
                      <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                                     border-b border-line">
                        <th className="text-left font-medium px-4 py-2">Product</th>
                        <th className="text-right font-medium px-3 py-2 w-24">In stock</th>
                        <th className="text-right font-medium px-3 py-2 w-24">Reserved</th>
                        <th className="text-right font-medium px-4 py-2 w-24">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(s => {
                        const scarce = s.available === 0
                        return (
                          <tr key={s.sku} className="border-b border-line last:border-0">
                            <td className="px-4 py-2">
                              <div className="text-fg">{s.name}</div>
                              <div className="font-mono text-[10px] text-fg-3">{s.sku}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-fg-2">
                              {s.on_hand}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-fg-3">
                              {s.reserved > 0 ? s.reserved : '—'}
                            </td>
                            <td className={`px-4 py-2 text-right font-mono tabular-nums font-semibold
                                            ${scarce ? 'text-band-finance' : 'text-fg'}`}>
                              {s.available}
                            </td>
                          </tr>
                        )
                      })}
                      {rows.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-[12.5px] text-fg-3">
                          No products match “{search}”.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
          {warehouses.length === 0 && !error && (
            <p className="text-[13px] text-fg-3">Loading stock…</p>
          )}
        </section>

        {/* ── Orders awaiting fulfilment ──────────────────────────── */}
        <section className="panel">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-display text-[14px] font-semibold text-fg">
              Orders Awaiting Fulfilment
            </h2>
            <p className="text-[11.5px] text-fg-3 mt-0.5">
              Click an order to review and commit its warehouse split.
            </p>
          </div>

          {queue.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-fg-3">
              Nothing awaiting despatch. Orders appear here once approved.
            </p>
          ) : (
            <div className="scroll-x">
              <table className="grid-table min-w-[720px]">
                <thead>
                  <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                                 border-b border-line">
                    <th className="text-left font-medium px-4 py-2.5">Order</th>
                    <th className="text-left font-medium px-3 py-2.5">Customer</th>
                    <th className="text-left font-medium px-3 py-2.5 w-36">Status</th>
                    <th className="text-left font-medium px-3 py-2.5">Warehouse</th>
                    <th className="text-right font-medium px-3 py-2.5 w-20">Units</th>
                    <th className="text-right font-medium px-4 py-2.5 w-28">Ship cost</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.filter(r => matches(r.customer, r.ref)).map(r => (
                    <tr
                      key={r.ref}
                      onClick={() => navigate(`/app/fulfilment/${r.ref}`)}
                      className="border-b border-line last:border-0 cursor-pointer hover:bg-surface-2/60"
                      style={{ transition: `background 200ms ${EASE_CSS}` }}
                    >
                      <td className="px-4 py-2.5 font-mono text-fg">{r.ref}</td>
                      <td className="px-3 py-2.5 text-fg font-medium">{r.customer}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full ring-1 px-2.5 py-0.5 font-mono text-[10px]
                                          font-semibold ${STATUS_TONE[r.status] ?? ''}`}>
                          {r.status}
                        </span>
                        {r.allocated && (
                          <span className="ml-2 font-mono text-[9.5px] text-band-auto">COMMITTED</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-fg-2">{r.warehouse_label}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">
                        {r.units}
                        {r.backordered > 0 && (
                          <span className="block text-[10px] text-band-finance">
                            +{r.backordered} back
                          </span>
                        )}
                      </td>
                      <td className="num text-fg-2">
                        <AnimatedNumber value={r.total_cost} format="inr"
                                        polarity="lower-better" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Workspace>
  )
}
