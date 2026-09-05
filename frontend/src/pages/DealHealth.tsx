import { useState, useEffect, useMemo } from 'react'
import { Activity, Check, X, AlertTriangle } from 'lucide-react'
import { Workspace } from '../components/Workspace'
import {
  api,
  inr,
  type DealHealthDashboardData,
  type EnrichedDeal,
} from '../lib/api'
import { EASE_CSS } from '../lib/motion'

export default function DealHealth() {
  const [data, setData] = useState<DealHealthDashboardData | null>(null)
  const [deals, setDeals] = useState<EnrichedDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState<string>('')
  const [activeHealthFilter, setActiveHealthFilter] = useState<string>('ALL')
  const [activeStageFilter, setActiveStageFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedDeal, setSelectedDeal] = useState<EnrichedDeal | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [dash, dealList] = await Promise.all([
        api.dealHealthDashboard(),
        api.dealHealthDeals(),
      ])
      setData(dash)
      setDeals(dealList)
      setLastSync(new Date().toLocaleTimeString())
    } catch (err) {
      console.error('Failed to fetch deal health data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.dealHealthDashboard(),
      api.dealHealthDeals(),
    ]).then(([dash, dealList]) => {
      if (!mounted) return
      setData(dash)
      setDeals(dealList)
      setLastSync(new Date().toLocaleTimeString())
      setLoading(false)
    }).catch((err) => {
      if (!mounted) return
      console.error('Failed to fetch deal health data:', err)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (activeHealthFilter !== 'ALL' && deal.healthCategory !== activeHealthFilter) {
        return false
      }
      if (activeStageFilter !== 'ALL' && deal.stage !== activeStageFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchId = deal.id.toLowerCase().includes(q)
        const matchCust = (deal.customerName || '').toLowerCase().includes(q)
        const matchRep = (deal.salesRepName || '').toLowerCase().includes(q)
        const matchTags = (deal.scenarioTags || []).some((t) => t.toLowerCase().includes(q))
        const matchProd = (deal.products || []).some((p) => p.name.toLowerCase().includes(q))
        if (!matchId && !matchCust && !matchRep && !matchTags && !matchProd) return false
      }
      return true
    })
  }, [deals, activeHealthFilter, activeStageFilter, searchQuery])

  const openDealModal = (deal: EnrichedDeal) => {
    setSelectedDeal(deal)
    setIsModalOpen(true)
  }

  const stagesList = useMemo(() => {
    const set = new Set<string>()
    deals.forEach((d) => set.add(d.stage))
    return Array.from(set).sort()
  }, [deals])

  const summary = data?.summary

  return (
    <Workspace onReload={loadData}>
      <div className="mx-auto max-w-[1560px] px-5 py-7 space-y-8">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-line">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 text-accent">
                <Activity size={16} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-fg">Deal Health &amp; Pipeline Governance</h1>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
                Live Suite
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-3">
              Continuous risk explainability, rep discount deviation tracking, and pipeline velocity monitoring across portfolio deals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface text-xs text-fg-2 ring-1 ring-black/[.08] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Sync: {lastSync || 'Connecting...'}</span>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-fg bg-surface hover:bg-surface-2 ring-1 ring-black/[.08] hover:ring-accent/40 shadow-sm disabled:opacity-50"
              style={{ transition: `all 200ms ${EASE_CSS}` }}
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh Data
            </button>
          </div>
        </div>

        {/* 5-Card Metric Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Pipeline Value */}
          <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs text-fg-3">
              <span className="font-medium">Open Pipeline Value</span>
              <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">₹</span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-fg">
              {summary ? inr(summary.openPipelineValue) : '₹0'}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs">
              <span className="text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">Active Exposure</span>
              <span className="text-fg-4">· {summary?.totalDeals || 0} total deals</span>
            </div>
          </div>

          {/* Card 2: Healthy Deals */}
          <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs text-fg-3">
              <span className="font-medium">Healthy Pipeline</span>
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Check size={12} strokeWidth={3} />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">
              {summary?.healthyDeals || 0}
            </div>
            <div className="mt-1.5 text-xs text-fg-3">
              {summary && summary.totalDeals ? `${Math.round((summary.healthyDeals / summary.totalDeals) * 100)}% of portfolio` : '—'}
            </div>
          </div>

          {/* Card 3: At-Risk Deals */}
          <div
            onClick={() => setActiveHealthFilter('AT_RISK')}
            className="p-4 rounded-2xl bg-surface border border-rose-200 shadow-sm hover:shadow-md cursor-pointer group transition-all"
          >
            <div className="flex items-center justify-between text-xs text-fg-3">
              <span className="font-medium text-rose-700">At-Risk Deals</span>
              <span className="w-5 h-5 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold">!</span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-rose-600 group-hover:scale-105 transition-transform">
              {summary?.atRiskDeals || 0}
            </div>
            <div className="mt-1.5 text-xs text-rose-600/80 font-medium">
              High discount / risk exposure
            </div>
          </div>

          {/* Card 4: Stalled Deals */}
          <div
            onClick={() => setActiveHealthFilter('STALLED')}
            className="p-4 rounded-2xl bg-surface border border-amber-200 shadow-sm hover:shadow-md cursor-pointer group transition-all"
          >
            <div className="flex items-center justify-between text-xs text-fg-3">
              <span className="font-medium text-amber-700">Stalled Velocity</span>
              <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">⏱</span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 group-hover:scale-105 transition-transform">
              {summary?.stalledDeals || 0}
            </div>
            <div className="mt-1.5 text-xs text-amber-600/80 font-medium">
              &gt;5 days activity silence
            </div>
          </div>

          {/* Card 5: Avg Discount Rate */}
          <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs text-fg-3">
              <span className="font-medium">Portfolio Avg Discount</span>
              <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-bold">%</span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-fg">
              {summary ? `${summary.averageDiscount.toFixed(1)}%` : '0%'}
            </div>
            <div className="mt-1.5 text-xs text-fg-4">
              Ceiling baseline: 15% Hardware
            </div>
          </div>
        </div>

        {/* Health Distribution & Stage Progress Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Health Distribution Segment Bar */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-surface border border-line shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-fg">Deal Health Distribution</h2>
                <p className="text-xs text-fg-3">Click segments to filter deals table by operational state</p>
              </div>
              <span className="text-xs font-medium text-fg-3">Total: {summary?.totalDeals || 0} deals</span>
            </div>

            {/* Segmented Bar */}
            <div className="h-6 w-full rounded-full bg-surface-2 p-0.5 ring-1 ring-black/[.06] flex overflow-hidden">
              {summary && summary.totalDeals > 0 && (
                <>
                  <div
                    onClick={() => setActiveHealthFilter('HEALTHY')}
                    style={{ width: `${(summary.healthyDeals / summary.totalDeals) * 100}%` }}
                    className="h-full bg-emerald-500 hover:bg-emerald-600 transition-colors cursor-pointer"
                    title={`HEALTHY: ${summary.healthyDeals} deals (${Math.round((summary.healthyDeals / summary.totalDeals) * 100)}%)`}
                  />
                  <div
                    onClick={() => setActiveHealthFilter('AT_RISK')}
                    style={{ width: `${(summary.atRiskDeals / summary.totalDeals) * 100}%` }}
                    className="h-full bg-rose-500 hover:bg-rose-600 transition-colors cursor-pointer"
                    title={`AT_RISK: ${summary.atRiskDeals} deals (${Math.round((summary.atRiskDeals / summary.totalDeals) * 100)}%)`}
                  />
                  <div
                    onClick={() => setActiveHealthFilter('STALLED')}
                    style={{ width: `${(summary.stalledDeals / summary.totalDeals) * 100}%` }}
                    className="h-full bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer"
                    title={`STALLED: ${summary.stalledDeals} deals (${Math.round((summary.stalledDeals / summary.totalDeals) * 100)}%)`}
                  />
                  <div
                    onClick={() => setActiveHealthFilter('CLOSED_LOST')}
                    style={{ width: `${(summary.closedLostDeals / summary.totalDeals) * 100}%` }}
                    className="h-full bg-slate-400 hover:bg-slate-500 transition-colors cursor-pointer"
                    title={`CLOSED_LOST: ${summary.closedLostDeals} deals (${Math.round((summary.closedLostDeals / summary.totalDeals) * 100)}%)`}
                  />
                </>
              )}
            </div>

            {/* Legend Cluster */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <button
                onClick={() => setActiveHealthFilter(activeHealthFilter === 'HEALTHY' ? 'ALL' : 'HEALTHY')}
                className={`p-2 rounded-xl flex items-center justify-between ring-1 transition-all ${
                  activeHealthFilter === 'HEALTHY' ? 'bg-emerald-50 ring-emerald-500 text-emerald-900 font-semibold' : 'bg-surface-2 ring-black/[.05] text-fg-2'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Healthy</span>
                </div>
                <span>{summary?.healthyDeals || 0}</span>
              </button>

              <button
                onClick={() => setActiveHealthFilter(activeHealthFilter === 'AT_RISK' ? 'ALL' : 'AT_RISK')}
                className={`p-2 rounded-xl flex items-center justify-between ring-1 transition-all ${
                  activeHealthFilter === 'AT_RISK' ? 'bg-rose-50 ring-rose-500 text-rose-900 font-semibold' : 'bg-surface-2 ring-black/[.05] text-fg-2'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span>At Risk</span>
                </div>
                <span>{summary?.atRiskDeals || 0}</span>
              </button>

              <button
                onClick={() => setActiveHealthFilter(activeHealthFilter === 'STALLED' ? 'ALL' : 'STALLED')}
                className={`p-2 rounded-xl flex items-center justify-between ring-1 transition-all ${
                  activeHealthFilter === 'STALLED' ? 'bg-amber-50 ring-amber-500 text-amber-900 font-semibold' : 'bg-surface-2 ring-black/[.05] text-fg-2'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>Stalled</span>
                </div>
                <span>{summary?.stalledDeals || 0}</span>
              </button>

              <button
                onClick={() => setActiveHealthFilter(activeHealthFilter === 'CLOSED_LOST' ? 'ALL' : 'CLOSED_LOST')}
                className={`p-2 rounded-xl flex items-center justify-between ring-1 transition-all ${
                  activeHealthFilter === 'CLOSED_LOST' ? 'bg-slate-100 ring-slate-500 text-slate-900 font-semibold' : 'bg-surface-2 ring-black/[.05] text-fg-2'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span>Closed Lost</span>
                </div>
                <span>{summary?.closedLostDeals || 0}</span>
              </button>
            </div>
          </div>

          {/* Stage Progression Funnel */}
          <div className="p-5 rounded-2xl bg-surface border border-line shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fg">Pipeline Stage Funnel</h2>
              <span className="text-xs text-fg-3">Workflow State</span>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              {data?.statusDistribution.byStage.map((s) => {
                const total = summary?.totalDeals || 1
                const pct = Math.round((s.count / total) * 100)
                return (
                  <div key={s.stage} className="space-y-1">
                    <div className="flex justify-between text-fg-2">
                      <span className="font-medium">{s.stage.replace(/_/g, ' ')}</span>
                      <span className="text-fg-4">{s.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Critical Alerts Panels: Side-by-Side (At-Risk & Stalled) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Panel 1: At-Risk Deals */}
          <div className="p-5 rounded-2xl bg-surface border border-line shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <h2 className="text-sm font-semibold text-fg">At-Risk Deals (Scoring &amp; Escalations)</h2>
              </div>
              <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                {data?.atRiskDeals.length || 0} Flagged
              </span>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {data?.atRiskDeals.map((deal) => (
                <div
                  key={deal.dealId}
                  onClick={() => {
                    const fullDeal = deals.find((d) => d.id === deal.dealId)
                    if (fullDeal) openDealModal(fullDeal)
                  }}
                  className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50/80 hover:border-rose-300 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-fg group-hover:text-accent transition-colors">
                      {deal.dealId}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800">
                      Score: {deal.riskScore ?? '—'} ({deal.riskLevel || 'HIGH'})
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-fg">{deal.customerName}</div>
                  <div className="flex items-center gap-3 text-xs text-fg-3">
                    <span>Rep: <strong className="text-fg-2">{deal.salesRep}</strong></span>
                    <span>Discount: <strong className="text-rose-600 font-bold">{deal.discount}%</strong></span>
                    <span>Approval: <strong className="text-fg-2">{deal.approvalStage || 'NONE'}</strong></span>
                  </div>
                  <div className="text-xs text-rose-900/85 pl-2 border-l-2 border-rose-400 bg-white/60 p-1.5 rounded-r">
                    {deal.riskExplanation || 'Discount exceeds representative historical baseline.'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 2: Stalled Deals */}
          <div className="p-5 rounded-2xl bg-surface border border-line shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h2 className="text-sm font-semibold text-fg">Stalled Deals (Velocity Bottlenecks)</h2>
              </div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {data?.stalledDeals.length || 0} Inactive
              </span>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {data?.stalledDeals.map((deal) => (
                <div
                  key={deal.dealId}
                  onClick={() => {
                    const fullDeal = deals.find((d) => d.id === deal.dealId)
                    if (fullDeal) openDealModal(fullDeal)
                  }}
                  className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/40 hover:bg-amber-50/80 hover:border-amber-300 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-fg group-hover:text-accent transition-colors">
                      {deal.dealId}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800">
                      {deal.daysStalled} Days Inactive
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-fg">{deal.customerName}</div>
                  <div className="flex items-center justify-between text-xs text-fg-3">
                    <span>Rep: <strong className="text-fg-2">{deal.salesRep}</strong></span>
                    <span>Value: <strong className="text-fg-2">{inr(deal.value)}</strong></span>
                  </div>
                  <div className="text-xs text-amber-900/85 pl-2 border-l-2 border-amber-400 bg-white/60 p-1.5 rounded-r">
                    Velocity alert: No buyer updates or stage transitions in the last {deal.daysStalled} days.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sales Rep Discount Anomaly Benchmarking */}
        <div className="p-5 rounded-2xl bg-surface border border-line shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-fg">Sales Representative Discount Variance &amp; Anomaly Benchmarking</h2>
              <p className="text-xs text-fg-3">Historical discount frequency distributions; orange/red bars highlight deals with discounts &ge;20%</p>
            </div>
            <span className="text-xs font-medium text-fg-3">PS §B9 Behavioural Baselines</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {data?.salesRepDiscountHistory.map((rep) => {
              const maxDiscount = Math.max(...rep.discountHistory, 25)
              return (
                <div key={rep.salesRepId} className="p-4 rounded-xl bg-surface-2/60 border border-line space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/15 text-accent font-bold flex items-center justify-center text-xs">
                      {rep.salesRepName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-fg">{rep.salesRepName}</div>
                      <div className="text-[11px] font-mono text-fg-4">{rep.salesRepId}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1 text-center bg-surface rounded-lg p-2 border border-line/60">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-fg-4">Deals</div>
                      <div className="text-xs font-bold text-fg">{rep.totalDeals}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-fg-4">Avg Disc</div>
                      <div className="text-xs font-bold text-fg">{rep.averageDiscount.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-fg-4">Peak</div>
                      <div className={`text-xs font-bold ${rep.highestDiscount >= 20 ? 'text-rose-600' : 'text-fg'}`}>
                        {rep.highestDiscount}%
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-fg-4 pb-1.5">
                      <span>Discount History Variance</span>
                      <span>{rep.discountHistory.length} deals</span>
                    </div>
                    {/* Sparkline Bar Visualization */}
                    <div className="h-10 flex items-end gap-1 bg-surface p-1 rounded-md border border-line/60 overflow-hidden">
                      {rep.discountHistory.map((val, idx) => {
                        const heightPct = Math.max(12, Math.round((val / maxDiscount) * 100))
                        const isAnomaly = val >= 20
                        return (
                          <div
                            key={idx}
                            style={{ height: `${heightPct}%` }}
                            title={`Deal #${idx + 1}: ${val}% discount${isAnomaly ? ' (ANOMALY)' : ''}`}
                            className={`flex-1 rounded-t-sm transition-all hover:opacity-75 ${
                              isAnomaly ? 'bg-rose-500 shadow-sm' : 'bg-accent/70'
                            }`}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Filterable Deal Pipeline Table */}
        <div className="p-5 rounded-2xl bg-surface border border-line shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-fg">All Deals Pipeline Explorer</h2>
              <p className="text-xs text-fg-3">Search and inspect all 50 live and historical portfolio deals</p>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search deals, reps, customers, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 md:w-80 px-3.5 py-1.5 text-xs rounded-full bg-surface-2 border border-line focus:outline-none focus:ring-2 focus:ring-accent/30 text-fg"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-fg-4 hover:text-fg"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Stage Dropdown */}
              <select
                value={activeStageFilter}
                onChange={(e) => setActiveStageFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-full bg-surface-2 border border-line text-fg focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="ALL">All Stages</option>
                {stagesList.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            {[
              { key: 'ALL', label: 'All Deals', count: deals.length },
              { key: 'HEALTHY', label: 'Healthy', count: summary?.healthyDeals || 0 },
              { key: 'AT_RISK', label: 'At Risk', count: summary?.atRiskDeals || 0 },
              { key: 'STALLED', label: 'Stalled', count: summary?.stalledDeals || 0 },
              { key: 'CLOSED_LOST', label: 'Closed Lost', count: summary?.closedLostDeals || 0 },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveHealthFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  activeHealthFilter === f.key
                    ? 'bg-fg text-white shadow-sm'
                    : 'bg-surface-2 text-fg-2 hover:text-fg hover:bg-surface-2/80 ring-1 ring-black/[.05]'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Deals Table */}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-fg-3 border-b border-line font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-3.5 py-2.5">Deal ID</th>
                  <th className="px-3.5 py-2.5">Customer</th>
                  <th className="px-3.5 py-2.5">Rep</th>
                  <th className="px-3.5 py-2.5 text-right">Value (INR)</th>
                  <th className="px-3.5 py-2.5 text-center">Discount</th>
                  <th className="px-3.5 py-2.5">Health</th>
                  <th className="px-3.5 py-2.5">Workflow Stage</th>
                  <th className="px-3.5 py-2.5">Risk Score</th>
                  <th className="px-3.5 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-fg-4">
                      No deals match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal) => {
                    const healthBadge = {
                      HEALTHY: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
                      AT_RISK: 'bg-rose-50 text-rose-800 ring-rose-600/20',
                      STALLED: 'bg-amber-50 text-amber-800 ring-amber-600/20',
                      CLOSED_LOST: 'bg-slate-100 text-slate-700 ring-slate-400/20',
                    }[deal.healthCategory] || 'bg-slate-50 text-slate-700'

                    return (
                      <tr
                        key={deal.id}
                        onClick={() => openDealModal(deal)}
                        className="hover:bg-surface-2/60 cursor-pointer transition-colors group"
                      >
                        <td className="px-3.5 py-2.5 font-mono font-bold text-fg group-hover:text-accent">
                          {deal.id}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-fg">
                          {deal.customerName}
                        </td>
                        <td className="px-3.5 py-2.5 text-fg-2">
                          {deal.salesRepName}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-fg">
                          {inr(deal.value)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className={`font-mono font-bold ${deal.discountPercent >= 20 ? 'text-rose-600' : 'text-fg-2'}`}>
                            {deal.discountPercent}%
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ${healthBadge}`}>
                            {deal.healthCategory.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-fg-2">
                          <div>{deal.stage.replace(/_/g, ' ')}</div>
                          {deal.approvalStage && deal.approvalStage !== 'NONE' && (
                            <div className="text-[10px] text-fg-4 font-mono">Stage: {deal.approvalStage}</div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {deal.riskScore ? (
                            <span className={`inline-flex items-center gap-1 font-mono font-bold ${
                              deal.riskLevel === 'HIGH' ? 'text-rose-600' : 'text-amber-600'
                            }`}>
                              <span>●</span> {deal.riskScore} ({deal.riskLevel})
                            </span>
                          ) : (
                            <span className="text-fg-4">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openDealModal(deal)
                            }}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-surface-2 hover:bg-surface ring-1 ring-black/[.08] text-fg"
                          >
                            Inspect ↗
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Deal Detail Inspection Modal */}
      {isModalOpen && selectedDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-surface border border-line shadow-2xl p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-fg-4">
                  <span>{selectedDeal.id}</span>
                  <span>·</span>
                  <span className="font-sans text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-fg-2">
                    {selectedDeal.healthCategory}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-fg mt-1">{selectedDeal.customerName}</h3>
                <p className="text-xs text-fg-3">
                  Account Rep: <strong className="text-fg-2">{selectedDeal.salesRepName}</strong> ({selectedDeal.salesRepId})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-2 hover:bg-surface text-fg-3 hover:text-fg flex items-center justify-center"
                aria-label="Close modal"
              >
                <X size={15} />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-2.5 p-3 rounded-xl bg-surface-2 text-center text-xs">
              <div>
                <div className="text-[10px] uppercase text-fg-4">Contract Value</div>
                <div className="font-mono font-bold text-fg mt-0.5">{inr(selectedDeal.value)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-fg-4">Discount</div>
                <div className={`font-mono font-bold mt-0.5 ${selectedDeal.discountPercent >= 20 ? 'text-rose-600' : 'text-fg'}`}>
                  {selectedDeal.discountPercent}%
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-fg-4">Risk Score</div>
                <div className="font-mono font-bold mt-0.5 text-fg">
                  {selectedDeal.riskScore ? `${selectedDeal.riskScore} (${selectedDeal.riskLevel})` : 'Compliant'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-fg-4">Stage</div>
                <div className="font-medium text-fg mt-0.5">{selectedDeal.stage}</div>
              </div>
            </div>

            {/* Risk Explanation if present */}
            {selectedDeal.riskExplanation && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertTriangle size={14} className="text-rose-700" />
                  <span>Governance Risk Explanation</span>
                  <span className="text-[10px] bg-rose-200 px-1.5 py-0.2 rounded font-mono">
                    Approval Stage: {selectedDeal.approvalStage}
                  </span>
                </div>
                <p>{selectedDeal.riskExplanation}</p>
              </div>
            )}

            {/* Products Line Items */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-fg-3">Line Item Products</h4>
              <div className="rounded-xl border border-line overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2 text-fg-3 border-b border-line text-[11px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {selectedDeal.products.map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-fg">{p.name}</div>
                          <div className="text-[10px] font-mono text-fg-4">{p.productId}</div>
                        </td>
                        <td className="px-3 py-2 text-center font-mono">{p.qty}</td>
                        <td className="px-3 py-2 text-right font-mono text-fg-3">{inr(p.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-fg">
                          {inr(p.qty * p.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Warehouse Allocation Split if available */}
            {selectedDeal.warehouseSplit && selectedDeal.warehouseSplit.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-fg-3">Warehouse Fulfillment Split</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {selectedDeal.warehouseSplit.map((wh, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-surface-2 border border-line flex justify-between items-center">
                      <span className="text-fg-2">{wh.name}</span>
                      <strong className="font-mono text-fg">{wh.unitsAllocated} units</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subscription Info if available */}
            {selectedDeal.subscription && (
              <div className="p-3 rounded-xl bg-surface-2 border border-line text-xs flex justify-between items-center">
                <div>
                  <div className="text-[10px] uppercase text-fg-4">Subscription Plan</div>
                  <div className="font-bold text-fg">{selectedDeal.subscription.planName}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-fg-4">Billing Cycle</div>
                  <div className="font-bold text-fg">{selectedDeal.subscription.billingCycle}</div>
                </div>
              </div>
            )}

            {/* Scenario Tags */}
            {selectedDeal.scenarioTags && selectedDeal.scenarioTags.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-fg-4">Scenario Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDeal.scenarioTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-accent/10 text-accent ring-1 ring-accent/20"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-fg text-white hover:bg-fg/90 transition-colors"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </Workspace>
  )
}
