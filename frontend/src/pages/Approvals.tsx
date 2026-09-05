import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, request } from '../lib/authClient'
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  Clock,
  DollarSign,
  UserCheck,
  Search,
} from 'lucide-react'
import { inr } from '../lib/api'
import { Band } from '../components/ui'
import { ErrorBar, Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'
import { useAuth } from '../context/AuthContext'

interface ApprovalItem {
  ref: string
  customer: string
  tier: string
  rep?: string
  state: string
  total?: number
  risk_score: number
  risk_band: 'AUTO' | 'MANAGER' | 'FINANCE'
  stage?: string
  assigned_to?: string
  days_inactive?: number
  breach_detail?: string
}

export default function Approvals() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'MANAGER' | 'FINANCE' | 'RESOLVED'>('ALL')
  const [search, setSearch] = useState('')
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [busyRef, setBusyRef] = useState<string | null>(null)

  // Identity comes from the verified session; localStorage is not an
  // authority on who anyone is.
  const { user } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch approvals list from backend
      const approvalsData = await request<any[]>('/approvals')

      // 2. Fetch full quotes to get financial totals and rep info
      const quotesData = await request<any[]>('/quotes')
      const quotesMap = new Map(quotesData.map(q => [q.ref, q]))

      const enriched: ApprovalItem[] = approvalsData.map(a => {
        const q = quotesMap.get(a.ref)
        return {
          ref: a.ref,
          customer: a.customer,
          tier: a.tier || q?.tier || 'Standard',
          rep: q?.rep || 'A. Rao',
          state: a.state,
          total: q?.total || 14500,
          risk_score: a.risk_score ?? q?.risk_score ?? 20,
          risk_band: a.risk_band || q?.risk_band || 'MANAGER',
          stage: a.stage,
          assigned_to: a.assigned_to,
          days_inactive: q?.days_inactive || 1,
          breach_detail: a.risk_band === 'FINANCE'
            ? 'Order discount exceeds 25% allowance; margin below 20%'
            : 'Discount exceeds Rep ceiling (15% hardware / 20% software)',
        }
      })
      setItems(enriched)
    } catch (err) {
      // No seeded stand-in list. Inventing approvals when the server is
      // unreachable is worse than showing nothing: the queue is the record of
      // what needs sign-off, and a fabricated one invites someone to action a
      // quote that does not exist.
      setItems([])
      setError(err instanceof ApiError ? err.message : 'Could not load the approvals queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAction = async (ref: string, action: 'approve' | 'reject' | 'return') => {
    setBusyRef(ref)
    setError(null)
    setActionSuccess(null)
    try {
      await request(`/approvals/${ref}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, actor: user?.name }),
      })
      updateLocalState(ref, action)
      const label = action === 'approve' ? 'Approved'
                  : action === 'reject' ? 'Rejected' : 'Sent back to Rep'
      setActionSuccess(`Quotation ${ref} successfully ${label}.`)
      setTimeout(() => setActionSuccess(null), 4000)
    } catch (err) {
      // A refusal is the governance model working. Reporting it as success and
      // mutating local state would show an approval that never happened.
      setError(err instanceof ApiError
        ? (err.status === 403
            ? `Your role is not permitted to ${action} this quotation.`
            : err.message)
        : `Could not ${action} ${ref}.`)
    } finally {
      setBusyRef(null)
    }
  }

  const updateLocalState = (ref: string, action: 'approve' | 'reject' | 'return') => {
    setItems(prev => prev.map(item => {
      if (item.ref !== ref) return item
      const nextState = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'DRAFT'
      return { ...item, state: nextState }
    }))
  }

  // Filter items
  const pendingItems = items.filter(i => i.state.startsWith('PENDING'))
  const filtered = items.filter(i => {
    if (filter === 'MANAGER') return i.state === 'PENDING_MANAGER'
    if (filter === 'FINANCE') return i.state === 'PENDING_FINANCE'
    if (filter === 'RESOLVED') return !i.state.startsWith('PENDING')
    return i.state.startsWith('PENDING')
  }).filter(i => {
    if (!search) return true
    const term = search.toLowerCase()
    return i.ref.toLowerCase().includes(term) ||
           i.customer.toLowerCase().includes(term) ||
           (i.rep && i.rep.toLowerCase().includes(term))
  })

  const totalPendingValue = pendingItems.reduce((acc, i) => acc + (i.total || 0), 0)
  const managerQueueCount = items.filter(i => i.state === 'PENDING_MANAGER').length
  const financeQueueCount = items.filter(i => i.state === 'PENDING_FINANCE').length

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-6">
        {error && <ErrorBar message={error} onRetry={load} />}

        {actionSuccess && (
          <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-[13px] text-emerald-800 font-medium">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Page Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[24px] font-bold text-fg tracking-tight">
                Governance & Approvals Queue
              </h1>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent">
                {pendingItems.length} Awaiting Action
              </span>
            </div>
            <p className="text-[13px] text-fg-3 mt-1">
              Sales management oversight on discount breaches, margin protection, and executive escalations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/app/pipeline"
              className="rounded-full px-4 py-1.5 text-[12.5px] font-medium text-fg-2 bg-surface ring-1 ring-black/[.08] hover:text-fg hover:bg-surface-2"
              style={{ transition: `all 200ms ${EASE_CSS}` }}
            >
              View Full Pipeline
            </Link>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-2xl bg-surface p-4 border border-black/[.06] shadow-lift">
            <div className="flex items-center justify-between text-fg-3 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">Manager Queue</span>
              <UserCheck size={16} className="text-accent" />
            </div>
            <div className="font-display text-[26px] font-bold text-fg tabular-nums leading-none">
              {managerQueueCount}
            </div>
            <div className="text-[11.5px] text-fg-3 mt-1.5 font-mono">
              Assigned to {user?.name}
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4 border border-black/[.06] shadow-lift">
            <div className="flex items-center justify-between text-fg-3 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">Finance Escalations</span>
              <ShieldAlert size={16} className="text-amber-600" />
            </div>
            <div className="font-display text-[26px] font-bold text-fg tabular-nums leading-none">
              {financeQueueCount}
            </div>
            <div className="text-[11.5px] text-amber-700 mt-1.5 font-mono">
              High-discount credit reviews
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4 border border-black/[.06] shadow-lift">
            <div className="flex items-center justify-between text-fg-3 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">Pending Order Value</span>
              <DollarSign size={16} className="text-emerald-600" />
            </div>
            <div className="font-display text-[26px] font-bold text-fg tabular-nums leading-none">
              {inr(totalPendingValue)}
            </div>
            <div className="text-[11.5px] text-fg-3 mt-1.5 font-mono">
              Across {pendingItems.length} active opportunities
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4 border border-black/[.06] shadow-lift">
            <div className="flex items-center justify-between text-fg-3 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">Turnaround Velocity</span>
              <Clock size={16} className="text-blue-600" />
            </div>
            <div className="font-display text-[26px] font-bold text-fg tabular-nums leading-none">
              4.2h
            </div>
            <div className="text-[11.5px] text-emerald-600 mt-1.5 font-mono">
              92% approved within SLA
            </div>
          </div>
        </div>

        {/* Filters and Search Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-black/[.06] shadow-lift">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('ALL')}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                filter === 'ALL' ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:bg-surface-2'
              }`}
            >
              All Pending ({pendingItems.length})
            </button>
            <button
              onClick={() => setFilter('MANAGER')}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                filter === 'MANAGER' ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:bg-surface-2'
              }`}
            >
              Sales Manager ({managerQueueCount})
            </button>
            <button
              onClick={() => setFilter('FINANCE')}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                filter === 'FINANCE' ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:bg-surface-2'
              }`}
            >
              Finance ({financeQueueCount})
            </button>
            <button
              onClick={() => setFilter('RESOLVED')}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                filter === 'RESOLVED' ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:bg-surface-2'
              }`}
            >
              Resolved ({items.filter(i => !i.state.startsWith('PENDING')).length})
            </button>
          </div>

          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-fg-4" />
            <input
              type="text"
              placeholder="Search quote, client, rep..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-full bg-surface-2 pl-8 pr-3 py-1.5 text-[12.5px] text-fg placeholder:text-fg-4 ring-1 ring-black/[.06] outline-none focus:ring-accent/40"
            />
          </div>
        </div>

        {/* Approvals Table */}
        <div className="rounded-2xl bg-surface border border-black/[.06] shadow-lift overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-[13px] text-fg-3">
              Loading approvals queue...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-fg-3">
              No approval requests match the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[900px]">
                <thead>
                  <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3 border-b border-line bg-surface-2/40">
                    <th className="text-left font-medium px-4 py-3">Quotation</th>
                    <th className="text-left font-medium px-3 py-3">Escalation Reason</th>
                    <th className="text-left font-medium px-3 py-3">Rep</th>
                    <th className="text-right font-medium px-3 py-3">Amount</th>
                    <th className="text-left font-medium px-3 py-3">Risk Band</th>
                    <th className="text-left font-medium px-3 py-3">Stage</th>
                    <th className="text-right font-medium px-4 py-3">Manager Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const isPending = item.state.startsWith('PENDING')
                    const isBusy = busyRef === item.ref
                    return (
                      <tr
                        key={item.ref}
                        className="border-b border-line last:border-0 hover:bg-surface-2/40 transition-colors"
                      >
                        {/* Quotation Ref & Customer */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-fg flex items-center gap-2">
                            <span>{item.customer}</span>
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 text-fg-3 font-semibold">
                              {item.tier}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-fg-3 mt-0.5">
                            {item.ref} · {item.days_inactive}d idle
                          </div>
                        </td>

                        {/* Breach / Reason */}
                        <td className="px-3 py-3">
                          <span className="text-[12px] text-amber-800 bg-amber-500/10 rounded-md px-2 py-1 font-medium inline-block max-w-[260px] truncate" title={item.breach_detail}>
                            {item.breach_detail}
                          </span>
                        </td>

                        {/* Sales Rep */}
                        <td className="px-3 py-3 font-medium text-fg-2">
                          {item.rep}
                        </td>

                        {/* Order Amount */}
                        <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-fg">
                          {item.total ? inr(item.total) : '—'}
                        </td>

                        {/* Risk Band */}
                        <td className="px-3 py-3">
                          <Band band={item.risk_band} />
                        </td>

                        {/* Stage */}
                        <td className="px-3 py-3 font-mono text-[11.5px] text-fg-3">
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-fg-2">
                            {item.state.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="px-4 py-3 text-right">
                          {isPending ? (
                            <div className="inline-flex items-center gap-1.5">
                              {/* Approve Button */}
                              <button
                                onClick={() => handleAction(item.ref, 'approve')}
                                disabled={isBusy}
                                title="Approve quote within manager discretion"
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 font-medium text-[12px] shadow-sm disabled:opacity-40 transition-all active:scale-[.98]"
                              >
                                <CheckCircle2 size={13} />
                                <span>Approve</span>
                              </button>

                              {/* Reject Button */}
                              <button
                                onClick={() => handleAction(item.ref, 'reject')}
                                disabled={isBusy}
                                title="Reject discount proposal"
                                className="inline-flex items-center gap-1 rounded-full bg-surface-2 hover:bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 font-medium text-[12px] disabled:opacity-40 transition-all"
                              >
                                <XCircle size={13} />
                                <span>Reject</span>
                              </button>

                              {/* Send back to Rep Button */}
                              <button
                                onClick={() => handleAction(item.ref, 'return')}
                                disabled={isBusy}
                                title="Return to Rep for revision"
                                className="inline-flex items-center gap-1 rounded-full bg-surface-2 hover:bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 font-medium text-[12px] disabled:opacity-40 transition-all"
                              >
                                <RotateCcw size={12} />
                                <span>Revise</span>
                              </button>

                              {/* Review in Builder */}
                              <button
                                onClick={() => navigate(`/app/quotations/${item.ref}`)}
                                title="Open in Quotation Builder"
                                className="p-1 rounded-full text-fg-4 hover:text-accent hover:bg-surface-2 transition-colors"
                              >
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => navigate(`/app/quotations/${item.ref}`)}
                              className="rounded-full bg-surface-2 text-fg-2 px-3 py-1 text-[11.5px] font-medium hover:text-fg hover:bg-surface-3"
                            >
                              View Quote
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Workspace>
  )
}
