import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, inr } from '../lib/api'
import { Band } from '../components/ui'
import { ErrorBar, Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'

interface Row {
  ref: string; customer: string; tier: string; rep: string; state: string
  total: number; risk_score: number; risk_band: string
  days_inactive: number; is_stalled: boolean
  is_customer?: boolean
  source?: string
  is_unassigned?: boolean
  rep_id?: string
  assigned_rep_id?: string
}

/** Kanban stages, in lifecycle order (PS B2). */
const STAGES = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_MANAGER', label: 'Pending Approval' },
  { key: 'PENDING_FINANCE', label: 'Pending Finance' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'NEGOTIATION', label: 'Negotiation' },
  { key: 'CONFIRMED', label: 'Confirmed' },
]

const CUSTOMERS = ['Acme Corp', 'Beta Industries', 'Nova Retail', 'Zenith Co',
                   'Delta LLC', 'Orion Systems', 'Vertex Labs']

export default function Quotations({ view = 'list' }: { view?: 'list' | 'pipeline' }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'list' | 'pipeline'>(view)
  const [filter, setFilter] = useState<'all' | 'customer' | 'rep_created' | 'unassigned'>('all')
  const [newFor, setNewFor] = useState(CUSTOMERS[0])

  const load = useCallback(() => {
    api.quotes().then(r => { setRows(r); setError(null) })
      .catch(e => setError(`Could not load quotations (${e?.message ?? 'unknown'}).`))
  }, [])
  useEffect(load, [load])

  const create = async () => {
    setBusy(true)
    try {
      const q = await api.createQuote(newFor)
      navigate(`/app/quotations/${q.ref}`)
    } catch (e: any) {
      setError(`Could not create quotation (${e?.message ?? 'unknown'}).`)
    } finally { setBusy(false) }
  }

  // Filter display rows
  const displayRows = rows.filter(r => {
    const isCust = r.source === 'Customer Request' || r.is_customer
    const isUnassigned = r.is_unassigned || r.rep === 'Unassigned'
    if (filter === 'customer') return isCust && !isUnassigned
    if (filter === 'rep_created') return !isCust && !isUnassigned
    if (filter === 'unassigned') return isUnassigned
    return true
  })

  const custCount = rows.filter(r => (r.source === 'Customer Request' || r.is_customer) && !r.is_unassigned && r.rep !== 'Unassigned').length
  const repCount = rows.filter(r => r.source !== 'Customer Request' && !r.is_customer && !r.is_unassigned && r.rep !== 'Unassigned').length
  const unassignedCount = rows.filter(r => r.is_unassigned || r.rep === 'Unassigned').length

  const Card = ({ r }: { r: Row }) => {
    const isCust = r.source === 'Customer Request' || r.is_customer
    const isUnassigned = r.is_unassigned || r.rep === 'Unassigned'
    return (
      <button
        onClick={() => navigate(`/app/quotations/${r.ref}`)}
        className="w-full text-left rounded-xl bg-surface ring-1 ring-black/[.055] p-3.5 shadow-lift
                   hover:ring-accent/35 hover:-translate-y-0.5"
        style={{ transition: `all 320ms ${EASE_CSS}` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-display text-[14px] font-semibold text-fg leading-tight truncate">
              <span>{r.customer}</span>
              {isUnassigned ? (
                <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 px-1.5 py-0.5 text-[9px] font-bold shrink-0">
                  ⚠️ Unassigned
                </span>
              ) : isCust ? (
                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 px-1.5 py-0.5 text-[9px] font-bold shrink-0">
                  🛒 Customer Request
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 ring-1 ring-zinc-400/20 px-1.5 py-0.5 text-[9px] font-medium shrink-0">
                  👤 Rep Created
                </span>
              )}
            </div>
            <div className="font-mono text-[10.5px] text-fg-3 mt-1">
              {r.ref} · {r.tier} · {r.rep}
            </div>
          </div>
          <Band band={r.risk_band} />
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="font-display text-[16px] font-bold text-fg tabular-nums">{inr(r.total)}</span>
          <span className="font-mono text-[11px] text-fg-3 tabular-nums">
            risk {r.risk_score.toFixed(1)}
          </span>
        </div>
        {r.is_stalled && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-band-financeWash
                          px-2 py-0.5 font-mono text-[9.5px] font-semibold text-band-finance">
            STALLED · {r.days_inactive}d idle
          </div>
        )}
      </button>
    )
  }

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-[22px] font-bold text-fg">
              {mode === 'pipeline' ? 'Pipeline' : 'Quotations'}
            </h1>
            <p className="text-[12px] text-fg-3 mt-0.5">
              {`${displayRows.length} active quotations in governance cycle.`}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Filter Toggle: All vs Customer Requests vs Rep Created vs Unassigned */}
            <div className="inline-flex rounded-full bg-surface-2 p-0.5 ring-1 ring-black/[.06]">
              <button
                onClick={() => setFilter('all')}
                className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-all ${
                  filter === 'all' ? 'bg-surface text-fg shadow-sm' : 'text-fg-3 hover:text-fg'
                }`}
              >
                All ({rows.length})
              </button>
              <button
                onClick={() => setFilter('customer')}
                className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-all flex items-center gap-1.5 ${
                  filter === 'customer' ? 'bg-[#0d1b2a] text-white shadow-sm' : 'text-fg-3 hover:text-fg'
                }`}
              >
                <span>🛒 Customer Requests</span>
                <span className="rounded-full bg-blue-500/20 px-1.5 py-0.2 text-[10px] font-mono">
                  {custCount}
                </span>
              </button>
              <button
                onClick={() => setFilter('rep_created')}
                className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-all flex items-center gap-1.5 ${
                  filter === 'rep_created' ? 'bg-[#0d1b2a] text-white shadow-sm' : 'text-fg-3 hover:text-fg'
                }`}
              >
                <span>👤 Rep Created</span>
                <span className="rounded-full bg-zinc-500/20 px-1.5 py-0.2 text-[10px] font-mono">
                  {repCount}
                </span>
              </button>
              {unassignedCount > 0 && (
                <button
                  onClick={() => setFilter('unassigned')}
                  className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-all flex items-center gap-1.5 ${
                    filter === 'unassigned' ? 'bg-rose-700 text-white shadow-sm' : 'text-rose-600 hover:text-rose-700'
                  }`}
                >
                  <span>⚠️ Unassigned</span>
                  <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                    {unassignedCount}
                  </span>
                </button>
              )}
            </div>

            {(
              <>
                <button
                  onClick={() => setMode(m => (m === 'list' ? 'pipeline' : 'list'))}
                  className="rounded-full px-3 py-1.5 text-[12.5px] text-fg-2 bg-surface
                             ring-1 ring-black/[.07] hover:text-accent hover:ring-accent/35"
                  style={{ transition: `all 320ms ${EASE_CSS}` }}
                >
                  {mode === 'list' ? 'Switch to Pipeline View' : 'Switch to Table View'}
                </button>
                <select
                  value={newFor}
                  onChange={e => setNewFor(e.target.value)}
                  className="rounded-full bg-surface px-3 py-1.5 text-[12.5px] text-fg
                             ring-1 ring-black/[.07] outline-none focus:ring-accent/40"
                  aria-label="Customer for new quotation"
                >
                  {CUSTOMERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={create}
                  disabled={busy}
                  className="rounded-full bg-fg text-white px-4 py-1.5 font-display text-[12.5px]
                             font-semibold hover:shadow-lift-lg active:scale-[.98] disabled:opacity-40"
                  style={{ transition: `all 320ms ${EASE_CSS}` }}
                >
                  + New Quotation
                </button>
              </>
            )}
          </div>
        </header>

        {displayRows.length === 0 && !error && (
          <p className="py-16 text-center text-[13px] text-fg-3">
            No open quotations. Create one to get started.
          </p>
        )}

        {mode === 'pipeline' ? (
          <div className="grid gap-3 overflow-x-auto"
               style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(210px, 1fr))` }}>
            {STAGES.map(st => {
              const inStage = displayRows.filter(r => r.state === st.key)
              return (
                <div key={st.key} className="flex flex-col gap-2.5 min-w-0">
                  <div className="flex items-center gap-2 px-1">
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                      {st.label}
                    </span>
                    <span className="font-mono text-[10px] text-fg-4 tabular-nums">{inStage.length}</span>
                  </div>
                  {inStage.map(r => <Card key={r.ref} r={r} />)}
                  {inStage.length === 0 && (
                    <div className="rounded-xl border border-dashed border-line-2 py-6 text-center
                                    text-[11.5px] text-fg-4">
                      Empty
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[760px]">
                <thead>
                  <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3 border-b border-line">
                    <th className="text-left font-medium px-4 py-2.5">Quotation</th>
                    <th className="text-left font-medium px-3 py-2.5">Status</th>
                    {(
              <>
                        <th className="text-left font-medium px-3 py-2.5">Rep</th>
                        <th className="text-right font-medium px-3 py-2.5">Risk</th>
                        <th className="text-left font-medium px-3 py-2.5">Band</th>
                      </>
                    )}
                    <th className="text-right font-medium px-4 py-2.5">Amount</th>
                                      </tr>
                </thead>
                <tbody>
                  {displayRows.map(r => (
                    <tr
                      key={r.ref}
                      onClick={() => navigate(`/app/quotations/${r.ref}`)}
                      className="border-b border-line last:border-0 cursor-pointer hover:bg-surface-2/60"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-fg">{r.customer}</span>
                          {r.is_unassigned || r.rep === 'Unassigned' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 px-2 py-0.5 text-[10px] font-bold">
                              <span>⚠️ Unassigned</span>
                            </span>
                          ) : (r.source === 'Customer Request' || r.is_customer) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 px-2 py-0.5 text-[10px] font-bold">
                              <span>🛒 Customer Request</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 text-zinc-600 ring-1 ring-zinc-400/20 px-2 py-0.5 text-[10px] font-medium">
                              <span>👤 Rep Created</span>
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10.5px] text-fg-3 mt-0.5">
                          {r.ref} · {r.tier} Tier
                          {r.is_stalled && (
                            <span className="ml-2 text-band-finance">· stalled {r.days_inactive}d</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-fg-2 font-medium">
                        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px]">
                          {r.state.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.is_unassigned || r.rep === 'Unassigned' ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-md text-[11px]">
                            Unassigned
                          </span>
                        ) : (
                          <span className="text-fg-2 font-medium">{r.rep}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">
                        {r.risk_score.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5"><Band band={r.risk_band} /></td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-fg">
                        {inr(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Workspace>
  )
}
