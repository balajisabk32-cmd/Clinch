import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Rows3, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { Band } from '../components/ui'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { ErrorBar, Workspace } from '../components/Workspace'
import { cn } from '../lib/cn'

/**
 * Quotations — list and pipeline (wireframe screen 3, PS B2).
 *
 * DESIGN READ: work queue for an operator who already knows what they are
 * looking for. Instrument panel language, density 9.
 *
 * Two views of one set. The table is for scanning forty rows for the one that
 * is bleeding; the pipeline is for seeing where the book is stuck. Both were
 * previously built from floating `rounded-xl` cards with shadow and hover-lift,
 * which is the pattern that makes twelve quotations fill a screen — so the
 * table is now a real hairline grid and the pipeline columns carry their own
 * running totals, which is the number an operator actually wants from a column.
 */

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

const railFor = (r: Row) =>
  r.is_stalled ? 'rail-finance'
    : r.risk_band === 'FINANCE' ? 'rail-finance'
      : r.risk_band === 'MANAGER' ? 'rail-manager'
        : r.risk_band === 'AUTO' ? 'rail-auto' : 'rail-idle'

export default function Quotations({ view = 'list' }: { view?: 'list' | 'pipeline' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isRep = user?.role === 'rep'
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'list' | 'pipeline'>(view)
  const [newFor, setNewFor] = useState(CUSTOMERS[0])
  const [query, setQuery] = useState('')

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
  const displayRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.customer.toLowerCase().includes(q) ||
      r.ref.toLowerCase().includes(q) ||
      r.rep.toLowerCase().includes(q) ||
      r.state.toLowerCase().includes(q))
  }, [rows, query])

  const bookValue = displayRows.reduce((a, r) => a + r.total, 0)

  /* Pipeline card. Chamfer-free on purpose: inside a column these are list
     items, and six chamfers per column would be noise rather than signal. */
  const Card = ({ r }: { r: Row }) => (
    <button
      onClick={() => navigate(`/app/quotations/${r.ref}`)}
      className={cn(
        'w-full text-left bg-surface ring-1 ring-black/[.06] rounded-md px-2.5 py-2',
        'rail hover:ring-accent/40 hover:bg-accent-wash/40 transition-colors duration-150',
        railFor(r),
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-fg truncate">{r.customer}</span>
        <AnimatedNumber
          value={r.total}
          format="inr-compact"
          flash={false}
          className="text-[11.5px] font-semibold text-fg shrink-0"
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="key text-fg-3 text-[10.5px]">{r.ref} · {r.tier}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-fg-3">
          {r.risk_score.toFixed(1)}
        </span>
      </div>
      {r.is_stalled && (
        <div className="mt-1 font-mono text-[9.5px] font-semibold text-band-finance">
          STALLED · {r.days_inactive}d idle
        </div>
      )}
    </button>
  )

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-3">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">
            {mode === 'pipeline' ? 'Pipeline' : 'Quotations'}
          </h1>
          <p className="text-[12px] text-fg-3 flex items-baseline gap-1">
            <AnimatedNumber value={displayRows.length} format="int" className="text-[12px]" />
            {' '}in governance cycle ·
            <AnimatedNumber
              value={bookValue}
              format="inr-compact"
              flash={false}
              className="text-[12px] text-fg-2 font-semibold"
            />
            {' '}book value
          </p>

          <div className="ml-auto flex items-center gap-1.5">
            <label className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-4" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter by customer, ref, rep…"
                className="w-[220px] rounded-md bg-surface pl-7 pr-2.5 py-1.5 text-[12px] text-fg
                           ring-1 ring-black/[.08] outline-none focus:ring-accent/45
                           placeholder:text-fg-4"
              />
            </label>

            {/* Segmented control — states sit side by side rather than a button
                that renames itself, so the current view is legible at rest. */}
            <div className="inline-flex rounded-md ring-1 ring-black/[.08] bg-surface p-0.5">
              {([['list', Rows3, 'Table'], ['pipeline', LayoutGrid, 'Pipeline']] as const).map(
                ([m, Icon, label]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    title={`${label} view`}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium',
                      'transition-colors duration-150',
                      mode === m ? 'bg-fg text-white' : 'text-fg-3 hover:text-fg',
                    )}
                  >
                    <Icon size={12} />{label}
                  </button>
                ))}
            </div>

            {isRep && (
              <>
                <select
                  value={newFor}
                  onChange={e => setNewFor(e.target.value)}
                  className="rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-fg
                             ring-1 ring-black/[.08] outline-none focus:ring-accent/45"
                  aria-label="Customer for new quotation"
                >
                  {CUSTOMERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={create} disabled={busy} className="ctl ctl-primary">
                  {busy ? 'Creating…' : '+ New Quotation'}
                </button>
              </>
            )}
          </div>
        </header>

        {displayRows.length === 0 && !error && (
          <div className="panel px-4 py-16 text-center">
            <p className="text-[12.5px] text-fg-3">
              {query
                ? <>Nothing matches “{query}”.</>
                : isRep ? 'No open quotations. Create one to get started.'
                  : 'No open quotations.'}
            </p>
          </div>
        )}

        {mode === 'pipeline' ? (
          <div className="scroll-x pb-1">
            <div className="grid gap-2.5"
                 style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(196px, 1fr))` }}>
              {STAGES.map(st => {
                const inStage = displayRows.filter(r => r.state === st.key)
                const stageValue = inStage.reduce((a, r) => a + r.total, 0)
                return (
                  <div key={st.key} className="flex flex-col gap-2 min-w-0">
                    {/* Column header carries the money, which is the number an
                        operator wants from a stage — not just the count. */}
                    <div className="panel-sq px-2.5 py-2 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="panel-title truncate">{st.label}</span>
                        <AnimatedNumber
                          value={inStage.length}
                          format="int"
                          className="text-[11px] text-fg-3"
                        />
                      </div>
                      <AnimatedNumber
                        value={stageValue}
                        format="inr-compact"
                        flash={false}
                        className="text-[13px] font-semibold text-fg"
                      />
                    </div>
                    {inStage.map(r => <Card key={r.ref} r={r} />)}
                    {inStage.length === 0 && (
                      <div className="rounded-md border border-dashed border-line-2 py-5 text-center
                                      text-[11px] text-fg-4">
                        Empty
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : displayRows.length > 0 && (
          <div className="panel">
            <div className="scroll-x">
              <table className="grid-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Customer</th>
                    <th>Tier</th>
                    <th>Rep</th>
                    <th>Status</th>
                    <th>Band</th>
                    <th className="text-right">Risk</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map(r => (
                    <tr
                      key={r.ref}
                      onClick={() => navigate(`/app/quotations/${r.ref}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <span className={cn('rail block', railFor(r))}>
                          <span className="key text-fg">{r.ref}</span>
                        </span>
                      </td>
                      <td className="text-fg font-medium">{r.customer}</td>
                      <td className="text-fg-3">{r.tier}</td>
                      <td className="text-fg-2">{r.rep}</td>
                      <td className="text-fg-2">
                        {r.state.replace(/_/g, ' ').toLowerCase()}
                        {r.is_stalled && (
                          <span className="ml-1.5 font-mono text-[9.5px] font-semibold text-band-finance">
                            {r.days_inactive}d idle
                          </span>
                        )}
                      </td>
                      <td><Band band={r.risk_band} /></td>
                      <td className="num text-fg-2">
                        <AnimatedNumber
                          value={r.risk_score} format="dec" precision={1}
                          polarity="lower-better" flash={false}
                        />
                      </td>
                      <td className="num text-fg font-medium">
                        <AnimatedNumber value={r.total} format="inr" flash={false} />
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
