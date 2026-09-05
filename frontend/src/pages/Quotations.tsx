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

  // NOTE: there is deliberately no client-side role filter here. This screen is
  // internal-only. A customer never reaches it -- they get the separately
  // served, field-redacted /portal payload. Filtering in the browser would
  // still transmit every quotation over the wire (PS §7).
  const displayRows = rows

  const Card = ({ r }: { r: Row }) => (
    <button
      onClick={() => navigate(`/app/quotations/${r.ref}`)}
      className="w-full text-left rounded-xl bg-surface ring-1 ring-black/[.055] p-3.5 shadow-lift
                 hover:ring-accent/35 hover:-translate-y-0.5"
      style={{ transition: `all 320ms ${EASE_CSS}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[14px] font-semibold text-fg leading-tight truncate">
            {r.customer}
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

          <div className="ml-auto flex items-center gap-2">
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
                        <div className="font-medium text-fg">{r.customer}</div>
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
                      <td className="px-3 py-2.5 text-fg-2">{r.rep}</td>
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
