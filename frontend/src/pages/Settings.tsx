import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Band } from '../components/ui'
import { ErrorBar, Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'

/**
 * Discount Tiers & Approval Chain — wireframe screen 18, PS A3.
 *
 * Not a CRUD form. Editing a ceiling re-scores the whole open pipeline against
 * the PROPOSED policy and shows the blast radius before anything is saved,
 * because scoring is a pure function of (policy, quote) and can therefore be
 * run against a policy that does not yet exist.
 *
 * The simulate call is fired on every edit — it returns in a few milliseconds
 * because it never touches the database.
 */

interface Policy {
  tier_ceiling: Record<string, number>
  category_ceiling: Record<string, number>
  weights: Record<string, number>
  caps: Record<string, number>
  bands: Array<[number, number, string]>
  hard_override_pts: number
  stall_days: number
  version: number
  warnings: string[]
}

interface Impact {
  ref: string; customer: string
  score_before: number; score_after: number
  band_before: string; band_after: string
  changed: boolean; direction: 'escalated' | 'relaxed' | 'unchanged'
}

interface Sim {
  quotes_evaluated: number; quotes_changed: number
  escalated: number; relaxed: number
  leakage_before: number; leakage_after: number; leakage_recovered: number
  band_counts_before: Record<string, number>
  band_counts_after: Record<string, number>
  headline: string; elapsed_ms: number
  impacts: Impact[]
}

export default function Settings() {
  const [live, setLive] = useState<Policy | null>(null)
  const [draft, setDraft] = useState<Policy | null>(null)
  const [sim, setSim] = useState<Sim | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.policy()
      .then(p => { setLive(p); setDraft(p); setSim(null); setError(null) })
      .catch(e => setError(`Could not load policy (${e?.message ?? 'unknown error'}).`))
  }, [])
  useEffect(load, [load])

  const dirty = !!live && !!draft &&
    JSON.stringify({ t: live.tier_ceiling, c: live.category_ceiling }) !==
    JSON.stringify({ t: draft.tier_ceiling, c: draft.category_ceiling })

  /** Re-score the pipeline against the unsaved draft. Nothing is persisted. */
  const simulate = useCallback((next: Policy) => {
    api.simulate({ tier_ceiling: next.tier_ceiling,
                   category_ceiling: next.category_ceiling })
      .then(r => setSim(r as unknown as Sim))
      .catch(() => setSim(null))
  }, [])

  const edit = (group: 'tier_ceiling' | 'category_ceiling', key: string, value: number) => {
    if (!draft) return
    const next = { ...draft, [group]: { ...draft[group], [key]: value } }
    setDraft(next)
    simulate(next)
  }

  const apply = async () => {
    if (!draft) return
    setBusy(true); setError(null)
    try {
      await api.applyPolicy({ tier_ceiling: draft.tier_ceiling,
                              category_ceiling: draft.category_ceiling })
      setNotice('Policy applied. Open quotations have been re-routed.')
      load()
    } catch (e: any) {
      setError(e?.message?.includes('403')
        ? 'Your role is not permitted to change discount policy — this is a Manager or Admin action.'
        : `Could not save the policy (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  if (!draft || !live) {
    return (
      <Workspace onReload={load}>
        {error ? <ErrorBar message={error} onRetry={load} />
               : <p className="text-[13px] text-fg-3">Loading policy…</p>}
      </Workspace>
    )
  }

  const Ceiling = ({ group, label, entries }: {
    group: 'tier_ceiling' | 'category_ceiling'; label: string
    entries: Record<string, number>
  }) => (
    <div className="panel p-5">
      <h2 className="font-display text-[14px] font-semibold text-fg mb-3">{label}</h2>
      <div className="flex flex-col gap-2.5">
        {Object.entries(entries).map(([k, v]) => {
          const changed = live[group][k] !== v
          return (
            <label key={k} className="flex items-center gap-3">
              <span className="text-[13px] text-fg flex-1">{k}</span>
              {changed && (
                <span className="font-mono text-[10.5px] text-fg-4 line-through">
                  {live[group][k]}%
                </span>
              )}
              <input
                type="range" min={0} max={30} step={0.5} value={v}
                onChange={e => edit(group, k, Number(e.target.value))}
                className="w-32 accent-[var(--accent)]"
                aria-label={`${k} ceiling`}
              />
              <input
                type="number" min={0} max={100} step={0.5} value={v}
                onChange={e => edit(group, k, Number(e.target.value))}
                className={`w-16 rounded-lg bg-surface px-2 py-1 text-center font-mono
                            tabular-nums ring-1 outline-none focus:ring-accent/45
                            ${changed ? 'ring-accent/50 text-accent font-semibold'
                                      : 'ring-black/[.08] text-fg'}`}
              />
              <span className="font-mono text-[11px] text-fg-3 w-3">%</span>
            </label>
          )
        })}
      </div>
    </div>
  )

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}
        {notice && (
          <div className="rounded-xl bg-band-autoWash ring-1 ring-band-auto/25 px-4 py-2.5
                          text-[13px] text-band-auto">{notice}</div>
        )}

        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">
              Discount Tiers &amp; Approval Chain
            </h1>
            <p className="text-[12.5px] text-fg-3 mt-0.5">
              Policy version {live.version}. Changes are previewed against the live pipeline
              before they are saved.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {dirty && (
              <button
                onClick={() => { setDraft(live); setSim(null) }}
                className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2
                           font-display text-[12.5px] font-semibold text-fg-2"
              >
                Discard
              </button>
            )}
            <button
              onClick={apply}
              disabled={!dirty || busy}
              className="rounded-full bg-fg text-white px-5 py-2 font-display text-[12.5px]
                         font-semibold hover:shadow-lift-lg active:scale-[.98] disabled:opacity-35"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              Save configuration
            </button>
          </div>
        </header>

        {live.warnings.length > 0 && (
          <div className="rounded-xl bg-band-managerWash ring-1 ring-band-manager/25 px-4 py-3
                          flex flex-col gap-1">
            {live.warnings.map(w => (
              <p key={w} className="text-[12.5px] text-band-manager">{w}</p>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <Ceiling group="tier_ceiling" label="Tier discount ceilings" entries={draft.tier_ceiling} />
          <Ceiling group="category_ceiling" label="Category discount ceilings" entries={draft.category_ceiling} />
        </div>

        {/* Routing rules (wireframe: Discount range → Max Discount) */}
        <section className="panel p-5">
          <h2 className="font-display text-[14px] font-semibold text-fg mb-3">Approval chain</h2>
          <div className="scroll-x">
            <table className="grid-table min-w-[420px]">
              <thead>
                <tr>
                  <th>Blended risk score</th>
                  <th>Routes to</th>
                </tr>
              </thead>
              <tbody>
                {draft.bands.map(([lo, hi, route]) => (
                  <tr key={route} className="border-b border-line last:border-0">
                    <td className="font-mono tabular-nums text-fg-2">
                      {hi > 1e6 ? `${lo} and above` : `${lo} – ${hi}`}
                    </td>
                    <td>
                      <Band band={route} />
                      <span className="ml-2.5 text-[12.5px] text-fg-2">
                        {route === 'AUTO' ? 'No approval needed'
                          : route === 'MANAGER' ? 'Sales Manager'
                          : 'Sales Manager, then Finance'}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="font-mono text-fg-2">
                    Any single line ≥ {draft.hard_override_pts} pts over
                  </td>
                  <td>
                    <Band band="FINANCE" />
                    <span className="ml-2.5 text-[12.5px] text-fg-2">
                      Hard override, regardless of score
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Blast radius — the whole point of this screen */}
        {sim && (
          <section className={`rounded-2xl p-5 ring-1 ${
            sim.quotes_changed > 0
              ? 'bg-accent-wash ring-accent/25'
              : 'bg-surface ring-black/[.055]'}`}>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-eyebrow text-accent mb-1.5">
                  Impact of this change · not yet saved
                </div>
                <p className="font-display text-[17px] font-semibold text-fg">{sim.headline}</p>
              </div>
              <span className="ml-auto font-mono text-[11px] text-fg-3">
                {sim.quotes_evaluated} quotes re-scored in {sim.elapsed_ms.toFixed(1)} ms
              </span>
            </div>

            <div className="flex flex-wrap gap-5 mt-4">
              {(['AUTO', 'MANAGER', 'FINANCE'] as const).map(b => {
                const before = sim.band_counts_before[b] ?? 0
                const after = sim.band_counts_after[b] ?? 0
                return (
                  <div key={b} className="flex items-center gap-2.5">
                    <Band band={b} />
                    <span className="font-mono text-[13px] tabular-nums">
                      <span className="text-fg-3">{before}</span>
                      <span className="text-fg-4 mx-1.5">→</span>
                      <span className={after !== before ? 'text-fg font-semibold' : 'text-fg-3'}>
                        {after}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>

            {sim.impacts.filter(i => i.changed).length > 0 && (
              <div className="mt-4 pt-4 border-t border-accent/20 flex flex-col gap-1.5">
                {sim.impacts.filter(i => i.changed).map(i => (
                  <div key={i.ref} className="flex items-center gap-3 text-[12.5px]">
                    <span className="font-mono text-fg-3 w-16">{i.ref}</span>
                    <span className="text-fg flex-1">{i.customer}</span>
                    <span className="font-mono tabular-nums text-fg-3">
                      {i.score_before.toFixed(1)} → {i.score_after.toFixed(1)}
                    </span>
                    <Band band={i.band_before} />
                    <span className="text-fg-4">→</span>
                    <Band band={i.band_after} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </Workspace>
  )
}
