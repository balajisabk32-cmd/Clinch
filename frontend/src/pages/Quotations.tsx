import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, LayoutGrid, Rows3, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, inr } from '../lib/api'
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
  is_customer?: boolean
  source?: string
  is_unassigned?: boolean
  rep_id?: string
  assigned_rep_id?: string
  revision_requested?: boolean
  manager_revision_notes?: string | null
  approved_by_name?: string | null
  revision_count?: number
  awaiting_customer?: boolean
}

/** Kanban stages, in lifecycle order (PS B2). */
/* Kanban columns, in lifecycle order (PS B2).

   "Revision required" is not a state on the server -- it is DRAFT carrying a
   manager's note. It gets its own column because those two are the same thing
   to the engine and completely different things to a rep: one is work not
   started, the other is work handed back with a reason. */
const STAGES: Array<{ key: string; label: string; match?: (r: Row) => boolean }> = [
  { key: 'REVISION', label: 'Revision required',
    match: r => r.state === 'DRAFT' && !!r.revision_requested },
  { key: 'DRAFT', label: 'Draft',
    match: r => r.state === 'DRAFT' && !r.revision_requested },
  { key: 'PENDING_MANAGER', label: 'Pending manager' },
  { key: 'PENDING_FINANCE', label: 'Pending finance' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'NEGOTIATION', label: 'Negotiation' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'FULFILLED', label: 'Fulfilled' },
  { key: 'SETTLED', label: 'Invoiced / paid',
    match: r => r.state === 'INVOICED' || r.state === 'PAID' },
]

/* The account list comes from the server (/my/customers), which returns only
   the firms this rep owns. It was a hardcoded list of all seven, so a rep could
   pick a customer belonging to someone else and the create would 403. */
interface AccountOption { name: string; tier: string; owner: string | null; is_mine: boolean }

const railFor = (r: Row) =>
  r.is_stalled ? 'rail-finance'
    : r.risk_band === 'FINANCE' ? 'rail-finance'
      : r.risk_band === 'MANAGER' ? 'rail-manager'
        : r.risk_band === 'AUTO' ? 'rail-auto' : 'rail-idle'

export default function Quotations({ view = 'list' }: { view?: 'list' | 'pipeline' }) {
  const navigate = useNavigate()
  const location = useLocation() as unknown as
    { pathname: string; state?: { flash?: string } }
  const [flash, setFlash] = useState<string | null>(location.state?.flash ?? null)
  const { user } = useAuth()
  const isRep = user?.role === 'rep'
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [params, setParams] = useSearchParams()
  const mode: 'list' | 'pipeline' =
    location.pathname.endsWith('/pipeline') ? 'pipeline'
      : params.get('view') === 'pipeline' ? 'pipeline'
        : params.get('view') === 'table' ? 'list'
          : view

  const setMode = (next: 'list' | 'pipeline') => {
    if (location.pathname.endsWith('/pipeline')) {
      navigate(next === 'pipeline' ? '/app/pipeline' : '/app/quotations')
    } else {
      setParams(next === 'pipeline' ? { view: 'pipeline' } : {}, { replace: true })
    }
  }

  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [newFor, setNewFor] = useState('')
  const [query, setQuery] = useState('')

  /* One strip, left to right in the order work actually moves:
     everything -> a customer asked -> nobody owns it -> a rep must act ->
     the customer has it -> a reviewer has it -> done.

     This replaced two competing strips. A second row offered
     All / Customer Requests / Rep Created / Unassigned while this one offered
     lifecycle stages, they overlapped on "Customer requests", and they were
     driven by different state (one from the URL, one from a useState), so the
     two could disagree and the selection did not survive a reload. */
  const TABS = [
    { key: 'all', label: 'All deals', match: (_r: Row) => true },
    { key: 'requests', label: 'Customer requests',
      match: (r: Row) => (r.source === 'Customer Request' || !!r.is_customer)
                      && !r.is_unassigned && r.rep !== 'Unassigned' },
    { key: 'unassigned', label: 'Unassigned',
      match: (r: Row) => !!r.is_unassigned || r.rep === 'Unassigned' },
    { key: 'action', label: 'Action required',
      match: (r: Row) => r.state === 'DRAFT' && !!r.revision_requested },
    { key: 'sent', label: 'With customer',
      match: (r: Row) => r.state === 'NEGOTIATION' },
    { key: 'queue', label: 'In approval',
      match: (r: Row) => r.state.startsWith('PENDING') },
    { key: 'done', label: 'Confirmed & fulfilled',
      match: (r: Row) => ['CONFIRMED', 'FULFILLED', 'INVOICED', 'PAID'].includes(r.state) },
  ] as const
  const tab = (params.get('tab') ?? 'all') as (typeof TABS)[number]['key']
  const activeTab = TABS.find(t => t.key === tab) ?? TABS[0]

  const load = useCallback(() => {
    api.quotes().then(r => { setRows(r); setError(null) })
      .catch(e => setError(`Could not load quotations (${e?.message ?? 'unknown'}).`))
  }, [])
  useEffect(load, [load])

  // Only a rep can author, so only a rep needs the list.
  useEffect(() => {
    if (!isRep) return
    api.myCustomers()
      .then(a => { setAccounts(a); setNewFor(prev => prev || a[0]?.name || '') })
      .catch(() => { /* the create control stays disabled without a book */ })
  }, [isRep])

  const create = async () => {
    setBusy(true)
    try {
      const q = await api.createQuote(newFor)
      navigate(`/app/quotations/${q.ref}`)
    } catch (e: any) {
      setError(`Could not create quotation (${e?.message ?? 'unknown'}).`)
    } finally { setBusy(false) }
  }

  const displayRows = useMemo(() => {
    const list = rows.filter(activeTab.match)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(r =>
      r.customer.toLowerCase().includes(q) ||
      r.ref.toLowerCase().includes(q) ||
      (r.rep && r.rep.toLowerCase().includes(q)) ||
      r.state.toLowerCase().includes(q)
    )
  }, [rows, activeTab, query])

  const bookValue = displayRows.reduce((a, r) => a + (r.total || 0), 0)
  const returned = rows.filter(r => r.state === 'DRAFT' && !!r.revision_requested)

  /* Pipeline card.

     Sized for the column it lives in. The previous version put the customer
     name, an 80-character "Customer Request" pill, a band pill, the ref, tier,
     rep, amount and risk into roughly 190px, so the name truncated to nothing
     and the badges wrapped onto their own lines at uneven heights. Origin is
     now a dot with a title rather than a pill -- the tab and the table already
     spell it out, and inside a column it only needs to be distinguishable. */
  const Card = ({ r }: { r: Row }) => {
    const isCust = r.source === 'Customer Request' || r.is_customer
    const isUnassigned = r.is_unassigned || r.rep === 'Unassigned'
    const origin = isUnassigned ? 'Unassigned - no rep on this deal'
      : isCust ? 'Raised by the customer'
      : 'Raised by the rep'
    return (
      <button
        onClick={() => navigate(`/app/quotations/${r.ref}`)}
        title={`${r.customer} - ${r.ref} - ${origin}`}
        className={cn(
          'w-full text-left rounded-md bg-surface ring-1 ring-black/[.06] px-2.5 py-2',
          'rail hover:ring-accent/40 hover:bg-accent-wash/40 transition-colors duration-150',
          railFor(r),
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            aria-hidden="true"
            className={cn('w-1.5 h-1.5 rounded-full shrink-0',
              isUnassigned ? 'bg-band-finance'
                : isCust ? 'bg-accent' : 'bg-fg-4')}
          />
          <span className="text-[12.5px] font-medium text-fg truncate flex-1">
            {r.customer}
          </span>
          <Band band={r.risk_band} />
        </div>

        <div className="mt-1 font-mono text-[10.5px] text-fg-3 truncate">
          {r.ref} · {r.tier}
          {isUnassigned
            ? <span className="text-band-finance"> · unassigned</span>
            : <> · {r.rep}</>}
        </div>

        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="font-display text-[13.5px] font-bold text-fg tabular-nums">
            {inr(r.total)}
          </span>
          <span className="font-mono text-[10.5px] tabular-nums text-fg-3">
            {r.risk_score.toFixed(1)}
          </span>
        </div>

        {r.is_stalled && (
          <div className="mt-1 font-mono text-[9.5px] font-semibold text-band-finance">
            STALLED · {r.days_inactive}d
          </div>
        )}
        {r.revision_requested && (
          <div className="mt-1 font-mono text-[9.5px] font-semibold text-band-manager">
            RETURNED FOR REVISION
          </div>
        )}
      </button>
    )
  }

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-3 w-full min-w-0 max-w-full">
        {error && <ErrorBar message={error} onRetry={load} />}

        {flash && (
          <div className="flex items-center justify-between rounded-xl bg-band-autoWash border border-band-auto/25 px-4 py-3 text-[13px] text-band-auto font-medium animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-band-auto shrink-0" />
              <span>{flash}</span>
            </div>
            <button
              onClick={() => setFlash(null)}
              className="text-band-auto/70 hover:text-band-auto text-xs font-mono px-2 py-0.5"
              aria-label="Dismiss message"
            >

            </button>
          </div>
        )}

        {/* Returned deals lead, because they are the only ones with someone
            waiting on this rep. The note is shown in full: a truncated
            instruction is an instruction the rep has to go and ask about. */}
        {returned.length > 0 && tab !== 'action' && (
          <button
            onClick={() => setParams({ tab: 'action' }, { replace: true })}
            className="text-left rounded-xl bg-band-managerWash border border-band-manager/25
                       px-4 py-3 flex items-start gap-2.5 hover:border-band-manager/45
                       transition-colors"
          >
            <AlertTriangle size={16} className="text-band-manager shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-band-manager">
                {returned.length} quotation{returned.length > 1 ? 's' : ''} returned for revision
              </div>
              <p className="text-[12.5px] text-band-manager/90 mt-0.5 leading-relaxed">
                “{returned[0].manager_revision_notes}”
                {returned.length > 1 && ` · and ${returned.length - 1} more`}
              </p>
            </div>
          </button>
        )}

        <div className="flex flex-wrap items-center gap-1">
          {TABS.map(t => {
            const n = rows.filter(t.match).length
            const isAction = t.key === 'action' && n > 0
            return (
              <button
                key={t.key}
                onClick={() => setParams(t.key === 'all' ? {} : { tab: t.key }, { replace: true })}
                aria-pressed={tab === t.key}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1',
                  'text-[11.5px] font-medium transition-colors duration-150',
                  tab === t.key ? 'bg-fg text-white'
                    : isAction ? 'bg-band-managerWash text-band-manager hover:brightness-95'
                      : 'text-fg-3 hover:text-fg hover:bg-surface-2',
                )}
              >
                {t.label}
                <span className={cn('font-mono text-[10px] tabular-nums',
                                    tab === t.key ? 'text-white/70' : 'opacity-70')}>
                  {n}
                </span>
              </button>
            )
          })}
        </div>

        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">
              {mode === 'pipeline' ? 'Pipeline' : 'Quotations'}
            </h1>
            {user?.role === 'manager' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/25 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {user.name}'s Reps
              </span>
            )}
          </div>
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

          <div className="ml-auto flex flex-wrap items-center gap-2">


            {/* Search Input */}
            <label className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-4" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter by customer, ref, rep…"
                className="w-[180px] sm:w-[210px] rounded-full bg-surface pl-7 pr-3 py-1.5 text-[12px] text-fg
                           ring-1 ring-black/[.08] outline-none focus:ring-accent/45
                           placeholder:text-fg-4"
              />
            </label>

            {/* Segmented control: Table vs Pipeline */}
            <div className="inline-flex rounded-full ring-1 ring-black/[.08] bg-surface p-0.5">
              {([['list', Rows3, 'Table'], ['pipeline', LayoutGrid, 'Pipeline']] as const).map(
                ([m, Icon, label]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    title={`${label} view`}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium',
                      'transition-colors duration-150',
                      mode === m ? 'bg-fg text-white' : 'text-fg-3 hover:text-fg',
                    )}
                  >
                    <Icon size={12} />{label}
                  </button>
                ))}
            </div>

            {!isRep && (
              <span className="text-[11.5px] text-fg-3">
                View only &mdash; quotations are raised by the account&rsquo;s sales rep.
              </span>
            )}
            {isRep && (
              <>
                <select
                  value={newFor}
                  onChange={e => setNewFor(e.target.value)}
                  className="rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-fg
                             ring-1 ring-black/[.08] outline-none focus:ring-accent/45"
                  aria-label="Customer for new quotation"
                >
                  {accounts.length === 0 && <option value="">No accounts assigned</option>}
                  {accounts.map(c => (
                    <option key={c.name} value={c.name}>{c.name} · {c.tier}</option>
                  ))}
                </select>
                <button onClick={create} disabled={busy || !newFor}
                        title={accounts.length === 0
                          ? 'No accounts are assigned to you yet'
                          : `Raise a quotation for ${newFor}`}
                        className="ctl ctl-primary">
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
          <div className="w-full min-w-0 max-w-full overflow-x-auto scroll-x pb-4">
            <div className="flex items-start gap-3 pb-2 min-w-max">
              {STAGES.map(st => {
                const inStage = displayRows.filter(
                  st.match ? st.match : r => r.state === st.key)
                const stageValue = inStage.reduce((a, r) => a + r.total, 0)
                return (
                  <div key={st.key} className="w-[240px] shrink-0 flex flex-col gap-2 min-w-0">
                    {/* Column header carries the money, which is the number an
                        operator wants from a stage — not just the count. */}
                    <div className="panel-sq px-2.5 py-2 flex flex-col gap-0.5 bg-surface-2/70 border border-line">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-fg truncate">{st.label}</span>
                        <span className="font-mono text-[10.5px] font-bold text-fg-3 bg-surface px-1.5 py-0.2 rounded ring-1 ring-black/[.05]">
                          {inStage.length}
                        </span>
                      </div>
                      <AnimatedNumber
                        value={stageValue}
                        format="inr-compact"
                        flash={false}
                        className="text-[13px] font-bold text-fg tabular-nums"
                      />
                    </div>
                    {inStage.map(r => <Card key={r.ref} r={r} />)}
                    {inStage.length === 0 && (
                      <div className="rounded-md border border-dashed border-line-2 py-6 text-center text-[11px] text-fg-4 bg-surface/20">
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
                {/* Six headers for six cells. The body was rewritten to fold
                    ref and tier into the customer cell but the header kept its
                    original eight, so every column sat one or two places to the
                    left of its label and the last two were empty. */}
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Rep</th>
                    <th className="text-right w-20">Risk</th>
                    <th className="w-24">Band</th>
                    <th className="text-right w-32">Amount</th>
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-fg">{r.customer}</span>
                          {r.is_unassigned || r.rep === 'Unassigned' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-band-financeWash text-band-finance ring-1 ring-band-finance/20 px-2 py-0.5 text-[10px] font-bold">
 <span> Unassigned</span>
                            </span>
                          ) : (r.source === 'Customer Request' || r.is_customer) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent-wash text-accent ring-1 ring-accent/20 px-2 py-0.5 text-[10px] font-bold">
 <span> Customer Request</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 text-fg-3 ring-1 ring-black/[.08] px-2 py-0.5 text-[10px] font-medium">
 <span> Rep Created</span>
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
                      <td className="text-fg-2 font-medium">
                        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px]">
                          {r.state.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        {r.is_unassigned || r.rep === 'Unassigned' ? (
                          <span className="inline-flex items-center gap-1 text-band-finance font-semibold bg-band-financeWash px-2 py-0.5 rounded-md text-[11px]">
                            Unassigned
                          </span>
                        ) : (
                          <span className="text-fg-2 font-medium">{r.rep}</span>
                        )}
                      </td>
                      <td className="num text-fg-2">{r.risk_score.toFixed(1)}</td>
                      <td><Band band={r.risk_band} /></td>
                      <td className="num text-fg font-semibold">{inr(r.total)}</td>
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
