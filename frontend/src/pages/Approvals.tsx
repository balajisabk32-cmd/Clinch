import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, request } from '../lib/authClient'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
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
  ArrowRightLeft,
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
  rep_id?: string
  state: string
  total?: number
  risk_score: number
  risk_band: 'AUTO' | 'MANAGER' | 'FINANCE'
  stage?: string
  assigned_to?: string
  days_inactive?: number
  breach_detail?: string
  source?: string
  is_unassigned?: boolean
  manager_id?: string
  manager_name?: string
}

export default function Approvals() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'MANAGER' | 'FINANCE' | 'UNASSIGNED' | 'RESOLVED'>('ALL')
  const [search, setSearch] = useState('')
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [busyRef, setBusyRef] = useState<string | null>(null)
  // Returning a deal needs a reason, so it needs a dialog. Approve and reject
  // stay one-click: the reviewer has already read the quotation to decide.
  const [revising, setRevising] = useState<ApprovalItem | null>(null)
  const [revisionNote, setRevisionNote] = useState('')
  const MIN_NOTE = 10
  // The turnaround figure was hardcoded '4.2h / 92% within SLA' while the
  // dashboard reported the real median from the same event log. Two screens
  // stating different values for one metric is worse than showing neither,
  // so this reads the computed figure and the SLA claim is gone -- nothing
  // in the engine defines an SLA to measure against.
  const [dash, setDash] = useState<any>(null)

  // Reassignment modal state
  const [reassignTarget, setReassignTarget] = useState<ApprovalItem | null>(null)
  const [selectedNewRep, setSelectedNewRep] = useState<string>('rep_rao')
  const [permanentUpdate, setPermanentUpdate] = useState<boolean>(true)
  const [reassigning, setReassigning] = useState<boolean>(false)
  const [repsList, setRepsList] = useState<any[]>([])

  const [managerFilter, setManagerFilter] = useState<string>('ALL')
  const [repFilter, setRepFilter] = useState<string>('ALL')

  const { user: authUser } = useAuth()
  const user = useMemo(() => {
    if (authUser) {
      return {
        name: authUser.name,
        role: authUser.role.toLowerCase(),
        email: authUser.email,
      }
    }
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('dealflow_user') : null
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...parsed,
          role: (parsed.role || 'manager').toLowerCase(),
        }
      }
      return { name: 'M. Shah', role: 'manager' }
    } catch {
      return { name: 'M. Shah', role: 'manager' }
    }
  }, [authUser])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch approvals list from backend
      const approvalsData = await request<any[]>('/approvals')

      // 2. Fetch full quotes to get financial totals and rep info
      const quotesData = await request<any[]>('/quotes')
      request<any>('/dashboard').then(setDash).catch(() => { /* header degrades */ })
      const quotesMap = new Map(quotesData.map(q => [q.ref, q]))

      // 3. Fetch sales reps list for reassignment dropdown
      try {
        const repsRes = await fetch('/api/users/reps')
        if (repsRes.ok) setRepsList(await repsRes.json())
      } catch {}

      const enriched: ApprovalItem[] = approvalsData.map(a => {
        const q = quotesMap.get(a.ref)
        const isUnassigned = a.is_unassigned || q?.is_unassigned || a.rep === 'Unassigned' || q?.rep === 'Unassigned'
        return {
          ref: a.ref,
          customer: a.customer,
          tier: a.tier || q?.tier || 'Standard',
          rep: a.rep || q?.rep || 'A. Rao',
          rep_id: a.rep_id || q?.rep_id || 'rep_rao',
          state: a.state,
          total: q?.total || 14500,
          risk_score: a.risk_score ?? q?.risk_score ?? 20,
          risk_band: a.risk_band || q?.risk_band || 'MANAGER',
          stage: a.stage,
          assigned_to: a.assigned_to,
          manager_id: a.manager_id,
          manager_name: a.manager_name || 'M. Shah',
          days_inactive: q?.days_inactive || 1,
          source: a.source || q?.source || 'Customer Request',
          is_unassigned: isUnassigned,
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

  const sendRevision = async () => {
    if (!revising) return
    const note = revisionNote.trim()
    if (note.length < MIN_NOTE) return
    setBusyRef(revising.ref)
    setError(null)
    try {
      await request(`/quotes/${revising.ref}/return-revision`, {
        method: 'POST',
        body: JSON.stringify({ manager_notes: note }),
      })
      setActionSuccess(`${revising.ref} returned to the rep with your note.`)
      setTimeout(() => setActionSuccess(null), 4000)
      setRevising(null)
      setRevisionNote('')
      load()
    } catch (err) {
      setError(err instanceof ApiError
        ? (err.status === 403
            ? 'Your role is not permitted to return this quotation.'
            : err.message)
        : 'Could not return that quotation.')
    } finally {
      setBusyRef(null)
    }
  }

  const handleAction = async (ref: string, action: 'approve' | 'reject' | 'return') => {
    setBusyRef(ref)
    setError(null)
    setActionSuccess(null)
    try {
      const res = await request<any>(`/approvals/${ref}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, actor: user?.name }),
      })
      const nextState = res?.state ?? (action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'DRAFT')
      setItems(prev => prev.map(item => {
        if (item.ref !== ref) return item
        return {
          ...item,
          state: nextState,
          stage: nextState === 'PENDING_FINANCE' ? 'Finance' : item.stage,
          assigned_to: nextState === 'PENDING_FINANCE' ? 'R. Menon' : item.assigned_to,
        }
      }))
      const label = action === 'approve'
        ? (nextState === 'PENDING_FINANCE'
            ? 'approved at Level 1 (Sales Manager) and escalated to Finance (Level 2)'
            : 'approved successfully')
        : action === 'reject' ? 'rejected' : 'sent back to Rep'
      setActionSuccess(`Quotation ${ref} ${label}.`)
      setTimeout(() => setActionSuccess(null), 4000)
      load()
    } catch (err) {
      setError(err instanceof ApiError
        ? (err.status === 403
            ? `Your role is not permitted to ${action} this quotation.`
            : err.message)
        : `Could not ${action} ${ref}.`)
    } finally {
      setBusyRef(null)
    }
  }

  const handleReassign = async () => {
    if (!reassignTarget) return
    setReassigning(true)
    setError(null)
    try {
      const res = await fetch(`/api/quotes/${reassignTarget.ref}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_rep_id: selectedNewRep,
          actor: user.name || 'M. Shah',
          update_customer_assigned_rep: permanentUpdate,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        const repObj = repsList.find((r: any) => r.id === selectedNewRep)
        const repName = repObj ? repObj.name : selectedNewRep
        setItems(prev => prev.map(item => item.ref === reassignTarget.ref ? {
          ...item,
          rep: repName,
          rep_id: selectedNewRep,
          is_unassigned: false,
        } : item))
        setActionSuccess(`Quotation ${reassignTarget.ref} reassigned to ${repName}${permanentUpdate ? ' (Customer account ownership updated)' : ''}.`)
        setReassignTarget(null)
        setTimeout(() => setActionSuccess(null), 4500)
      } else {
        throw new Error(data.error || 'Failed to reassign')
      }
    } catch (err: any) {
      setError(`Failed to reassign quote (${err?.message || 'unknown'}).`)
    } finally {
      setReassigning(false)
    }
  }

  // Dynamic Manager and Rep options extracted from current items
  const managerOptions = useMemo(() => {
    if (user?.role === 'manager' && user.name) {
      return [user.name]
    }
    const set = new Set<string>()
    items.forEach(i => {
      if (i.assigned_to && i.assigned_to !== '—') set.add(i.assigned_to)
    })
    if (user?.name && ['manager', 'admin'].includes(user.role)) {
      set.add(user.name)
    }
    return Array.from(set).sort()
  }, [items, user])

  const repOptions = useMemo(() => {
    const set = new Set<string>()
    items.forEach(i => {
      if (i.rep && i.rep !== '—') set.add(i.rep)
    })
    return Array.from(set).sort()
  }, [items])

  // Filter items
  const pendingItems = items.filter(i => i.state.startsWith('PENDING'))
  const unassignedCount = items.filter(i => (i.is_unassigned || i.rep === 'Unassigned') && i.state.startsWith('PENDING')).length

  const filtered = items.filter(i => {
    const isUnassigned = i.is_unassigned || i.rep === 'Unassigned'
    if (filter === 'MANAGER') return i.state === 'PENDING_MANAGER' && !isUnassigned
    if (filter === 'FINANCE') return i.state === 'PENDING_FINANCE'
    if (filter === 'UNASSIGNED') return isUnassigned && i.state.startsWith('PENDING')
    if (filter === 'RESOLVED') return !i.state.startsWith('PENDING')
    return i.state.startsWith('PENDING')
  }).filter(i => {
    if (managerFilter === 'ALL') return true
    if (managerFilter === 'MINE') {
      return (user?.name && i.assigned_to === user.name) ||
             (user?.role === 'manager' && i.state === 'PENDING_MANAGER')
    }
    return i.assigned_to === managerFilter
  }).filter(i => {
    if (repFilter === 'ALL') return true
    return i.rep === repFilter
  }).filter(i => {
    if (!search) return true
    const term = search.toLowerCase()
    return i.ref.toLowerCase().includes(term) ||
           i.customer.toLowerCase().includes(term) ||
           (i.rep && i.rep.toLowerCase().includes(term)) ||
           (i.assigned_to && i.assigned_to.toLowerCase().includes(term))
  })

  const totalPendingValue = pendingItems.reduce((acc, i) => acc + (i.total || 0), 0)
  const managerQueueCount = items.filter(i => i.state === 'PENDING_MANAGER' && !i.is_unassigned && i.rep !== 'Unassigned').length
  const financeQueueCount = items.filter(i => i.state === 'PENDING_FINANCE').length

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-6">
        {error && <ErrorBar message={error} onRetry={load} />}

        {actionSuccess && (
          <div className="flex items-center gap-2.5 rounded-xl bg-band-auto/10 border border-band-auto/25 px-4 py-3 text-[13px] text-band-auto font-medium">
            <CheckCircle2 size={16} className="text-band-auto shrink-0" />
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
              Sales management oversight on discount breaches, customer-to-rep routing, margin protection, and executive escalations.
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
        <div className="panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line">
          <div className="metric">
            <div className="flex items-center justify-between text-fg-3 mb-2">
              <span className="metric-label">Manager Queue</span>
              <UserCheck size={16} className="text-accent" />
            </div>
            <AnimatedNumber value={managerQueueCount} format="int"
                            polarity="lower-better" className="metric-value" />
            <div className="text-[11.5px] text-fg-3 mt-1.5 font-mono">
              Assigned to {user?.name}
            </div>
          </div>

          <div className="metric">
            <div className="flex items-center justify-between text-fg-3 mb-2">
              <span className="metric-label">Finance Escalations</span>
              <ShieldAlert size={16} className="text-band-manager" />
            </div>
            <AnimatedNumber value={financeQueueCount} format="int"
                            polarity="lower-better" className="metric-value" />
            <div className="text-[11.5px] text-band-manager mt-1.5 font-mono">
              High-discount credit reviews
            </div>
          </div>

          <div className="metric">
            <div className="flex items-center justify-between text-fg-3 mb-2">
              <span className="metric-label">Pending Order Value</span>
              <DollarSign size={16} className="text-band-auto" />
            </div>
            <AnimatedNumber value={totalPendingValue} format="inr"
                            className="metric-value" />
            <div className="text-[11.5px] text-fg-3 mt-1.5 font-mono">
              Across {pendingItems.length} active opportunities
            </div>
          </div>

          <div className="metric">
            <div className="flex items-center justify-between text-fg-3 mb-2">
              <span className="metric-label">Turnaround Velocity</span>
              <Clock size={16} className="text-accent" />
            </div>
            {dash ? (
              <AnimatedNumber
                value={dash.median_approval_hours} format="dec" precision={0} suffix="h"
                polarity="lower-better"
                className="font-display text-[26px] font-bold text-fg leading-none"
              />
            ) : (
              <div className="font-display text-[26px] font-bold text-fg-4 leading-none">—</div>
            )}
            <div className="text-[11.5px] text-fg-3 mt-1.5 font-mono">
              Median, submission to sign-off
            </div>
          </div>
        </div>

        {/* Filters and Search Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-black/[.06] shadow-lift">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilter('ALL')}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150 ${
                filter === 'ALL' ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:bg-surface-2'
              }`}
            >
              All Pending ({pendingItems.length})
            </button>
            <button
              onClick={() => setFilter('MANAGER')}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150 ${
                filter === 'MANAGER' ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:bg-surface-2'
              }`}
            >
              Sales Manager ({managerQueueCount})
            </button>
            <button
              onClick={() => setFilter('FINANCE')}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150 ${
                filter === 'FINANCE' ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:bg-surface-2'
              }`}
            >
              Finance ({financeQueueCount})
            </button>
            {unassignedCount > 0 && (
              <button
                onClick={() => setFilter('UNASSIGNED')}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all flex items-center gap-1.5 ${
                  filter === 'UNASSIGNED' ? 'bg-rose-700 text-white shadow-sm' : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <span>⚠️ Unassigned Requests</span>
                <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                  {unassignedCount}
                </span>
              </button>
            )}
            <button
              onClick={() => setFilter('RESOLVED')}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150 ${
                filter === 'RESOLVED' ? 'bg-fg text-white shadow-sm' : 'text-fg-2 hover:bg-surface-2'
              }`}
            >
              Resolved ({items.filter(i => !i.state.startsWith('PENDING')).length})
            </button>
          </div>

          {/* Manager & Rep Dropdowns + Search */}
          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {/* Filter by Manager (Only needed for Admins / Finance) */}
            {user?.role !== 'manager' ? (
              <div className="flex items-center gap-1.5">
                <label htmlFor="manager-filter" className="text-[11.5px] text-fg-3 font-medium flex items-center gap-1">
                  <UserCheck size={13} className="text-accent" />
                  <span>Manager:</span>
                </label>
                <select
                  id="manager-filter"
                  value={managerFilter}
                  onChange={e => setManagerFilter(e.target.value)}
                  className="rounded-lg bg-surface px-2.5 py-1 text-[12px] text-fg ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                >
                  <option value="ALL">All Managers</option>
                  {managerOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line text-[12px] text-fg">
                <UserCheck size={13} className="text-accent" />
                <span className="text-[11.5px] text-fg-3 font-medium">Cluster:</span>
                <span className="font-semibold text-accent">{user.name}'s Reps</span>
              </div>
            )}

            {/* Filter by Rep */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="rep-filter" className="text-[11.5px] text-fg-3 font-medium">
                Rep:
              </label>
              <select
                id="rep-filter"
                value={repFilter}
                onChange={e => setRepFilter(e.target.value)}
                className="rounded-lg bg-surface px-2.5 py-1 text-[12px] text-fg ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
              >
                <option value="ALL">All Reps</option>
                {repOptions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-48 sm:w-56">
              <Search size={14} className="absolute left-3 top-2 text-fg-4" />
              <input
                type="text"
                placeholder="Filter quote, client, rep..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-full bg-surface-2 pl-8 pr-3 py-1 text-[12px] text-fg placeholder:text-fg-4 ring-1 ring-black/[.06] outline-none focus:ring-accent/40"
              />
            </div>
          </div>
        </div>

        {/* Return for revision. A modal rather than an inline field because
            the note is mandatory and the reviewer should not be able to fire
            the action by reflex from the row. */}
        {revising && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-fg/25 backdrop-blur-[2px] px-5"
            role="dialog" aria-modal="true" aria-label="Return for revision"
            onClick={e => { if (e.target === e.currentTarget) setRevising(null) }}
          >
            <div className="w-full max-w-[520px] rounded-2xl bg-surface ring-1 ring-black/[.08]
                            shadow-lift-lg p-6 flex flex-col gap-4">
              <div>
                <h2 className="font-display text-[18px] font-bold text-fg tracking-tight">
                  Return {revising.ref} for revision
                </h2>
                <p className="text-[12.5px] text-fg-2 mt-1.5 leading-relaxed">
                  {revising.customer} · {inr(revising.total ?? 0)} · risk {(revising.risk_score ?? 0).toFixed(1)}
                </p>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  What needs to change
                </span>
                <textarea
                  autoFocus
                  rows={4}
                  value={revisionNote}
                  onChange={e => setRevisionNote(e.target.value)}
                  placeholder="Reduce 17% to 14% for Laptop 14 Pro Max to meet Gold tier category limit."
                  className="rounded-lg bg-surface px-3.5 py-2.5 text-[13.5px] text-fg resize-y
                             ring-1 ring-black/[.09] outline-none focus:ring-accent/45
                             placeholder:text-fg-4"
                />
                <span className={`text-[11.5px] ${
                  revisionNote.trim().length >= MIN_NOTE ? 'text-fg-3' : 'text-band-manager'}`}>
                  {revisionNote.trim().length < MIN_NOTE
                    ? `At least ${MIN_NOTE} characters — the rep sees this note and nothing else.`
                    : 'The rep sees this on their Action required tab.'}
                </span>
              </label>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={sendRevision}
                  disabled={revisionNote.trim().length < MIN_NOTE || busyRef === revising.ref}
                  className="rounded-full bg-fg text-white px-5 py-2.5 font-display text-[13px]
                             font-semibold hover:shadow-lift-lg active:scale-[.98]
                             disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {busyRef === revising.ref ? 'Returning…' : 'Return to rep'}
                </button>
                <button
                  onClick={() => setRevising(null)}
                  className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2.5
                             font-display text-[13px] font-medium text-fg-2 hover:text-fg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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
                    <th className="text-left font-medium px-3 py-3">Assigned Approver</th>
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
                          <span className="text-[12px] text-band-manager bg-band-manager/10 rounded-md px-2 py-1 font-medium inline-block max-w-[260px] truncate" title={item.breach_detail}>
                            {item.breach_detail}
                          </span>
                        </td>

                        {/* Sales Rep */}
                        <td className="px-3 py-3">
                          {item.is_unassigned || item.rep === 'Unassigned' ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-[11px]">
                                ⚠️ Unassigned
                              </span>
                              <div className="text-[10px] text-fg-4 mt-0.5">Needs rep assignment</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium text-fg">{item.rep}</div>
                              {item.source === 'Customer Request' && (
                                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 px-1.5 py-0.2 text-[9px] font-bold mt-0.5">
                                  Customer Request
                                </span>
                              )}
                              <div className="text-[10px] text-fg-3">Manager: {item.manager_name || 'M. Shah'}</div>
                            </div>
                          )}
                        </td>

                        {/* Order Amount */}
                        <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-fg">
                          {item.total ? inr(item.total) : '—'}
                        </td>

                        {/* Risk Band */}
                        <td className="px-3 py-3">
                          <Band band={item.risk_band} />
                        </td>

                        {/* Assigned Approver */}
                        <td className="px-3 py-3 font-medium text-fg-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-2 text-[11.5px] text-fg-2 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                            {item.assigned_to || (item.state === 'PENDING_FINANCE' ? 'R. Menon' : 'M. Shah')}
                          </span>
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
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {/* Reassign Button */}
                              {['manager', 'admin'].includes(user?.role) && (
                                <button
                                  onClick={() => {
                                    setReassignTarget(item)
                                    setSelectedNewRep(item.rep_id || (repsList[0]?.id || 'rep_rao'))
                                    setPermanentUpdate(true)
                                  }}
                                  disabled={isBusy}
                                  title="Reassign to another Sales Rep"
                                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 hover:bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 font-medium text-[12px] disabled:opacity-40 transition-all"
                                >
                                  <ArrowRightLeft size={12} />
                                  <span>Reassign</span>
                                </button>
                              )}

                              {item.state === 'PENDING_MANAGER' && user?.role === 'finance' ? (
                                <span className="font-mono text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                  Awaiting Sales Manager (L1)
                                </span>
                              ) : item.state === 'PENDING_FINANCE' && user?.role === 'manager' ? (
                                <span className="font-mono text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                  Awaiting Finance (L2)
                                </span>
                              ) : (
                                <>
                                  {/* Approve Button */}
                                  <button
                                    onClick={() => handleAction(item.ref, 'approve')}
                                    disabled={isBusy}
                                    title={item.state === 'PENDING_FINANCE' ? "Finance second-level approval" : "Sales manager approval"}
                                    className={`inline-flex items-center gap-1 rounded-full text-white px-3 py-1 font-medium text-[12px] shadow-sm disabled:opacity-40 transition-all active:scale-[.98] ${
                                      item.state === 'PENDING_FINANCE' ? 'bg-band-finance hover:brightness-110' : 'bg-band-auto hover:bg-band-auto'
                                    }`}
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>{item.state === 'PENDING_FINANCE' ? 'Approve (Finance)' : 'Approve'}</span>
                                  </button>

                                  {/* Reject Button */}
                                  <button
                                    onClick={() => handleAction(item.ref, 'reject')}
                                    disabled={isBusy}
                                    title="Reject discount proposal"
                                    className="inline-flex items-center gap-1 rounded-full bg-surface-2 hover:bg-band-financeWash text-band-finance border border-band-finance px-2.5 py-1 font-medium text-[12px] disabled:opacity-40 transition-all"
                                  >
                                    <XCircle size={13} />
                                    <span>Reject</span>
                                  </button>

                                  {/* Send back to Rep Button */}
                                  <button
                                    onClick={() => { setRevising(item); setRevisionNote('') }}
                                    disabled={isBusy}
                                    title="Return to Rep for revision"
                                    className="inline-flex items-center gap-1 rounded-full bg-surface-2 hover:bg-band-managerWash text-band-manager border border-band-manager px-2.5 py-1 font-medium text-[12px] disabled:opacity-40 transition-all"
                                  >
                                    <RotateCcw size={12} />
                                    <span>Return</span>
                                  </button>
                                </>
                              )}

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

        {/* Reassignment Modal */}
        {reassignTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-surface border border-line p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                    <ArrowRightLeft size={16} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-[16px] text-fg">Reassign Quotation</h3>
                    <p className="font-mono text-[11px] text-fg-3">{reassignTarget.ref} · {reassignTarget.customer}</p>
                  </div>
                </div>
                <button
                  onClick={() => setReassignTarget(null)}
                  className="rounded-full p-1 text-fg-3 hover:text-fg hover:bg-surface-2"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-fg-2 mb-1">
                    Current Account Owner
                  </label>
                  <div className="px-3 py-2 rounded-xl bg-surface-2 border border-line font-medium text-[13px] text-fg">
                    {reassignTarget.rep || 'Unassigned'}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-fg-2 mb-1">
                    Select New Sales Rep
                  </label>
                  <select
                    value={selectedNewRep}
                    onChange={e => setSelectedNewRep(e.target.value)}
                    className="w-full rounded-xl bg-surface border border-line px-3 py-2 text-[13px] text-fg outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {repsList.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.email}) — Reports to: {r.manager_name || 'M. Shah'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl bg-accent/5 border border-accent/20 p-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permanentUpdate}
                      onChange={e => setPermanentUpdate(e.target.checked)}
                      className="mt-0.5 rounded border-line text-accent focus:ring-accent"
                    />
                    <div className="text-[12px] leading-snug">
                      <span className="font-semibold text-fg">Permanently update Customer Account Owner</span>
                      <p className="text-fg-3 mt-0.5 text-[11px]">
                        Future quotation requests submitted by {reassignTarget.customer} will automatically land in the selected rep's pipeline.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setReassignTarget(null)}
                    className="rounded-full px-4 py-1.5 text-[12.5px] font-medium text-fg-2 hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={reassigning}
                    onClick={handleReassign}
                    className="rounded-full bg-fg text-white px-5 py-1.5 text-[12.5px] font-semibold hover:shadow-lift active:scale-[.98] disabled:opacity-50"
                  >
                    {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Workspace>
  )
}
