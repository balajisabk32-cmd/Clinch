import { useCallback, useEffect, useState } from 'react'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import {
  ApiError, adminApi, downloadExport, type RepScorecard,
} from '../lib/authClient'
import { ErrorBar, Workspace } from '../components/Workspace'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { cn } from '../lib/cn'

/**
 * Sales rep performance, and the exports of it.
 *
 * Every figure is computed server-side from the same pipeline and closed book
 * the dashboard reads, so this scorecard cannot disagree with the screen next
 * to it. "Leaked margin" is revenue discounted BEYOND the ceiling that applied,
 * not total discount given — a rep who discounts 10% inside a 15% ceiling has
 * leaked nothing, and reporting otherwise would punish compliant selling.
 */

const PERIODS = [
  { value: 'quarter', label: 'This quarter' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'all', label: 'All time' },
]

export default function AdminRepReports() {
  const [rep, setRep] = useState('All reps')
  const [period, setPeriod] = useState('all')
  const [data, setData] = useState<RepScorecard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    adminApi.repPerformance(rep, period)
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load the scorecard.'))
      .finally(() => setLoading(false))
  }, [rep, period])
  useEffect(load, [load])

  const doExport = async (kind: 'csv' | 'pdf') => {
    setExporting(kind); setError(null)
    const safe = rep.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    try {
      await downloadExport(adminApi.exportUrl(kind, rep, period),
                           `clinch-rep-performance-${safe}-${period}.${kind}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Could not generate the ${kind.toUpperCase()}.`)
    } finally {
      setExporting(null)
    }
  }

  const KPIS = data ? [
    { label: 'Deals closed won', value: data.deals_closed_won, format: 'int' as const,
      rail: 'rail-auto', polarity: 'higher-better' as const },
    { label: 'Gross bookings', value: data.booked_revenue, format: 'inr-compact' as const,
      rail: 'rail-auto', polarity: 'higher-better' as const },
    { label: 'Leaked margin', value: data.margin_leakage, format: 'inr' as const,
      rail: data.margin_leakage > 0 ? 'rail-finance' : 'rail-auto',
      polarity: 'lower-better' as const },
    { label: 'Flagged outliers', value: data.outliers_flagged, format: 'int' as const,
      rail: data.outliers_flagged > 0 ? 'rail-manager' : 'rail-auto',
      polarity: 'lower-better' as const },
  ] : []

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-3">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">
            Rep performance
          </h1>

          <select
            value={rep}
            onChange={e => setRep(e.target.value)}
            aria-label="Sales rep"
            className="rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-fg
                       ring-1 ring-black/[.08] outline-none focus:ring-accent/45"
          >
            <option>All reps</option>
            {(data?.available_reps ?? []).map(r => <option key={r}>{r}</option>)}
          </select>

          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            aria-label="Period"
            className="rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-fg
                       ring-1 ring-black/[.08] outline-none focus:ring-accent/45"
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => doExport('csv')} disabled={!!exporting} className="ctl">
              <FileSpreadsheet size={13} />
              {exporting === 'csv' ? 'Building…' : 'Export CSV'}
            </button>
            <button onClick={() => doExport('pdf')} disabled={!!exporting} className="ctl ctl-primary">
              <FileDown size={13} />
              {exporting === 'pdf' ? 'Building…' : 'Export PDF'}
            </button>
          </div>
        </header>

        {loading && !data ? (
          <div className="panel px-4 py-16 text-center text-[12.5px] text-fg-3">
            Loading scorecard…
          </div>
        ) : data && (
          <>
            <div className="panel grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0
                            lg:divide-x divide-line">
              {KPIS.map(k => (
                <div key={k.label} className="metric rail">
                  <span className={cn('absolute left-0 top-2 bottom-2 w-[2px] rounded-full', k.rail)} />
                  <span className="metric-label">{k.label}</span>
                  <AnimatedNumber value={k.value} format={k.format}
                                  polarity={k.polarity} className="metric-value" />
                </div>
              ))}
            </div>

            <div className="panel grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0
                            sm:divide-x divide-line">
              {[
                { label: 'Quotations built', v: data.quotes_built, f: 'int' as const, s: undefined },
                { label: 'Average discount', v: data.avg_discount_pct, f: 'pct' as const, s: undefined },
                { label: 'Approval turnaround', v: data.avg_approval_hours, f: 'dec' as const, s: 'h' },
                { label: 'Policy compliance', v: data.compliance_rate_pct, f: 'pct' as const, s: undefined },
              ].map(m => (
                <div key={m.label} className="metric">
                  <span className="metric-label">{m.label}</span>
                  <AnimatedNumber value={m.v} format={m.f} suffix={m.s}
                                  className="font-display text-[16px] font-semibold text-fg leading-none" />
                </div>
              ))}
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">
                  Closed deals · {data.rep} · {PERIODS.find(p => p.value === period)?.label}
                </span>
                <span className="key text-fg-3">
                  {data.deals.length} deal{data.deals.length === 1 ? '' : 's'}
                </span>
              </div>
              {data.deals.length === 0 ? (
                <p className="px-4 py-12 text-center text-[12.5px] text-fg-3">
                  No closed deals in this period.
                </p>
              ) : (
                <div className="scroll-x max-h-[460px] overflow-y-auto">
                  <table className="grid-table min-w-[620px]">
                    <thead>
                      <tr>
                        <th>Ref</th><th>Customer</th><th>Closed</th>
                        <th className="text-right">Value</th>
                        <th className="text-right">Avg discount</th>
                        <th className="text-right">Approval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deals.map(d => (
                        <tr key={d.ref}>
                          <td><span className="key text-fg">{d.ref}</span></td>
                          <td className="text-fg font-medium">{d.customer}</td>
                          <td className="text-fg-3">{d.closed_at}</td>
                          <td className="num text-fg">
                            <AnimatedNumber value={d.value} format="inr" flash={false} />
                          </td>
                          <td className="num text-fg-2">
                            <AnimatedNumber value={d.avg_discount} format="pct"
                                            polarity="lower-better" flash={false} />
                          </td>
                          <td className="num text-fg-3">
                            {d.approval_hours != null ? `${d.approval_hours}h` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Workspace>
  )
}
