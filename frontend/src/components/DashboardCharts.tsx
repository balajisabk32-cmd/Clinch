import { useState, useMemo } from 'react'
import { inr } from '../lib/api'
import {
  Layers,
  PieChart,
  BarChart3,
  Users,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Award,
} from 'lucide-react'
import { EASE_CSS } from '../lib/motion'

export interface QuoteData {
  ref: string
  customer: string
  tier: string
  rep: string
  state: string
  total: number
  risk_score: number
  risk_band: string
  days_inactive: number
  is_stalled: boolean
  last_activity_at: string
}

interface DashboardChartsProps {
  quotes: QuoteData[]
  dash: any
  onNavigateToStage?: (stage: string) => void
  onNavigateToBand?: (band: string) => void
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; text: string }> = {
  DRAFT: { label: 'Drafts', color: '#64748b', bg: 'bg-slate-500', text: 'text-slate-600' },
  PENDING_MANAGER: { label: 'Manager Queue', color: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-600' },
  PENDING_FINANCE: { label: 'Finance Review', color: '#ef4444', bg: 'bg-rose-500', text: 'text-rose-600' },
  APPROVED: { label: 'Approved', color: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-600' },
  NEGOTIATION: { label: 'Negotiation', color: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-600' },
  CONFIRMED: { label: 'Confirmed', color: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-600' },
  PAID: { label: 'Paid & Won', color: '#8b5cf6', bg: 'bg-purple-500', text: 'text-purple-600' },
}

const BAND_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  AUTO: { label: 'Auto-Approved', color: '#10b981', desc: 'Compliant with rep discount ceilings' },
  MANAGER: { label: 'Manager Review', color: '#f59e0b', desc: 'Requires Tier-1 manager sign-off' },
  FINANCE: { label: 'Finance Escalated', color: '#ef4444', desc: 'Critical discount or high margin risk' },
}

const TIER_COLORS: Record<string, { color: string; bg: string; text: string }> = {
  Platinum: { color: '#8b5cf6', bg: 'bg-purple-500/10', text: 'text-purple-600' },
  Gold: { color: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-600' },
  Silver: { color: '#64748b', bg: 'bg-slate-500/10', text: 'text-slate-600' },
  Bronze: { color: '#d97706', bg: 'bg-orange-500/10', text: 'text-orange-600' },
}

export function DashboardCharts({ quotes, dash }: DashboardChartsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'stages' | 'risk' | 'reps'>('all')
  const [hoveredBand, setHoveredBand] = useState<string | null>(null)
  const [hoveredStage, setHoveredStage] = useState<string | null>(null)

  // 1. Pipeline Stages Aggregate
  const stageStats = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {}
    quotes.forEach(q => {
      const s = q.state || 'DRAFT'
      if (!map[s]) map[s] = { count: 0, total: 0 }
      map[s].count += 1
      map[s].total += q.total || 0
    })

    const totalPipeline = quotes.reduce((acc, q) => acc + (q.total || 0), 0) || 1

    return Object.keys(STAGE_CONFIG).map(stageKey => {
      const data = map[stageKey] || { count: 0, total: 0 }
      const pct = (data.total / totalPipeline) * 100
      return {
        stageKey,
        ...STAGE_CONFIG[stageKey],
        count: data.count,
        total: data.total,
        percentage: pct,
      }
    })
  }, [quotes])

  // 2. Risk Engine Donut Data
  const riskStats = useMemo(() => {
    const counts = { AUTO: 0, MANAGER: 0, FINANCE: 0 }
    const totals = { AUTO: 0, MANAGER: 0, FINANCE: 0 }

    quotes.forEach(q => {
      const b = (q.risk_band as 'AUTO' | 'MANAGER' | 'FINANCE') || 'AUTO'
      if (counts[b] !== undefined) {
        counts[b] += 1
        totals[b] += q.total || 0
      }
    })

    const totalQuotes = quotes.length || 1
    const totalVal = quotes.reduce((acc, q) => acc + (q.total || 0), 0)

    let accumulatedOffset = 0
    const slices = (['AUTO', 'MANAGER', 'FINANCE'] as const).map(band => {
      const count = counts[band]
      const val = totals[band]
      const pct = (count / totalQuotes) * 100
      const currentOffset = accumulatedOffset
      accumulatedOffset += pct
      return {
        band,
        ...BAND_CONFIG[band],
        count,
        total: val,
        percentage: pct,
        offset: currentOffset,
      }
    })

    return { totalQuotes, totalVal, slices }
  }, [quotes])

  // 3. Sales Rep Comparison Data
  const repStats = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number; riskSum: number }> = {}
    quotes.forEach(q => {
      const r = q.rep || 'Unassigned'
      if (!map[r]) map[r] = { name: r, count: 0, total: 0, riskSum: 0 }
      map[r].count += 1
      map[r].total += q.total || 0
      map[r].riskSum += q.risk_score || 0
    })

    const list = Object.values(map).map(r => ({
      name: r.name,
      count: r.count,
      total: r.total,
      avgRisk: r.count > 0 ? r.riskSum / r.count : 0,
    }))

    list.sort((a, b) => b.total - a.total)
    const maxVal = list[0]?.total || 1
    return { list, maxVal }
  }, [quotes])

  // 4. Customer Tier Distribution
  const tierStats = useMemo(() => {
    const map: Record<string, { tier: string; count: number; total: number }> = {}
    quotes.forEach(q => {
      const t = q.tier || 'Standard'
      if (!map[t]) map[t] = { tier: t, count: 0, total: 0 }
      map[t].count += 1
      map[t].total += q.total || 0
    })

    const totalPipeline = quotes.reduce((acc, q) => acc + (q.total || 0), 0) || 1
    return ['Platinum', 'Gold', 'Silver', 'Bronze'].map(tierName => {
      const data = map[tierName] || { count: 0, total: 0 }
      return {
        tier: tierName,
        count: data.count,
        total: data.total,
        percentage: (data.total / totalPipeline) * 100,
        styling: TIER_COLORS[tierName] || TIER_COLORS.Silver,
      }
    })
  }, [quotes])

  // Donut geometry constants
  const RADIUS = 54
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  const activeRiskSlice = hoveredBand
    ? riskStats.slices.find(s => s.band === hoveredBand)
    : null

  return (
    <section className="flex flex-col gap-3">
      {/* ── Visual Graphs Bar Header & View Selector ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
            <TrendingUp size={14} />
          </div>
          <div>
            <h2 className="font-display text-[15px] font-bold text-fg tracking-tight">
              Executive Visual Analytics &amp; Pipeline Health
            </h2>
            <p className="text-[11.5px] text-fg-3">
              Interactive stage distribution, blended risk exposure, and sales rep performance radar.
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center rounded-full bg-surface-2 p-0.5 ring-1 ring-black/[.06] text-xs">
          {[
            { id: 'all', label: 'All Visuals', icon: Layers },
            { id: 'stages', label: 'Stage Funnel', icon: BarChart3 },
            { id: 'risk', label: 'Risk Donut', icon: PieChart },
            { id: 'reps', label: 'Rep Matrix', icon: Users },
          ].map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
                  isActive
                    ? 'bg-fg text-white shadow-sm'
                    : 'text-fg-2 hover:text-fg hover:bg-surface'
                }`}
                style={{ transition: `all 180ms ${EASE_CSS}` }}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main Charts Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* CHART 1: Pipeline Stage Velocity Funnel */}
        {(activeTab === 'all' || activeTab === 'stages') && (
          <div className="panel p-4 flex flex-col justify-between hover:border-accent/30 transition-colors">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="font-display text-[13.5px] font-bold text-fg">
                    Pipeline Stages &amp; Velocity Funnel
                  </span>
                </div>
                <span className="text-[11px] font-mono text-fg-3">
                  {quotes.length} total deals · {inr(riskStats.totalVal)}
                </span>
              </div>

              {/* Stage Bars List */}
              <div className="mt-3.5 space-y-2.5">
                {stageStats.map(s => {
                  const isHovered = hoveredStage === s.stageKey
                  return (
                    <div
                      key={s.stageKey}
                      onMouseEnter={() => setHoveredStage(s.stageKey)}
                      onMouseLeave={() => setHoveredStage(null)}
                      className={`p-2 rounded-xl transition-all cursor-pointer ${
                        isHovered ? 'bg-surface-2 ring-1 ring-black/[.08]' : 'hover:bg-surface-2/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="font-medium text-fg">{s.label}</span>
                          <span className="text-[10.5px] font-mono px-1.5 py-0.2 rounded-full bg-surface text-fg-3 ring-1 ring-black/[.06]">
                            {s.count} {s.count === 1 ? 'deal' : 'deals'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-semibold text-fg">{inr(s.total)}</span>
                          <span className="text-[11px] text-fg-3 w-10 text-right">
                            {s.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Bar Fill */}
                      <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(s.percentage, s.count > 0 ? 3 : 0)}%`,
                            backgroundColor: s.color,
                            opacity: hoveredStage && !isHovered ? 0.4 : 1,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stage Summary Footer */}
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11.5px] text-fg-3">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>
                  {quotes.filter(q => q.state === 'APPROVED' || q.state === 'CONFIRMED' || q.state === 'PAID').length} deals cleared governance
                </span>
              </span>
              <span className="font-mono text-fg-2">
                Stalled deals: <strong className="text-rose-600">{quotes.filter(q => q.is_stalled).length}</strong>
              </span>
            </div>
          </div>
        )}

        {/* CHART 2: Risk Engine Donut & Exposure */}
        {(activeTab === 'all' || activeTab === 'risk') && (
          <div className="panel p-4 flex flex-col justify-between hover:border-accent/30 transition-colors">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="font-display text-[13.5px] font-bold text-fg">
                    AI Blended Risk Distribution
                  </span>
                </div>
                <span className="text-[11px] font-mono text-fg-3">
                  Autonomous vs Escalated
                </span>
              </div>

              {/* Donut & Interactive Legend Container */}
              <div className="mt-3.5 flex flex-col sm:flex-row items-center gap-6">
                {/* SVG Donut */}
                <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140">
                    <circle
                      cx="70"
                      cy="70"
                      r={RADIUS}
                      fill="transparent"
                      stroke="currentColor"
                      className="text-surface-2"
                      strokeWidth="14"
                    />
                    {riskStats.slices.map(slice => {
                      const strokeDash = (slice.percentage / 100) * CIRCUMFERENCE
                      const strokeOffset = (slice.offset / 100) * CIRCUMFERENCE
                      const isHovered = hoveredBand === slice.band
                      return (
                        <circle
                          key={slice.band}
                          cx="70"
                          cy="70"
                          r={RADIUS}
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth={isHovered ? 17 : 14}
                          strokeDasharray={`${strokeDash} ${CIRCUMFERENCE}`}
                          strokeDashoffset={-strokeOffset}
                          strokeLinecap="round"
                          className="transition-all duration-300 cursor-pointer"
                          style={{
                            opacity: hoveredBand && !isHovered ? 0.35 : 1,
                            filter: isHovered ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' : 'none',
                          }}
                          onMouseEnter={() => setHoveredBand(slice.band)}
                          onMouseLeave={() => setHoveredBand(null)}
                        />
                      )
                    })}
                  </svg>

                  {/* Donut Center Dynamic Callout */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    {activeRiskSlice ? (
                      <>
                        <span
                          className="font-mono text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: activeRiskSlice.color }}
                        >
                          {activeRiskSlice.label}
                        </span>
                        <span className="font-display text-[18px] font-bold text-fg leading-tight">
                          {activeRiskSlice.count}
                        </span>
                        <span className="text-[10px] font-mono text-fg-3">
                          {inr(activeRiskSlice.total)} ({activeRiskSlice.percentage.toFixed(0)}%)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3">
                          Total Pipeline
                        </span>
                        <span className="font-display text-[17px] font-bold text-fg leading-tight">
                          {inr(riskStats.totalVal)}
                        </span>
                        <span className="text-[10px] text-fg-3 font-mono">
                          {quotes.length} Quotations
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Slices Legend Strip */}
                <div className="flex-1 w-full space-y-2">
                  {riskStats.slices.map(slice => {
                    const isHovered = hoveredBand === slice.band
                    return (
                      <div
                        key={slice.band}
                        onMouseEnter={() => setHoveredBand(slice.band)}
                        onMouseLeave={() => setHoveredBand(null)}
                        className={`p-2 rounded-xl transition-all cursor-pointer ring-1 ${
                          isHovered
                            ? 'bg-surface-2 ring-black/[.1] scale-[1.02]'
                            : 'bg-surface ring-black/[.04] hover:bg-surface-2/60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: slice.color }}
                            />
                            <span className="font-medium text-fg">{slice.label}</span>
                          </div>
                          <span className="font-mono font-bold text-fg">
                            {slice.count} <span className="font-normal text-fg-3 text-[11px]">({slice.percentage.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-fg-3 mt-1">
                          <span className="truncate max-w-[170px]">{slice.desc}</span>
                          <span className="font-mono font-semibold text-fg-2">{inr(slice.total)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Leakage Metrics Strip */}
            {dash && (
              <div className="mt-4 pt-3 border-t border-line grid grid-cols-2 gap-2 text-[11.5px]">
                <div className="flex items-center gap-1.5 text-rose-600 font-medium">
                  <AlertTriangle size={13} />
                  <span>Leakage: {inr(dash.leakage_total || 0)}</span>
                </div>
                <div className="text-right text-fg-3">
                  Median Review: <strong className="text-fg font-mono">{dash.median_approval_hours || 24}h</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHART 3: Sales Rep Performance Matrix */}
        {(activeTab === 'all' || activeTab === 'reps') && (
          <div className="panel p-4 flex flex-col justify-between hover:border-accent/30 transition-colors">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-display text-[13.5px] font-bold text-fg">
                    Sales Rep Pipeline Volume &amp; Risk Matrix
                  </span>
                </div>
                <span className="text-[11px] font-mono text-fg-3">
                  {repStats.list.length} active reps
                </span>
              </div>

              {/* Reps Bar Ranking */}
              <div className="mt-3.5 space-y-2.5">
                {repStats.list.slice(0, 5).map((rep, idx) => {
                  const barWidth = (rep.total / repStats.maxVal) * 100
                  const isTop = idx === 0
                  return (
                    <div
                      key={rep.name}
                      className="p-2 rounded-xl bg-surface hover:bg-surface-2 ring-1 ring-black/[.04] transition-all"
                    >
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isTop ? 'bg-amber-400 text-amber-950' : 'bg-surface-2 text-fg-3'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-medium text-fg">{rep.name}</span>
                          <span className="text-[10.5px] font-mono text-fg-3">
                            ({rep.count} {rep.count === 1 ? 'quote' : 'quotes'})
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 font-mono text-[12px]">
                          <span className="font-bold text-fg">{inr(rep.total)}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              rep.avgRisk >= 40
                                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                                : rep.avgRisk >= 20
                                ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                                : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                            }`}
                            title={`Average Risk Score: ${rep.avgRisk.toFixed(1)}`}
                          >
                            Risk {rep.avgRisk.toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Relative Bar */}
                      <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${Math.max(barWidth, 4)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rep Matrix Footer */}
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11.5px] text-fg-3">
              <span className="flex items-center gap-1">
                <Award size={13} className="text-amber-500" />
                <span>Leader: <strong>{repStats.list[0]?.name || 'N/A'}</strong> ({inr(repStats.list[0]?.total || 0)})</span>
              </span>
              <span className="font-mono text-fg-2">
                Avg per rep: {inr(riskStats.totalVal / (repStats.list.length || 1))}
              </span>
            </div>
          </div>
        )}

        {/* CHART 4: Customer Tier Distribution */}
        {(activeTab === 'all' || activeTab === 'stages') && (
          <div className="panel p-4 flex flex-col justify-between hover:border-accent/30 transition-colors">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="font-display text-[13.5px] font-bold text-fg">
                    Customer Tier Revenue &amp; Deal Exposure
                  </span>
                </div>
                <span className="text-[11px] font-mono text-fg-3">
                  Account Segment Mix
                </span>
              </div>

              {/* Tiers Grid */}
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                {tierStats.map(t => (
                  <div
                    key={t.tier}
                    className="p-3 rounded-xl bg-surface hover:bg-surface-2 ring-1 ring-black/[.04] transition-all flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${t.styling.bg} ${t.styling.text}`}>
                        {t.tier}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-fg-3">
                        {t.count} {t.count === 1 ? 'deal' : 'deals'}
                      </span>
                    </div>
                    <div>
                      <div className="font-display text-[16px] font-bold text-fg leading-tight">
                        {inr(t.total)}
                      </div>
                      <div className="text-[10.5px] font-mono text-fg-3 mt-0.5">
                        {t.percentage.toFixed(0)}% of total exposure
                      </div>
                    </div>

                    {/* Proportional Strip */}
                    <div className="h-1 w-full rounded-full bg-surface-2 overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(t.percentage, t.count > 0 ? 5 : 0)}%`,
                          backgroundColor: t.styling.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier Radar Footer */}
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11.5px] text-fg-3">
              <span>High Value: <strong>Platinum &amp; Gold</strong></span>
              <span className="font-mono text-fg-2">
                Share: {(tierStats.filter(t => t.tier === 'Platinum' || t.tier === 'Gold').reduce((a, b) => a + b.percentage, 0)).toFixed(0)}% of Pipeline
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
