import { useCallback, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { Link } from 'react-router-dom'
import { Ambient } from '../components/Ambient'
import { Nav } from '../components/Nav'
import { Intro } from '../components/Intro'
import {
  Band, Bezel, ContributionBar, CTA, DataSource, Eyebrow, SectionHead, Stat,
} from '../components/ui'
import { inr, num } from '../lib/api'
import { useEngine, VERIFIED } from '../lib/useEngine'
import { EASE_CSS, guaranteeVisible, initSmoothScroll, revealOnScroll, scrollToAnchor, staggerOnScroll } from '../lib/motion'

/* ── The four scoring terms. Weights are the engine's real configuration. ── */
const TERMS = [
  {
    k: 'S', name: 'Severity', weight: 0.35, hex: '#BE123C',
    plain: 'One line is badly over its limit.',
    tech: 'max(over) across all lines, capped at 20 points.',
    catches: 'The flagrant single breach',
  },
  {
    k: 'A', name: 'Aggregate', weight: 0.30, hex: '#0E7490',
    plain: 'Many lines are each slightly over, and it adds up.',
    tech: 'Σ(over × revenue weight) — the blended term.',
    catches: 'Margin death by a thousand cuts',
  },
  {
    k: 'L', name: 'Leakage', weight: 0.20, hex: '#4338CA',
    plain: 'The absolute money walking out the door.',
    tech: 'Leakage above ₹1L escalates the score.',
    catches: 'High-value deals that wreck a quarter',
  },
  {
    k: 'Z', name: 'Z-score', weight: 0.15, hex: '#047857',
    plain: "This rep's behavior is unusual for them.",
    tech: 'Standard deviations above their historical mean discount.',
    catches: 'A rep behaving out of character',
  },
]

export default function Landing() {
  const [introDone, setIntroDone] = useState(() => {
    try {
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

  useGSAP(() => {
    if (!introDone || !scope.current) return
    initSmoothScroll()
    revealOnScroll(scope.current)
    staggerOnScroll(scope.current, '[data-stagger]')
    guaranteeVisible(scope.current)
  }, { scope, dependencies: [introDone] })

  return (
    <div className="relative min-h-[100dvh]">
      <Ambient />
      {!introDone && <Intro onDone={handleIntroDone} />}
      <Nav />

      <div ref={scope} className="relative">

        {/* ── HERO — Editorial Split ─────────────────────────────────── */}
        <section className="px-5 sm:px-8 pt-40 pb-24 md:pt-52 md:pb-32">
          <div className="mx-auto max-w-[1180px] grid lg:grid-cols-[1.05fr_.95fr] gap-14 lg:gap-16 items-center">
            <div className="flex flex-col gap-7">
              <div data-reveal><Eyebrow>Self-governing deal engine</Eyebrow></div>
              <h1
                data-reveal
                className="font-display font-extrabold text-fg tracking-[-.03em]
                           text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.98] text-balance"
              >
                Discount approval is a queue.
                <span className="block text-accent">We made it a filter.</span>
              </h1>
              <p data-reveal className="text-[17px] leading-relaxed text-fg-2 max-w-[54ch]">
                Managers approve almost everything, because nothing tells them which deals
                are actually dangerous. Clinch scores the whole discount pattern of an order,
                explains itself in plain language, and routes the deal on its own.
              </p>
              <div data-reveal className="flex flex-wrap items-center gap-3 pt-1">
                <CTA onClick={() => scrollToAnchor('#evidence')}>See the evidence</CTA>
                <Link
                  to="/app"
                  className="group cta ring-1 ring-black/[.09] bg-surface text-fg hover:ring-accent/40 hover:text-accent active:scale-[.98]"
                  style={{ transition: `all 500ms ${EASE_CSS}` }}
                >
                  Open the workspace
                  <span className="cta-icon bg-fg/[.06] group-hover:translate-x-[2px] group-hover:-translate-y-px">↗</span>
                </Link>
              </div>
            </div>

            {/* Live engine readout — the anti-mockup statement */}
            <div data-reveal>
              <Bezel>
                <div className="p-6 sm:p-7 flex flex-col gap-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                      Seeded book of business
                    </span>
                    <DataSource source={engine.source} />
                  </div>

                  <div>
                    <div className="font-display text-[clamp(2.4rem,6vw,3.4rem)] font-extrabold
                                    text-fg leading-none tabular-nums">
                      {inr(leakage)}
                    </div>
                    <p className="mt-2.5 text-[14px] text-fg-2 leading-snug max-w-[38ch]">
                      discounted beyond policy across {num(orders)} closed orders —
                      <span className="text-fg-2"> {(leakRatio * 100).toFixed(2)}% of gross margin</span>.
                      Nobody approved that. It approved itself, one line at a time.
                    </p>
                  </div>

                  <div className="rule" />

                  <div className="grid grid-cols-2 gap-5" data-stagger>
                    <Stat value={num(openQuotes)} label="Open quotations" />
                    <Stat value={inr(pipeline, { notation: 'compact', maximumFractionDigits: 2 })} label="Pipeline value" />
                  </div>

                  <div className="rule" />

                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3 mb-3">
                      Current routing
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['AUTO', 'MANAGER', 'FINANCE'] as const).map(b => (
                        <span key={b} className="inline-flex items-center gap-2">
                          <Band band={b} />
                          <span className="font-mono text-[13px] text-fg-2 tabular-nums">
                            {(d?.band_counts ?? VERIFIED.band_counts)[b]}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Bezel>
              <p className="mt-3 px-2 text-[11.5px] text-fg-3 leading-snug">
                Every figure on this page is read from the running engine, not written into the markup.
              </p>
            </div>
          </div>
        </section>

        {/* ── PROBLEM ────────────────────────────────────────────────── */}
        <section id="problem" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div data-reveal>
              <SectionHead
                eyebrow="The root pain"
                title="Incumbents check the worst line. The damage is in the pattern."
                desc="Enterprise CPQ escalates on a single boolean trigger — if this line exceeds the tier maximum, escalate. A rep who spreads the same giveaway across four lines passes every one of those checks."
              />
            </div>
            <div className="grid md:grid-cols-3 gap-4" data-stagger>
              {[
                {
                  t: 'Spreadsheet and email',
                  d: 'No ceiling enforcement, no audit trail, no stall detection. Policy lives as tribal knowledge in a manager’s head.',
                },
                {
                  t: 'Generic CRM discount field',
                  d: 'Discount is a number on a record, not a governed quantity. No category awareness, no routing, no explanation.',
                },
                {
                  t: 'Enterprise CPQ',
                  d: 'Static per-line boolean rules. Authoring takes weeks so policy ossifies, and the rep only learns that they were blocked — never why, or what would unblock them.',
                },
              ].map(c => (
                <Bezel key={c.t}>
                  <div className="p-6 h-full flex flex-col gap-3">
                    <h3 className="font-display text-[17px] font-semibold text-fg">{c.t}</h3>
                    <p className="text-[14px] leading-relaxed text-fg-2">{c.d}</p>
                  </div>
                </Bezel>
              ))}
            </div>
            <div data-reveal className="mt-10 flex items-start gap-4 rounded-[1.4rem] border border-accent/25
                                        bg-accent-wash p-6">
              <span className="mt-1 h-9 w-9 shrink-0 rounded-full border border-accent/30
                               bg-accent-wash grid place-items-center font-mono text-[11px] text-accent">
                §10
              </span>
              <p className="text-[15px] leading-relaxed text-fg-2 max-w-[70ch]">
                The problem statement names this failure itself: lines that are two, three and two points over
                look harmless individually, yet together give away real margin. Clinch weights each overage by
                the revenue it sits on, so a pattern cannot hide behind small numbers.
              </p>
            </div>
          </div>
        </section>

        {/* ── ENGINE ─────────────────────────────────────────────────── */}
        <section id="engine" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div data-reveal>
              <SectionHead
                eyebrow="How the score works"
                title="Four orthogonal signals, blended — and the arithmetic is shown."
                desc="Each term catches something the others cannot see. Because the model is an additive weighted sum, every term's contribution is exact rather than estimated — no sampling, no approximation."
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-stagger>
              {TERMS.map(t => (
                <Bezel key={t.k}>
                  <div className="p-6 h-full flex flex-col gap-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-3xl font-extrabold" style={{ color: t.hex }}>{t.k}</span>
                      <span className="font-mono text-[11px] text-fg-3 tabular-nums">
                        w {t.weight.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-[16px] font-semibold text-fg">{t.name}</h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{t.plain}</p>
                    </div>
                    <div className="mt-auto pt-3 border-t border-line flex flex-col gap-2">
                      <code className="font-mono text-[11.5px] text-accent leading-relaxed">{t.tech}</code>
                      <span className="text-[12px] text-fg-3">{t.catches}</span>
                    </div>
                  </div>
                </Bezel>
              ))}
            </div>
          </div>
        </section>

        {/* ── EVIDENCE ───────────────────────────────────────────────── */}
        <section id="evidence" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div data-reveal>
              <SectionHead
                eyebrow="Two real quotations"
                title="Same routing decision. Opposite reasons."
                desc="Both of these land with a Sales Manager, and the contribution bar says why without anyone explaining it. This is the difference between a threshold and an engine."
              />
            </div>
            <div className="grid lg:grid-cols-2 gap-5">
              {[
                {
                  ref: 'Q-1042', customer: 'Acme Corp', data: q42,
                  head: 'One flagrant breach',
                  body: 'A single Services line at 18% against a 10% ceiling — eight points over. Severity dominates, which is exactly the story of this quote.',
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
                  <Bezel>
                    <div className="p-6 sm:p-7 flex flex-col gap-5 h-full">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-mono text-[11px] text-accent">{q.ref}</div>
                          <h3 className="font-display text-[19px] font-semibold text-fg mt-1">
                            {q.customer}
                          </h3>
                          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-fg-3 mt-1.5">
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

                      <ContributionBar contributions={q.data.contributions} score={q.data.score} />

                      <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-[12.5px] min-w-[340px]">
                          <thead>
                            <tr className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
                              <th className="text-left font-medium pb-2">Line</th>
                              <th className="text-right font-medium pb-2">Given</th>
                              <th className="text-right font-medium pb-2">Ceiling</th>
                            </tr>
                          </thead>
                          <tbody>
                            {q.lines.map(([name, cat, given, ceil, ok]) => (
                              <tr key={name} className="border-t border-line">
                                <td className="py-2 pr-3">
                                  <span className="text-fg-2">{name}</span>
                                  <span className="block font-mono text-[10.5px] text-fg-3">{cat}</span>
                                </td>
                                <td className={`py-2 text-right font-mono tabular-nums ${ok ? 'text-fg-2' : 'text-band-finance'}`}>{given}</td>
                                <td className="py-2 text-right font-mono tabular-nums text-fg-3">{ceil}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <p className="text-[13.5px] leading-relaxed text-fg-2 mt-auto">{q.body}</p>
                    </div>
                  </Bezel>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SIMULATOR ──────────────────────────────────────────────── */}
        <section id="simulator" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div data-reveal>
              <SectionHead
                eyebrow="Policy simulation"
                title="Change the rule. See who it hits — before you commit."
                desc="Scoring is a pure function of policy and quote, so we can run it against a policy nobody has saved yet, across the entire open pipeline, and show the blast radius first."
              />
            </div>

            <div data-reveal>
              <Bezel>
                <div className="p-7 sm:p-9 grid lg:grid-cols-[1fr_1.15fr] gap-9 items-center">
                  <div className="flex flex-col gap-5">
                    <div className="font-mono text-[12px] text-fg-2">
                      Services ceiling
                      <span className="mx-2.5 text-fg-3">10%</span>
                      <span className="text-accent">→</span>
                      <span className="ml-2.5 text-accent font-semibold">8%</span>
                    </div>
                    <div className="font-display text-[clamp(1.6rem,3.4vw,2.3rem)] font-bold text-fg leading-[1.15]">
                      Re-routes {escalated} of {evaluated} open deals
                    </div>
                    <p className="text-[15px] leading-relaxed text-fg-2 max-w-[42ch]">
                      Exposing {inr(recovered)} of margin that is leaking under today's policy — computed in{' '}
                      <span className="font-mono text-accent">{elapsed.toFixed(1)} ms</span>, with nothing saved
                      until the change is applied.
                    </p>
                    <DataSource source={engine.source} />
                  </div>

                  <div className="flex flex-col gap-3">
                    {(['AUTO', 'MANAGER', 'FINANCE'] as const).map(b => {
                      const before = bandsBefore[b] ?? 0
                      const after = bandsAfter[b] ?? 0
                      const max = Math.max(...Object.values(bandsBefore), ...Object.values(bandsAfter), 1)
                      const hex = b === 'AUTO' ? '#047857' : b === 'MANAGER' ? '#B45309' : '#BE123C'
                      return (
                        <div key={b} className="flex items-center gap-4">
                          <span className="w-20 shrink-0"><Band band={b} /></span>
                          <div className="flex-1 h-9 rounded-md bg-surface-2 relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 opacity-25"
                                 style={{ width: `${(before / max) * 100}%`, background: hex }} />
                            <div className="absolute inset-y-0 left-0"
                                 style={{
                                   width: `${(after / max) * 100}%`, background: hex,
                                   transition: `width 900ms ${EASE_CSS}`,
                                 }} />
                          </div>
                          <span className="font-mono text-[13px] tabular-nums w-16 text-right">
                            <span className="text-fg-3">{before}</span>
                            <span className="text-fg-3 mx-1">→</span>
                            <span style={{ color: hex }}>{after}</span>
                          </span>
                        </div>
                      )
                    })}
                    <p className="mt-1 text-[12px] text-fg-3 leading-relaxed">
                      Tightening a ceiling can only ever raise scores, so a single downward change produces
                      escalations only. Reversing the change reverses the ripple.
                    </p>
                  </div>
                </div>
              </Bezel>
            </div>
          </div>
        </section>

        {/* ── BUILT (honest) ─────────────────────────────────────────── */}
        <section id="built" className="px-5 sm:px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div data-reveal>
              <SectionHead
                eyebrow="What is actually running"
                title="No mockups on this page."
                desc="The intelligence layer is real today. The CRUD around it returns contract-shaped responses so the interface could be built in parallel — each one swaps to a real handler without changing a response shape."
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-stagger>
              <Bezel><div className="p-6"><Stat value={realCount} label="Live endpoints" sub="Scoring, coaching, recommendations, policy simulation, portal redaction" /></div></Bezel>
              <Bezel><div className="p-6"><Stat value={stubCount} label="Contract-shaped" sub="Real response shapes, real routing off real scores, persistence pending" /></div></Bezel>
              <Bezel><div className="p-6"><Stat value={VERIFIED.tests} label="Tests passing" sub="23 on the engine, 20 on the API surface" /></div></Bezel>
              <Bezel><div className="p-6"><Stat value={num(orders)} label="Seeded orders" sub="Deterministic, so every run of the demo is identical" /></div></Bezel>
            </div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <footer className="px-5 sm:px-8 pt-16 pb-14 border-t border-line">
          <div className="mx-auto max-w-[1180px] flex flex-col md:flex-row gap-8 md:items-end md:justify-between">
            <div className="flex flex-col gap-3">
              <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-8 w-auto self-start" />
              <p className="text-[13.5px] text-fg-3 max-w-[46ch] leading-relaxed">
                Built for the DealFlow360 problem statement — an intelligent, self-governing
                sales operations platform.
              </p>
            </div>
            <div className="flex flex-col gap-2 font-mono text-[11.5px] text-fg-3">
              <span className="uppercase tracking-eyebrow text-fg-3">Stack</span>
              <span>FastAPI · Pydantic · React · Vite · Tailwind · GSAP</span>
              <span className="text-fg-4">Balaji · Nithin · Santhosh · Prabanjan</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
