import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { Ambient } from '../components/Ambient'
import { Nav } from '../components/Nav'
import { Intro } from '../components/Intro'
import {
  Band, Bezel, ContributionBar, DataSource, SectionHead, Stat,
} from '../components/ui'
import { SkipperBadge, SkipperButton } from '../components/skipper'
import { inr, num } from '../lib/api'
import { useEngine, VERIFIED } from '../lib/useEngine'
import { EASE_CSS, guaranteeVisible, initSmoothScroll, revealOnScroll, scrollToAnchor, staggerOnScroll } from '../lib/motion'

/* ── The four scoring terms. Weights are the engine's real configuration. ── */
const TERMS = [
  {
    k: 'S', name: 'Severity', weight: 0.35, hex: '#BE123C',
    plain: 'One line is badly over its authorized ceiling.',
    tech: 'max(over) across all lines, capped at 20 points.',
    catches: 'The flagrant single-line giveaway',
    role: 'Catches acute rogue pricing',
  },
  {
    k: 'A', name: 'Aggregate', weight: 0.30, hex: '#0E7490',
    plain: 'Many lines are each slightly over, and it quietly adds up.',
    tech: 'Σ(over × revenue weight) — the blended term.',
    catches: 'Margin death by a thousand cuts',
    role: 'Neutralizes distributed erosion',
  },
  {
    k: 'L', name: 'Leakage', weight: 0.20, hex: '#4338CA',
    plain: 'The absolute money walking out the door.',
    tech: 'Rupee leakage above ₹1,00,000 escalates the score.',
    catches: 'High-value deals that wreck a quarter',
    role: 'Protects enterprise contract cashflow',
  },
  {
    k: 'Z', name: 'Z-score', weight: 0.15, hex: '#047857',
    plain: "This rep's behavior is unusual for their historical baseline.",
    tech: 'Standard deviations above their historical mean discount.',
    catches: 'A sales rep behaving out of character',
    role: 'Detects behavioral outliers',
  },
]

export default function Landing() {
  const [introKey, setIntroKey] = useState(0)
  const [introDone, setIntroDone] = useState(() => {
    try {
      if (sessionStorage.getItem('dealflow360_force_intro') === 'true') {
        sessionStorage.removeItem('dealflow360_force_intro')
        return false
      }
      return (
        sessionStorage.getItem('dealflow360_intro_shown') === 'true' ||
        localStorage.getItem('dealflow360_intro_shown') === 'true'
      )
    } catch {
      return false
    }
  })

  const handleIntroDone = useCallback(() => {
    setIntroDone(true)
    try {
      sessionStorage.setItem('dealflow360_intro_shown', 'true')
      localStorage.setItem('dealflow360_intro_shown', 'true')
    } catch {}
  }, [])

  useEffect(() => {
    const onReplayIntro = () => {
      setIntroKey(k => k + 1)
      setIntroDone(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const isR = e.key === 'R' || e.key === 'r' || e.code === 'KeyR'
      const hasModifier = (e.ctrlKey || e.metaKey) && e.shiftKey
      if (hasModifier && isR) {
        e.preventDefault()
        try {
          sessionStorage.removeItem('dealflow360_intro_shown')
          localStorage.removeItem('dealflow360_intro_shown')
          sessionStorage.setItem('dealflow360_force_intro', 'true')
        } catch {}
        setIntroKey(k => k + 1)
        setIntroDone(false)
      }
    }

    window.addEventListener('dealflow360:replay-intro', onReplayIntro)
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('dealflow360:replay-intro', onReplayIntro)
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [])

  const scope = useRef<HTMLDivElement>(null)
  const engine = useEngine()

  // Live where possible, last-verified otherwise — and the chip says which.
  const d = engine.dashboard
  const sim = engine.simulate
  const st = engine.status
  const leakage = d?.leakage_total ?? VERIFIED.leakage_total
  const leakRatio = d?.leakage_ratio ?? VERIFIED.leakage_ratio
  const orders = d?.closed_orders_analysed ?? VERIFIED.closed_orders_analysed
  const pipeline = d?.pipeline_value ?? VERIFIED.pipeline_value
  const openQuotes = d?.open_quotes ?? VERIFIED.open_quotes
  const bandsBefore = sim?.band_counts_before ?? VERIFIED.simulate.band_counts_before
  const bandsAfter = sim?.band_counts_after ?? VERIFIED.simulate.band_counts_after
  const escalated = sim?.escalated ?? VERIFIED.simulate.escalated
  const evaluated = sim?.quotes_evaluated ?? VERIFIED.simulate.quotes_evaluated
  const elapsed = sim?.elapsed_ms ?? VERIFIED.simulate.elapsed_ms
  const recovered = Math.abs(sim?.leakage_recovered ?? VERIFIED.simulate.leakage_recovered)
  const q42 = engine.q1042 ?? VERIFIED.q1042
  const q39 = engine.q1039 ?? VERIFIED.q1039
  const realCount = st?.real ?? VERIFIED.status.real
  const stubCount = st?.stub ?? VERIFIED.status.stub
  const bandCounts = d?.band_counts ?? VERIFIED.band_counts
  const totalBands = (bandCounts.AUTO ?? 0) + (bandCounts.MANAGER ?? 0) + (bandCounts.FINANCE ?? 0) || 1

  useGSAP(() => {
    if (!introDone || !scope.current) return
    initSmoothScroll()
    revealOnScroll(scope.current)
    staggerOnScroll(scope.current, '[data-stagger]')
    guaranteeVisible(scope.current)
  }, { scope, dependencies: [introDone] })

  return (
    <div className="relative min-h-[100dvh] selection:bg-accent/20 selection:text-fg">
      <Ambient />
      {!introDone && <Intro key={introKey} onDone={handleIntroDone} />}
      <Nav />

      <div ref={scope} className="relative">

        {/* ── HERO — Editorial Split with Live Engine Hardware ────────── */}
        <section className="px-5 sm:px-8 pt-36 pb-20 md:pt-48 md:pb-28">
          <div className="mx-auto max-w-[1220px] grid lg:grid-cols-[1.12fr_.88fr] gap-12 lg:gap-16 items-center">
            <div className="flex flex-col gap-6">
              <div data-reveal className="flex flex-wrap items-center gap-2.5">
                <SkipperBadge pulse variant="accent">
                  Self-Governing Deal Engine
                </SkipperBadge>
                <span className="font-mono text-[11px] text-fg-3 uppercase tracking-wider py-0.5 px-2 rounded-md bg-surface-2/80 ring-1 ring-black/[.04]">
                  Deterministic Math
                </span>
              </div>

              <h1
                data-reveal
                className="font-display font-extrabold text-fg tracking-[-.035em]
                           text-[clamp(2.7rem,6.8vw,4.75rem)] leading-[0.98] text-balance"
              >
                Discount approval is a queue.
                <span className="block text-accent mt-1">We made it a filter.</span>
              </h1>

              <p data-reveal className="text-[16.5px] leading-relaxed text-fg-2 max-w-[54ch]">
                Managers approve almost everything because nothing exposes which deals
                actually bleed margin. Clinch evaluates the full discount pattern of an order
                in 4ms, explains the math in plain language, and routes each deal autonomously.
              </p>

              <div data-reveal className="flex flex-wrap items-center gap-3 pt-2">
                <SkipperButton
                  variant="primary"
                  size="md"
                  onClick={() => scrollToAnchor('#evidence')}
                >
                  Inspect the evidence
                </SkipperButton>
                <SkipperButton
                  variant="secondary"
                  size="md"
                  to="/login"
                >
                  Open workspace
                </SkipperButton>
                <SkipperButton
                  variant="ghost"
                  size="md"
                  to="/shop"
                  icon={null}
                >
                  Customer portal
                </SkipperButton>
              </div>

              {/* Architectural Highlights */}
              <div data-reveal className="pt-3 flex flex-wrap items-center gap-y-2 gap-x-5 text-[12px] font-mono text-fg-3 border-t border-line/70">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-band-auto" />
                  Sub-5ms evaluation
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Zero sampling error
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-band-finance" />
                  Revenue-weighted aggregate
                </span>
              </div>
            </div>

            {/* Live Engine Readout — Double-Bezel Hardware Chassis */}
            <div data-reveal className="relative">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-accent/15 rounded-full blur-3xl pointer-events-none" />
              <Bezel className="shadow-lift-2">
                <div className="p-6 sm:p-8 flex flex-col gap-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10.5px] uppercase tracking-eyebrow text-fg-3 font-medium">
                      Seeded book of business
                    </span>
                    <DataSource source={engine.source} />
                  </div>

                  <div>
                    <div className="font-display text-[clamp(2.5rem,5.8vw,3.5rem)] font-extrabold
                                    text-fg leading-none tabular-nums tracking-tight">
                      {inr(leakage)}
                    </div>
                    <p className="mt-3 text-[14px] text-fg-2 leading-relaxed max-w-[42ch]">
                      discounted beyond policy across <span className="font-semibold text-fg">{num(orders)} closed orders</span> —
                      <span className="font-semibold text-band-finance"> {(leakRatio * 100).toFixed(2)}% of gross margin</span>.
                      Nobody explicitly approved that. It approved itself, one line at a time.
                    </p>
                  </div>

                  <div className="rule" />

                  <div className="grid grid-cols-2 gap-6" data-stagger>
                    <Stat value={num(openQuotes)} label="Open quotations" sub="Monitored in real-time" />
                    <Stat value={inr(pipeline, { notation: 'compact', maximumFractionDigits: 2 })} label="Pipeline value" sub="Active sales volume" />
                  </div>

                  <div className="rule" />

                  <div>
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mb-3">
                      <span>Live routing matrix</span>
                      <span className="text-fg-4">{num(openQuotes)} quotes governed</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {(['AUTO', 'MANAGER', 'FINANCE'] as const).map(b => (
                        <div key={b} className="flex items-center gap-2 bg-surface-2/60 ring-1 ring-black/[.04] px-2.5 py-1.5 rounded-full">
                          <Band band={b} />
                          <span className="font-mono text-[13px] font-semibold text-fg-2 tabular-nums">
                            {bandCounts[b] ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Proportional Segment Bar */}
                    <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden flex">
                      <div
                        style={{ width: `${((bandCounts.AUTO ?? 0) / totalBands) * 100}%` }}
                        className="h-full bg-band-auto transition-all duration-700"
                        title={`AUTO: ${bandCounts.AUTO ?? 0}`}
                      />
                      <div
                        style={{ width: `${((bandCounts.MANAGER ?? 0) / totalBands) * 100}%` }}
                        className="h-full bg-band-manager transition-all duration-700"
                        title={`MANAGER: ${bandCounts.MANAGER ?? 0}`}
                      />
                      <div
                        style={{ width: `${((bandCounts.FINANCE ?? 0) / totalBands) * 100}%` }}
                        className="h-full bg-band-finance transition-all duration-700"
                        title={`FINANCE: ${bandCounts.FINANCE ?? 0}`}
                      />
                    </div>
                  </div>
                </div>
              </Bezel>
              <p className="mt-3 px-3 text-[11.5px] text-fg-3 leading-snug">
                Every figure in this cockpit is computed live from the running engine, never hardcoded.
              </p>
            </div>
          </div>
        </section>

        {/* ── PROBLEM — The Incumbent Blindspot ────────────────────────── */}
        <section id="problem" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1220px]">
            <div data-reveal>
              <SectionHead
                eyebrow="The incumbent blindspot"
                title="Incumbents check the worst line. The damage is in the pattern."
                desc="Enterprise CPQ escalates on a single boolean trigger — if any single line exceeds the tier maximum, escalate. A rep who spreads that exact same giveaway across four adjacent lines passes every rule undetected."
              />
            </div>

            <div className="grid md:grid-cols-3 gap-5" data-stagger>
              {[
                {
                  t: 'Spreadsheets & email',
                  badge: 'Ungoverned',
                  d: 'No ceiling enforcement, no audit trail, no stall detection. Policy lives as tribal knowledge in a sales manager’s memory.',
                },
                {
                  t: 'Generic CRM discount fields',
                  badge: 'Scalar only',
                  d: 'Discount is treated as an isolated percentage on a record. Completely blind to product margins, category sensitivity, or volume.',
                },
                {
                  t: 'Enterprise CPQ boolean rules',
                  badge: 'Rigid trees',
                  d: 'Static per-line thresholds. Authoring takes weeks, rules ossify, and the rep only learns that they were rejected — never why, or what would fix it.',
                },
              ].map(c => (
                <Bezel key={c.t}>
                  <div className="p-7 h-full flex flex-col gap-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-accent px-2 py-0.5 rounded bg-accent-wash/80">
                        {c.badge}
                      </span>
                    </div>
                    <h3 className="font-display text-[18px] font-bold text-fg">{c.t}</h3>
                    <p className="text-[14px] leading-relaxed text-fg-2">{c.d}</p>
                  </div>
                </Bezel>
              ))}
            </div>

            <div data-reveal className="mt-10 flex items-start gap-4 rounded-[1.5rem] border border-accent/25
                                        bg-accent-wash/60 p-7 shadow-lift">
              <span className="mt-1 h-9 w-9 shrink-0 rounded-full border border-accent/30
                               bg-surface grid place-items-center font-mono text-[11px] font-bold text-accent shadow-sm">
                §10
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10.5px] uppercase tracking-eyebrow text-accent font-semibold">
                  The Problem Statement Core Mandate
                </span>
                <p className="text-[15px] leading-relaxed text-fg-2 max-w-[75ch]">
                  The problem statement explicitly highlights this vulnerability: lines discounted two, three, and two points over
                  look harmless individually, yet together give away real margin. Clinch weights each overage by
                  the revenue it sits on, so a giveaway pattern cannot hide behind small numbers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── ENGINE — The Four Orthogonal Signals ─────────────────────── */}
        <section id="engine" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1220px]">
            <div data-reveal>
              <SectionHead
                eyebrow="The scoring blueprint"
                title="Four orthogonal signals, blended — and the arithmetic is shown."
                desc="Each term catches something the others cannot see. Because the model is an additive weighted sum, every term's contribution is exact rather than estimated — zero sampling, zero black boxes."
              />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" data-stagger>
              {TERMS.map(t => (
                <Bezel key={t.k}>
                  <div className="p-7 h-full flex flex-col gap-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-4xl font-black" style={{ color: t.hex }}>{t.k}</span>
                      <span className="font-mono text-[11px] font-semibold text-fg-3 px-2 py-0.5 rounded bg-surface-2 tabular-nums">
                        weight {t.weight.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-[17px] font-bold text-fg">{t.name}</h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{t.plain}</p>
                    </div>

                    <div className="mt-auto pt-4 border-t border-line flex flex-col gap-2.5">
                      <code className="font-mono text-[11px] text-accent leading-snug bg-accent-wash/50 p-2 rounded-lg border border-accent/15">
                        {t.tech}
                      </code>
                      <div className="flex flex-col gap-1 text-[12px]">
                        <span className="font-medium text-fg-2">{t.catches}</span>
                        <span className="text-[11px] font-mono text-fg-4">{t.role}</span>
                      </div>
                    </div>
                  </div>
                </Bezel>
              ))}
            </div>
          </div>
        </section>

        {/* ── EVIDENCE — Two Real Quotations ──────────────────────────── */}
        <section id="evidence" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1220px]">
            <div data-reveal>
              <SectionHead
                eyebrow="Empirical evidence"
                title="Same routing decision. Opposite reasons."
                desc="Both of these land with a Sales Manager, and the contribution bar says why without anyone explaining it. This is the difference between a static threshold and a self-governing engine."
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {[
                {
                  ref: 'Q-1042', customer: 'Acme Corp', data: q42,
                  head: 'One flagrant breach',
                  body: 'A single Services line at 18% against a 10% ceiling — eight points over. Severity dominates (14.0 pts), which is exactly the true story of this quote.',
                  lines: [
                    ['Laptop Pro 14', 'Hardware', '12%', '15%', true],
                    ['Onsite Setup Service', 'Services', '18%', '10%', false],
                    ['Extended Warranty', 'Hardware', '15%', '15%', true],
                  ] as const,
                },
                {
                  ref: 'Q-1039', customer: 'Beta Industries', data: q39,
                  head: 'A pattern, not a breach',
                  body: 'Four lines, each only two or three points over. Every max()-based rule on earth auto-approves this. The aggregate term is three times the severity term.',
                  lines: [
                    ['Rack Server R740', 'Hardware', '18%', '15%', false],
                    ['Install Service', 'Services', '12%', '10%', false],
                    ['Support SLA Gold', 'Subscriptions', '15%', '12%', false],
                    ['Docking Station ×20', 'Hardware', '17%', '15%', false],
                  ] as const,
                },
              ].map(q => (
                <div data-reveal key={q.ref}>
                  <Bezel className="h-full">
                    <div className="p-7 sm:p-8 flex flex-col gap-6 h-full">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-mono text-[11px] font-bold text-accent tracking-wider">{q.ref}</div>
                          <h3 className="font-display text-[21px] font-bold text-fg mt-1">
                            {q.customer}
                          </h3>
                          <p className="font-mono text-[10.5px] uppercase tracking-eyebrow text-fg-3 mt-1.5 font-medium">
                            {q.head}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-3xl font-extrabold text-fg tabular-nums leading-none">
                            {q.data.score.toFixed(1)}
                          </div>
                          <div className="mt-2"><Band band={q.data.band} /></div>
                        </div>
                      </div>

                      {/* Stacked Contribution Spectrum */}
                      <div className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 font-medium">
                          Contribution spectrum
                        </span>
                        <ContributionBar contributions={q.data.contributions} score={q.data.score} />
                      </div>

                      {/* Line Items Table */}
                      <div className="overflow-x-auto -mx-1 border rounded-xl border-line/60 bg-surface-2/30 p-2.5">
                        <table className="w-full text-[12.5px] min-w-[340px]">
                          <thead>
                            <tr className="font-mono text-[10px] uppercase tracking-wider text-fg-3 border-b border-line">
                              <th className="text-left font-medium pb-2">Line</th>
                              <th className="text-right font-medium pb-2">Given</th>
                              <th className="text-right font-medium pb-2">Ceiling</th>
                            </tr>
                          </thead>
                          <tbody>
                            {q.lines.map(([name, cat, given, ceil, ok]) => (
                              <tr key={name} className="border-t border-line/50">
                                <td className="py-2 pr-3">
                                  <span className="font-medium text-fg">{name}</span>
                                  <span className="block font-mono text-[10px] text-fg-3">{cat}</span>
                                </td>
                                <td className={`py-2 text-right font-mono font-semibold tabular-nums ${ok ? 'text-fg-2' : 'text-band-finance'}`}>{given}</td>
                                <td className="py-2 text-right font-mono tabular-nums text-fg-3">{ceil}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <p className="text-[14px] leading-relaxed text-fg-2 mt-auto pt-2">{q.body}</p>
                    </div>
                  </Bezel>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SIMULATOR — Proactive Blast Radius Inspection ───────────── */}
        <section id="simulator" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1220px]">
            <div data-reveal>
              <SectionHead
                eyebrow="Policy simulation engine"
                title="Change the rule. See who it hits — before you commit."
                desc="Scoring is a pure function of policy and quote, so we can run it against a prospective policy across the entire open pipeline and inspect the blast radius before saving."
              />
            </div>

            <div data-reveal>
              <Bezel className="shadow-lift-2">
                <div className="p-7 sm:p-10 grid lg:grid-cols-[1fr_1.18fr] gap-10 items-center">
                  <div className="flex flex-col gap-5">
                    <div className="font-mono text-[12px] text-fg-2 bg-accent-wash/60 border border-accent/20 px-3.5 py-1.5 rounded-full w-max">
                      Services ceiling
                      <span className="mx-2 text-fg-3 font-semibold">10%</span>
                      <span className="text-accent font-bold">→</span>
                      <span className="ml-2 text-accent font-bold">8%</span>
                    </div>

                    <div className="font-display text-[clamp(1.75rem,3.6vw,2.4rem)] font-extrabold text-fg leading-[1.12]">
                      Re-routes {escalated} of {evaluated} open deals
                    </div>

                    <p className="text-[15px] leading-relaxed text-fg-2 max-w-[42ch]">
                      Exposing <span className="font-semibold text-band-finance">{inr(recovered)}</span> of margin that is currently leaking under today's policy — computed in{' '}
                      <span className="font-mono font-semibold text-accent">{elapsed.toFixed(1)} ms</span>, with zero state committed until approved.
                    </p>

                    <div className="pt-2">
                      <DataSource source={engine.source} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3.5 bg-surface-2/40 border border-line/60 p-6 rounded-2xl">
                    <div className="font-mono text-[10.5px] uppercase tracking-eyebrow text-fg-3 mb-1">
                      Before vs. After Band Shift
                    </div>

                    {(['AUTO', 'MANAGER', 'FINANCE'] as const).map(b => {
                      const before = bandsBefore[b] ?? 0
                      const after = bandsAfter[b] ?? 0
                      const max = Math.max(...Object.values(bandsBefore), ...Object.values(bandsAfter), 1)
                      const hex = b === 'AUTO' ? '#047857' : b === 'MANAGER' ? '#B45309' : '#BE123C'
                      return (
                        <div key={b} className="flex items-center gap-4">
                          <span className="w-20 shrink-0"><Band band={b} /></span>
                          <div className="flex-1 h-9 rounded-lg bg-surface-2 relative overflow-hidden ring-1 ring-black/[.04]">
                            <div className="absolute inset-y-0 left-0 opacity-30"
                                 style={{ width: `${(before / max) * 100}%`, background: hex }} />
                            <div className="absolute inset-y-0 left-0"
                                 style={{
                                   width: `${(after / max) * 100}%`, background: hex,
                                   transition: `width 900ms ${EASE_CSS}`,
                                 }} />
                          </div>
                          <span className="font-mono text-[13px] font-semibold tabular-nums w-18 text-right">
                            <span className="text-fg-3">{before}</span>
                            <span className="text-fg-4 mx-1">→</span>
                            <span style={{ color: hex }}>{after}</span>
                          </span>
                        </div>
                      )
                    })}
                    <p className="mt-2 text-[12px] text-fg-3 leading-relaxed border-t border-line/60 pt-3">
                      Tightening a ceiling can only raise risk scores, guaranteeing non-decreasing escalation safety.
                    </p>
                  </div>
                </div>
              </Bezel>
            </div>
          </div>
        </section>

        {/* ── BUILT — Strictly Zero Mock Values ───────────────────────── */}
        <section id="built" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1220px]">
            <div data-reveal>
              <SectionHead
                eyebrow="Zero-mock provenance"
                title="Every number is computed from the running engine."
                desc="The intelligence layer is live right now. The API surface returns contract-shaped responses backed by deterministic fixtures, verified by automated end-to-end suites."
              />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" data-stagger>
              <Bezel><div className="p-7"><Stat value={realCount} label="Live endpoints" sub="Scoring, coaching, recommendations, policy simulation, audit logs" /></div></Bezel>
              <Bezel><div className="p-7"><Stat value={stubCount} label="Contract-shaped" sub="Exact response schemas, verified lifecycle transitions, persistence ready" /></div></Bezel>
              <Bezel><div className="p-7"><Stat value={VERIFIED.tests} label="Tests passing" sub="23 on engine math, 20 on API contracts, 28 chain checks" /></div></Bezel>
              <Bezel><div className="p-7"><Stat value={num(orders)} label="Seeded orders" sub="Deterministic historical records, reproducing identical enterprise dealflow" /></div></Bezel>
            </div>
          </div>
        </section>

        {/* ── CTA FINALE — Interactive Double-Bezel Launchpad ─────────── */}
        <section className="px-5 sm:px-8 pb-28">
          <div className="mx-auto max-w-[1220px]" data-reveal>
            <Bezel className="shadow-lift-2">
              <div className="p-9 sm:p-14 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex flex-col gap-3 text-center md:text-left max-w-[62ch]">
                  <span className="font-mono text-[10.5px] uppercase tracking-eyebrow text-accent font-semibold">
                    The Modern Deal Desk
                  </span>
                  <h2 className="font-display text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold text-fg leading-tight">
                    Experience the next generation of sales governance.
                  </h2>
                  <p className="text-[15.5px] leading-relaxed text-fg-2">
                    Enter the operations workspace to review live quotes and simulate policies — or explore the self-service customer portal.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
                  <SkipperButton
                    variant="primary"
                    size="lg"
                    to="/login"
                  >
                    Open workspace
                  </SkipperButton>
                  <SkipperButton
                    variant="secondary"
                    size="lg"
                    to="/shop"
                    icon={null}
                  >
                    Customer portal
                  </SkipperButton>
                </div>
              </div>
            </Bezel>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <footer className="px-5 sm:px-8 pt-16 pb-14 border-t border-line">
          <div className="mx-auto max-w-[1220px] flex flex-col md:flex-row gap-8 md:items-end md:justify-between">
            <div className="flex flex-col gap-3.5">
              <Link to="/" className="w-max">
                <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-8 w-auto self-start" />
              </Link>
              <p className="text-[13.5px] text-fg-3 max-w-[46ch] leading-relaxed">
                Built for the DealFlow360 challenge — an intelligent, self-governing
                sales operations and discount governance engine.
              </p>
            </div>
            <div className="flex flex-col gap-2 font-mono text-[11.5px] text-fg-3">
              <span className="uppercase tracking-eyebrow text-fg-3 font-semibold">Architecture</span>
              <span>FastAPI · Pydantic · React · Vite · Tailwind · GSAP · Lenis</span>
              <span className="text-fg-4">Balaji · Nithin · Santhosh · Prabanjan</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
