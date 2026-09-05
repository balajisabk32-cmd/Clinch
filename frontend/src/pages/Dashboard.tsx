import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, inr } from '../lib/api'
import { Band } from '../components/ui'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { ErrorBar, Workspace } from '../components/Workspace'
import { DashboardCharts } from '../components/DashboardCharts'
import { cn } from '../lib/cn'

/**
 * Sales Dashboard / Home — wireframe screen 2.
 *
 * DESIGN READ: operations cockpit home for an operator mid-shift. Instrument
 * panel language, Linear/Odoo data tooling, chamfered hardware edge.
 * Dials — variance 3, motion 5, density 9.
 *
 * This screen was previously three `rounded-2xl` cards carrying 34px numerals
 * with p-5 of air around each. That reads as a template: the numbers were the
 * loudest thing on screen but said the least, and the activity feed — the part
 * an operator actually works from — was pushed below the fold by the padding.
 * Inverted here: labels lead, figures are sized to be read rather than admired,
 * and the pipeline table starts above the fold.
 *
 * Every figure renders through <AnimatedNumber>, so a value that moves after a
 * reload visibly rolls and recolours by whether the movement was good or bad.
 */

interface Quote {
  ref: string; customer: string; tier: string; rep: string; state: string
  total: number; risk_score: number; risk_band: string
  days_inactive: number; is_stalled: boolean; last_activity_at: string
}

const railFor = (band: string, stalled: boolean) =>
  stalled ? 'rail-finance'
    : band === 'FINANCE' ? 'rail-finance'
      : band === 'MANAGER' ? 'rail-manager'
        : band === 'AUTO' ? 'rail-auto' : 'rail-idle'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [dash, setDash] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([api.quotes(), api.dashboard()])
      .then(([q, d]) => { setQuotes(q as Quote[]); setDash(d); setError(null) })
      .catch(e => setError(`Could not load the dashboard (${e?.message ?? 'unknown error'}).`))
  }, [])
  useEffect(load, [load])

  const pending = quotes.filter(q => q.state.startsWith('PENDING'))
  const open = quotes.filter(q => !['PAID', 'REJECTED'].includes(q.state))
  const atRisk = quotes.filter(q => q.is_stalled || q.risk_band === 'FINANCE')
  const userRole = user?.role ?? 'rep'
  const canApprove = ['admin', 'manager', 'finance'].includes(userRole)

  /* Counters are role-shaped: an approver is steered to the queue that is
     waiting on them, a rep to the work that is theirs to move. */
  const METRICS = canApprove
    ? [
        { label: 'Pending approvals', value: pending.length, to: '/app/approvals',
          sub: `${inr(pending.reduce((a, q) => a + q.total, 0))} awaiting sign-off`,
          rail: pending.length ? 'rail-manager' : 'rail-idle', polarity: 'lower-better' as const },
        { label: 'Open quotations', value: open.length, to: '/app/quotations',
          sub: `${inr(open.reduce((a, q) => a + q.total, 0))} in the pipeline`,
          rail: 'rail-auto', polarity: 'neutral' as const },
        { label: 'At-risk deals', value: atRisk.length, to: '/app/health',
          sub: atRisk.length ? 'Stalled or routed to Finance' : 'Nothing flagged',
          rail: atRisk.length ? 'rail-finance' : 'rail-auto', polarity: 'lower-better' as const },
      ]
    : [
        { label: 'Open quotations', value: open.length, to: '/app/quotations',
          sub: `${inr(open.reduce((a, q) => a + q.total, 0))} in active draft`,
          rail: 'rail-auto', polarity: 'neutral' as const },
        { label: 'Active pipeline', value: quotes.filter(q => q.state !== 'REJECTED').length,
          to: '/app/pipeline', sub: 'Deals advancing through lifecycle',
          rail: 'rail-idle', polarity: 'neutral' as const },
        { label: 'Deal health', value: atRisk.length, to: '/app/health',
          sub: atRisk.length ? `${atRisk.length} need attention` : 'All deals healthy',
          rail: atRisk.length ? 'rail-finance' : 'rail-auto', polarity: 'lower-better' as const },
      ]

  // Most recently touched quotations stand in for the activity feed, so the
  // list can never disagree with the pipeline it is summarising.
  const recent = [...quotes]
    .sort((a, b) => (b.last_activity_at ?? '').localeCompare(a.last_activity_at ?? ''))
    .slice(0, 8)

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-3">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">
            Sales Dashboard
          </h1>
          <p className="text-[12px] text-fg-3">Sales and governance in one view.</p>
          <div className="ml-auto flex items-center gap-1.5">
            {user?.role === 'rep' && (
              <button onClick={() => navigate('/app/quotations')} className="ctl ctl-primary">
                + New Quotation
              </button>
            )}
            <button
              onClick={() => navigate(canApprove ? '/app/approvals' : '/app/pipeline')}
              className="ctl"
            >
              {canApprove ? 'Approvals queue' : 'View pipeline'}
            </button>
          </div>
        </header>

        {/* ── Instrument strip ───────────────────────────────────────────────
            One panel, three cells divided by hairlines — not three floating
            cards. They are one reading of the same pipeline, so they share a
            frame. */}
        <div className="panel grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line">
          {METRICS.map(m => (
            <button
              key={m.label}
              onClick={() => navigate(m.to)}
              className="metric rail text-left group hover:bg-accent-wash/40 transition-colors duration-150"
            >
              <span className={cn('absolute left-0 top-2 bottom-2 w-[2px] rounded-full', m.rail)} />
              <span className="metric-label flex items-center gap-1">
                {m.label}
                <ArrowUpRight
                  size={11}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-accent"
                />
              </span>
              <AnimatedNumber
                value={m.value}
                format="int"
                polarity={m.polarity}
                className="metric-value"
              />
              <span className="text-[11.5px] text-fg-3 leading-snug">{m.sub}</span>
            </button>
          ))}
        </div>

        {/* ── Governance headline ────────────────────────────────────────────
            The leakage figure is the product's thesis, so it gets its own band
            — but stated as an instrument reading, not a hero number. */}
        {dash && (
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Discount leakage · closed book</span>
              <span className="key text-fg-3">
                {dash.closed_orders_analysed} orders analysed
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-4 py-3.5">
              <div className="rail rail-finance flex flex-col gap-0.5">
                <span className="metric-label">Discounted beyond policy</span>
                <AnimatedNumber
                  value={dash.leakage_total}
                  format="inr"
                  polarity="lower-better"
                  className="font-display text-[26px] font-bold text-fg leading-none"
                />
                <span className="text-[11.5px] text-fg-3">
                  <AnimatedNumber
                    value={dash.leakage_ratio * 100}
                    format="pct"
                    precision={2}
                    polarity="lower-better"
                    className="text-[11.5px]"
                  />
                  {' '}of gross margin
                </span>
              </div>

              <div className="flex items-stretch gap-0 divide-x divide-line">
                {(['AUTO', 'MANAGER', 'FINANCE'] as const).map(b => (
                  <div key={b} className="flex flex-col items-center gap-1.5 px-4">
                    <AnimatedNumber
                      value={dash.band_counts?.[b] ?? 0}
                      format="int"
                      className="font-display text-[18px] font-bold text-fg leading-none"
                    />
                    <Band band={b} />
                  </div>
                ))}
              </div>

              <div className="ml-auto rail rail-idle flex flex-col gap-0.5 text-right">
                <span className="metric-label">Median approval time</span>
                <AnimatedNumber
                  value={dash.median_approval_hours}
                  format="dec"
                  precision={0}
                  suffix="h"
                  polarity="lower-better"
                  className="font-display text-[18px] font-bold text-fg leading-none justify-end"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Executive Visual Analytics & Interactive Graphs ──────────────── */}
        <DashboardCharts quotes={quotes} dash={dash} />

        {/* ── Live pipeline ──────────────────────────────────────────────────
            A real data grid. Hairline rows, right-aligned tabular money, state
            carried on the rail rather than in another coloured pill. */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Recent activity</span>
            <button onClick={() => navigate('/app/quotations')} className="ctl py-1 text-[11px]">
              All quotations
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="px-4 py-12 text-center text-[12.5px] text-fg-3">
              No activity yet. Quotations you create will appear here.
            </p>
          ) : (
            <div className="scroll-x">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Customer</th>
                    <th>State</th>
                    <th>Band</th>
                    <th className="text-right">Risk</th>
                    <th className="text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(q => (
                    <tr
                      key={q.ref}
                      onClick={() => navigate(`/app/quotations/${q.ref}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <span className={cn('rail block', railFor(q.risk_band, q.is_stalled))}>
                          <span className="key text-fg">{q.ref}</span>
                        </span>
                      </td>
                      <td className="text-fg font-medium">{q.customer}</td>
                      <td className="text-fg-2">
                        {q.state.replace(/_/g, ' ').toLowerCase()}
                        {q.is_stalled && (
                          <span className="ml-1.5 font-mono text-[9.5px] font-semibold text-band-finance">
                            STALLED {q.days_inactive}d
                          </span>
                        )}
                      </td>
                      <td><Band band={q.risk_band} /></td>
                      <td className="num text-fg-2">
                        <AnimatedNumber
                          value={q.risk_score}
                          format="dec"
                          precision={1}
                          polarity="lower-better"
                          flash={false}
                        />
                      </td>
                      <td className="num text-fg font-medium">
                        <AnimatedNumber value={q.total} format="inr" flash={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Workspace>
  )
}
