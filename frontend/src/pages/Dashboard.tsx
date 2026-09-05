import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, inr, num } from '../lib/api'
import { Band } from '../components/ui'
import { ErrorBar, Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'

/**
 * Sales Dashboard / Home — wireframe screen 2.
 *
 * The workspace entry point: three counters that tell a rep where to go next,
 * and a recent-activity feed drawn from the append-only event log. Every figure
 * is computed from the live pipeline; nothing here is a stored aggregate that
 * could drift from the quotations it claims to summarise.
 */

interface Quote {
  ref: string; customer: string; tier: string; rep: string; state: string
  total: number; risk_score: number; risk_band: string
  days_inactive: number; is_stalled: boolean; last_activity_at: string
}

export default function Dashboard() {
  const navigate = useNavigate()
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

  const CARDS = [
    {
      label: 'Pending Approvals', value: pending.length,
      sub: `${inr(pending.reduce((a, q) => a + q.total, 0))} awaiting sign-off`,
      to: '/app/approvals', tone: 'text-band-manager',
    },
    {
      label: 'Open Quotations', value: open.length,
      sub: `${inr(open.reduce((a, q) => a + q.total, 0))} in the pipeline`,
      to: '/app/quotations', tone: 'text-fg',
    },
    {
      label: 'At-Risk Deals', value: atRisk.length,
      sub: atRisk.length ? 'Stalled or routed to Finance' : 'Nothing flagged',
      to: '/app/health', tone: atRisk.length ? 'text-band-finance' : 'text-band-auto',
    },
  ]

  // Most recently touched quotations stand in for the activity feed, so the
  // list can never disagree with the pipeline it is summarising.
  const recent = [...quotes]
    .sort((a, b) => (b.last_activity_at ?? '').localeCompare(a.last_activity_at ?? ''))
    .slice(0, 6)

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-5">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="font-display text-[22px] font-bold text-fg">Sales Dashboard</h1>
            <p className="text-[12.5px] text-fg-3 mt-0.5">
              Central hub. Sales and governance in one view.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => navigate('/app/quotations')}
              className="rounded-full bg-fg text-white px-4 py-2 font-display text-[12.5px]
                         font-semibold hover:shadow-lift-lg active:scale-[.98]"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              + New Quotation
            </button>
            <button
              onClick={() => navigate('/app/approvals')}
              className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2
                         font-display text-[12.5px] font-semibold text-fg
                         hover:ring-accent/40 hover:text-accent"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              View Approvals
            </button>
          </div>
        </header>

        {/* Three counters (wireframe screen 2) */}
        <div className="grid sm:grid-cols-3 gap-4">
          {CARDS.map(c => (
            <button
              key={c.label}
              onClick={() => navigate(c.to)}
              className="text-left rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-5
                         hover:ring-accent/35 hover:-translate-y-0.5"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              <div className={`font-display text-[34px] font-bold tabular-nums leading-none ${c.tone}`}>
                {c.value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-accent mt-2.5">
                {c.label}
              </div>
              <p className="text-[12.5px] text-fg-3 mt-1.5">{c.sub}</p>
            </button>
          ))}
        </div>

        {/* Governance headline — the computed leakage figure */}
        {dash && (
          <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-5
                              flex flex-wrap items-center gap-x-10 gap-y-4">
            <div>
              <div className="font-display text-[26px] font-bold text-fg tabular-nums leading-none">
                {inr(dash.leakage_total)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-accent mt-2">
                Discounted beyond policy
              </div>
              <p className="text-[12px] text-fg-3 mt-1">
                across {num(dash.closed_orders_analysed)} closed orders ·{' '}
                {(dash.leakage_ratio * 100).toFixed(2)}% of gross margin
              </p>
            </div>
            <div className="flex items-center gap-5">
              {(['AUTO', 'MANAGER', 'FINANCE'] as const).map(b => (
                <div key={b} className="flex flex-col items-center gap-1.5">
                  <span className="font-display text-[20px] font-bold text-fg tabular-nums">
                    {dash.band_counts?.[b] ?? 0}
                  </span>
                  <Band band={b} />
                </div>
              ))}
            </div>
            <div className="ml-auto text-right">
              <div className="font-display text-[20px] font-bold text-fg tabular-nums leading-none">
                {dash.median_approval_hours}h
              </div>
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mt-1.5">
                Median approval time
              </div>
            </div>
          </section>
        )}

        {/* Recent activity */}
        <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-display text-[14px] font-semibold text-fg">Recent Activity</h2>
          </div>
          {recent.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-fg-3">No activity yet.</p>
          ) : (
            <ul>
              {recent.map(q => (
                <li key={q.ref}>
                  <button
                    onClick={() => navigate(`/app/quotations/${q.ref}`)}
                    className="w-full text-left px-4 py-3 border-b border-line last:border-0
                               flex flex-wrap items-center gap-3 hover:bg-surface-2/60"
                    style={{ transition: `background 200ms ${EASE_CSS}` }}
                  >
                    <span className="font-mono text-[11.5px] text-fg-3 w-16">{q.ref}</span>
                    <span className="text-[13px] text-fg font-medium">{q.customer}</span>
                    <span className="text-[12.5px] text-fg-2">
                      {q.state.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {q.is_stalled && (
                      <span className="rounded-full bg-band-financeWash text-band-finance
                                       px-2 py-0.5 font-mono text-[9.5px] font-semibold">
                        STALLED {q.days_inactive}d
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-3">
                      <Band band={q.risk_band} />
                      <span className="font-mono text-[12.5px] tabular-nums text-fg w-24 text-right">
                        {inr(q.total)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Workspace>
  )
}
