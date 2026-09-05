import { useCallback, useEffect, useState } from 'react'
import { Plus, Power } from 'lucide-react'
import { ApiError, adminApi, type SubscriptionPlan } from '../lib/authClient'
import { ErrorBar, Workspace } from '../components/Workspace'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { cn } from '../lib/cn'

/**
 * Master subscription plans — admin only.
 *
 * A plan is a commercial template, not a subscription. Editing one changes the
 * terms of the next cycle for everything referencing it, which is why the form
 * says so and why withdrawal deactivates rather than deletes: invoices already
 * raised have to stay explainable after a plan leaves the price book.
 */

const CYCLES = ['monthly', 'quarterly', 'yearly'] as const
const RULES = [
  { value: 'calendar_daily', label: 'Calendar daily — pro rata by days remaining' },
  { value: 'full_period', label: 'Full period — charge or credit the whole cycle' },
  { value: 'none', label: 'None — changes take effect next cycle' },
]

const BLANK = {
  name: '', code: '', billing_cycle: 'monthly' as const,
  base_price: '', proration_rule: 'calendar_daily',
  cancellation_notice_days: '30',
}

export default function AdminSubscriptions() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({ ...BLANK })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    adminApi.plans(true)
      .then(p => { setPlans(p); setError(null) })
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load plans.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const openCreate = () => { setForm({ ...BLANK }); setEditing(null); setCreating(true) }
  const openEdit = (p: SubscriptionPlan) => {
    setForm({
      name: p.name, code: p.code, billing_cycle: p.billing_cycle,
      base_price: String(p.base_price), proration_rule: p.proration_rule,
      cancellation_notice_days: String(p.cancellation_notice_days),
    })
    setEditing(p); setCreating(false)
  }
  const close = () => { setEditing(null); setCreating(false); setBusy(false) }

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setBusy(true); setError(null)
    const body = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      billing_cycle: form.billing_cycle as SubscriptionPlan['billing_cycle'],
      base_price: Number(form.base_price),
      proration_rule: form.proration_rule,
      cancellation_notice_days: Number(form.cancellation_notice_days),
    }
    try {
      if (editing) {
        await adminApi.updatePlan(editing.id, body)
        setNotice(`${body.name} updated. New terms apply from the next cycle.`)
      } else {
        await adminApi.createPlan(body)
        setNotice(`${body.name} added to the price book.`)
      }
      close(); load()
      setTimeout(() => setNotice(null), 4000)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the plan.')
      setBusy(false)
    }
  }

  const toggle = async (p: SubscriptionPlan) => {
    setError(null)
    try {
      if (p.is_active) {
        const r = await adminApi.deactivatePlan(p.id)
        setNotice(r.message)
      } else {
        await adminApi.updatePlan(p.id, { is_active: true })
        setNotice(`${p.name} is back on sale.`)
      }
      load()
      setTimeout(() => setNotice(null), 4000)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change that plan.')
    }
  }

  const valid = form.name.trim() && form.code.trim()
    && form.base_price !== '' && Number(form.base_price) >= 0

  const field = (key: string, label: string, extra: Record<string, any> = {}) => (
    <label className="flex flex-col gap-1.5">
      <span className="metric-label">{label}</span>
      <input
        value={form[key] ?? ''}
        onChange={e => set(key)(e.target.value)}
        {...extra}
        className="rounded-md bg-surface px-3 py-2 text-[13px] text-fg
                   ring-1 ring-black/[.09] outline-none focus:ring-accent/45
                   placeholder:text-fg-4"
      />
    </label>
  )

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-3">
        {error && <ErrorBar message={error} onRetry={load} />}
        {notice && (
          <div className="rounded-xl bg-band-autoWash border border-band-auto/25
                          px-4 py-2.5 text-[12.5px] text-band-auto">{notice}</div>
        )}

        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">
            Subscription plans
          </h1>
          <p className="text-[12px] text-fg-3">
            The price book recurring lines are sold from.
          </p>
          <button onClick={openCreate} className="ctl ctl-primary ml-auto">
            <Plus size={13} /> New plan
          </button>
        </header>

        <div className="panel">
          {loading ? (
            <p className="px-4 py-12 text-center text-[12.5px] text-fg-3">Loading plans…</p>
          ) : plans.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="text-[13px] text-fg-2">No subscription plans yet.</p>
              <button onClick={openCreate} className="ctl ctl-primary mt-3">
                <Plus size={13} /> Create the first one
              </button>
            </div>
          ) : (
            <div className="scroll-x">
              <table className="grid-table min-w-[860px]">
                <thead>
                  <tr>
                    <th>Plan</th><th>Code</th><th>Cycle</th>
                    <th className="text-right">Base price</th>
                    <th>Proration</th>
                    <th className="text-right">Notice</th>
                    <th>Status</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.id} className={cn(!p.is_active && 'opacity-55')}>
                      <td className="text-fg font-medium">{p.name}</td>
                      <td><span className="key text-fg-2">{p.code}</span></td>
                      <td className="text-fg-2 capitalize">{p.billing_cycle}</td>
                      <td className="num text-fg font-medium">
                        <AnimatedNumber value={p.base_price} format="inr" flash={false} />
                      </td>
                      <td className="text-fg-3">{p.proration_rule.replace(/_/g, ' ')}</td>
                      <td className="num text-fg-2">{p.cancellation_notice_days}d</td>
                      <td>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold',
                          p.is_active
                            ? 'bg-band-autoWash text-band-auto'
                            : 'bg-surface-2 text-fg-3',
                        )}>
                          {p.is_active ? 'ACTIVE' : 'WITHDRAWN'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => openEdit(p)} className="ctl py-1 text-[11px] mr-1.5">
                          Edit
                        </button>
                        <button
                          onClick={() => toggle(p)}
                          className={cn('ctl py-1 text-[11px]', p.is_active && 'ctl-danger')}
                        >
                          <Power size={11} /> {p.is_active ? 'Withdraw' : 'Reinstate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(creating || editing) && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-fg/25 backdrop-blur-[2px] px-5"
            role="dialog" aria-modal="true"
            onClick={e => { if (e.target === e.currentTarget) close() }}
          >
            <div className="w-full max-w-[560px] rounded-2xl bg-surface ring-1 ring-black/[.08]
                            shadow-lift-lg p-6 flex flex-col gap-4">
              <div>
                <h2 className="font-display text-[18px] font-bold text-fg tracking-tight">
                  {editing ? `Edit ${editing.name}` : 'New subscription plan'}
                </h2>
                {editing && (
                  <p className="text-[12px] text-fg-3 mt-1 leading-relaxed">
                    Changes apply from the next billing cycle. Invoices already
                    raised are not altered.
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {field('name', 'Plan name', { placeholder: 'Enterprise Cloud Tier' })}
                {field('code', 'Code', {
                  placeholder: 'ENT-CLOUD',
                  disabled: !!editing,
                  title: editing ? 'The code is the stable identifier and cannot change' : undefined,
                })}

                <label className="flex flex-col gap-1.5">
                  <span className="metric-label">Billing cycle</span>
                  <select
                    value={form.billing_cycle}
                    onChange={e => set('billing_cycle')(e.target.value)}
                    className="rounded-md bg-surface px-3 py-2 text-[13px] text-fg
                               ring-1 ring-black/[.09] outline-none focus:ring-accent/45"
                  >
                    {CYCLES.map(c => (
                      <option key={c} value={c} className="capitalize">{c}</option>
                    ))}
                  </select>
                </label>

                {field('base_price', 'Base price (₹)', {
                  inputMode: 'decimal', placeholder: '2400',
                })}

                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="metric-label">Proration rule</span>
                  <select
                    value={form.proration_rule}
                    onChange={e => set('proration_rule')(e.target.value)}
                    className="rounded-md bg-surface px-3 py-2 text-[13px] text-fg
                               ring-1 ring-black/[.09] outline-none focus:ring-accent/45"
                  >
                    {RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>

                {field('cancellation_notice_days', 'Cancellation notice (days)', {
                  inputMode: 'numeric', placeholder: '30',
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={save}
                  disabled={!valid || busy}
                  className="rounded-full bg-fg text-white px-5 py-2.5 font-display text-[13px]
                             font-semibold hover:shadow-lift-lg active:scale-[.98]
                             disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {busy ? 'Saving…' : editing ? 'Save changes' : 'Create plan'}
                </button>
                <button onClick={close}
                        className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2.5
                                   font-display text-[13px] font-medium text-fg-2 hover:text-fg">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Workspace>
  )
}
