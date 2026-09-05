import { useCallback, useEffect, useState } from 'react'
import { api, inr, num } from '../lib/api'
import { Band } from '../components/ui'
import { ErrorBar, Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'

/**
 * Admin / Reporting — wireframe screen 15, PS A7.
 *
 * The four filters the spec names (Period, Sales Team / Rep, Approval Status,
 * Product / Category) plus the three KPI tiles, and the PDF / XLS exports.
 *
 * Export is done client-side on purpose: a print stylesheet driving
 * window.print() gives a real PDF through the browser's own engine, and CSV is
 * a two-line serialiser. Standing up a headless-browser PDF service would be
 * hours of work for an identical artefact.
 */

interface Row {
  ref: string; customer: string; rep: string; state: string
  total: number; risk_score: number; risk_band: string; last_activity: string
}
interface Report {
  filters: Record<string, string | null>
  quotes_created: number
  total_value: number
  avg_approval_hours: number
  top_upsold: { sku: string; name: string; units: number } | null
  band_counts: Record<string, number>
  by_category: Record<string, { revenue: number; discount: number; units: number }>
  by_rep: Record<string, { quotes: number; value: number; avg_risk: number }>
  reps: string[]
  rows: Row[]
}

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
]
const STATUSES = ['DRAFT', 'PENDING_MANAGER', 'PENDING_FINANCE', 'APPROVED',
                  'NEGOTIATION', 'CONFIRMED', 'PAID']
const CATEGORIES = ['Hardware', 'Software', 'Services', 'Subscriptions']

export default function Reports() {
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('all')
  const [rep, setRep] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')

  const load = useCallback(() => {
    const q = new URLSearchParams({ period })
    if (rep) q.set('rep', rep)
    if (status) q.set('approval_status', status)
    if (category) q.set('category', category)
    api.reports(q.toString())
      .then(d => { setData(d as Report); setError(null) })
      .catch(e => setError(e?.message?.includes('403')
        ? 'Your role is not permitted to view platform reporting.'
        : `Could not load the report (${e?.message ?? 'unknown error'}).`))
  }, [period, rep, status, category])
  useEffect(load, [load])

  /** CSV that Excel opens natively — PS A7's "Export XLS". */
  const exportCsv = () => {
    if (!data) return
    const head = ['Quotation', 'Customer', 'Rep', 'Stage', 'Risk score', 'Band', 'Amount']
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [
      head.map(esc).join(','),
      ...data.rows.map(r => [r.ref, r.customer, r.rep, r.state.replace(/_/g, ' '),
                             r.risk_score, r.risk_band, r.total].map(esc).join(',')),
      '',
      ['Quotes created', data.quotes_created].map(esc).join(','),
      ['Total value', data.total_value].map(esc).join(','),
      ['Avg approval hours', data.avg_approval_hours].map(esc).join(','),
    ].join('\r\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `clinch-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!data) {
    return (
      <Workspace onReload={load}>
        {error ? <ErrorBar message={error} onRetry={load} />
               : <p className="text-[13px] text-fg-3">Building report…</p>}
      </Workspace>
    )
  }

  const KPIS = [
    { label: 'Quotes Created', value: num(data.quotes_created),
      sub: `${inr(data.total_value)} total value` },
    { label: 'Avg Approval Time', value: `${data.avg_approval_hours}h`,
      sub: 'median across closed orders' },
    { label: 'Top Upsold Product', value: data.top_upsold?.name ?? '—',
      sub: data.top_upsold ? `${num(data.top_upsold.units)} units sold` : 'no data',
      small: true },
  ]

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4 report-root">
        {error && <ErrorBar message={error} onRetry={load} />}

        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-[22px] font-bold text-fg">Reporting</h1>
            <p className="text-[12.5px] text-fg-3 mt-0.5">
              Sales trends, approval bottlenecks and platform usage.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2
                         font-display text-[12.5px] font-semibold text-fg
                         hover:ring-accent/40 hover:text-accent"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              Export PDF
            </button>
            <button
              onClick={exportCsv}
              className="rounded-full bg-fg text-white px-4 py-2 font-display
                         text-[12.5px] font-semibold hover:shadow-lift-lg active:scale-[.98]"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              Export XLS
            </button>
          </div>
        </header>

        {/* The four filters PS A7 names */}
        <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-4
                            flex flex-wrap items-end gap-4 no-print">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">Period</span>
            <div className="flex bg-surface-2 rounded-full p-1 gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.key} onClick={() => setPeriod(p.key)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                    period === p.key ? 'bg-fg text-white' : 'text-fg-2 hover:text-fg'}`}
                  style={{ transition: `all 280ms ${EASE_CSS}` }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </label>

          {([
            { label: 'Sales rep', value: rep, set: setRep, options: ['', ...data.reps] },
            { label: 'Approval status', value: status, set: setStatus, options: ['', ...STATUSES] },
            { label: 'Category', value: category, set: setCategory, options: ['', ...CATEGORIES] },
          ] as Array<{ label: string; value: string; set: (v: string) => void; options: string[] }>
          ).map(({ label, value, set, options }) => (
            <label key={label} className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                {label}
              </span>
              <select
                value={value}
                onChange={e => set(e.target.value)}
                className="rounded-full bg-surface px-3.5 py-1.5 text-[12.5px] text-fg
                           ring-1 ring-black/[.07] outline-none focus:ring-accent/40 min-w-[150px]"
              >
                {options.map(o => (
                  <option key={o} value={o}>
                    {o === '' ? `All ${label.toLowerCase()}s` : o.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {(rep || status || category || period !== 'all') && (
            <button
              onClick={() => { setPeriod('all'); setRep(''); setStatus(''); setCategory('') }}
              className="ml-auto text-[12px] font-semibold text-accent underline"
            >
              Clear filters
            </button>
          )}
        </section>

        {/* KPI tiles */}
        <div className="grid sm:grid-cols-3 gap-4">
          {KPIS.map(k => (
            <div key={k.label} className="rounded-2xl bg-surface ring-1 ring-black/[.055] p-5 shadow-lift">
              <div className={`font-display font-bold text-fg tabular-nums leading-tight
                               ${k.small ? 'text-[18px]' : 'text-[30px] leading-none'}`}>
                {k.value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-accent mt-2">
                {k.label}
              </div>
              <p className="text-[12px] text-fg-3 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Per rep */}
          <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
            <div className="px-4 py-3 border-b border-line">
              <h2 className="font-display text-[14px] font-semibold text-fg">By sales rep</h2>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                               border-b border-line">
                  <th className="text-left font-medium px-4 py-2">Rep</th>
                  <th className="text-right font-medium px-3 py-2 w-20">Quotes</th>
                  <th className="text-right font-medium px-3 py-2 w-28">Value</th>
                  <th className="text-right font-medium px-4 py-2 w-24">Avg risk</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.by_rep).map(([name, v]) => (
                  <tr key={name} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-fg font-medium">{name}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg-2">{v.quotes}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">{inr(v.value)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold
                                    ${v.avg_risk >= 60 ? 'text-band-finance'
                                      : v.avg_risk >= 20 ? 'text-band-manager' : 'text-band-auto'}`}>
                      {v.avg_risk}
                    </td>
                  </tr>
                ))}
                {Object.keys(data.by_rep).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-fg-3">
                    No quotations match these filters.
                  </td></tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Per category */}
          <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
            <div className="px-4 py-3 border-b border-line">
              <h2 className="font-display text-[14px] font-semibold text-fg">
                By product category
              </h2>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                               border-b border-line">
                  <th className="text-left font-medium px-4 py-2">Category</th>
                  <th className="text-right font-medium px-3 py-2 w-20">Units</th>
                  <th className="text-right font-medium px-3 py-2 w-28">Revenue</th>
                  <th className="text-right font-medium px-4 py-2 w-28">Discount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.by_category).map(([name, v]) => (
                  <tr key={name} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-fg font-medium">{name}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg-2">{v.units}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">{inr(v.revenue)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-band-finance">
                      −{inr(v.discount)}
                    </td>
                  </tr>
                ))}
                {Object.keys(data.by_category).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-fg-3">
                    No lines match these filters.
                  </td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>

        {/* Detail rows */}
        <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-3">
            <h2 className="font-display text-[14px] font-semibold text-fg">Quotations</h2>
            <span className="font-mono text-[11px] text-fg-3">{data.rows.length} row(s)</span>
            <span className="ml-auto flex items-center gap-3">
              {(['AUTO', 'MANAGER', 'FINANCE'] as const).map(b => (
                <span key={b} className="flex items-center gap-1.5">
                  <Band band={b} />
                  <span className="font-mono text-[12px] tabular-nums text-fg-2">
                    {data.band_counts[b] ?? 0}
                  </span>
                </span>
              ))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[700px]">
              <thead>
                <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                               border-b border-line">
                  <th className="text-left font-medium px-4 py-2.5">Quotation</th>
                  <th className="text-left font-medium px-3 py-2.5">Customer</th>
                  <th className="text-left font-medium px-3 py-2.5">Rep</th>
                  <th className="text-left font-medium px-3 py-2.5">Stage</th>
                  <th className="text-right font-medium px-3 py-2.5 w-20">Risk</th>
                  <th className="text-right font-medium px-4 py-2.5 w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.ref} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-mono text-fg">{r.ref}</td>
                    <td className="px-3 py-2.5 text-fg font-medium">{r.customer}</td>
                    <td className="px-3 py-2.5 text-fg-2">{r.rep}</td>
                    <td className="px-3 py-2.5 text-fg-2">{r.state.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">
                      {r.risk_score.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-fg">
                      {inr(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Workspace>
  )
}
