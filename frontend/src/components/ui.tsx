import type { ReactNode } from 'react'
import type { Source } from '../lib/useEngine'
import { EASE_CSS } from '../lib/motion'

import { BAND_CLS, TERM_HEX } from '../lib/constants'

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>
}

export function Band({ band }: { band: string }) {
  return (
    <span className={`inline-block rounded-full ring-1 px-2.5 py-0.5 font-mono text-[10px]
                      font-semibold tracking-wider ${BAND_CLS[band] ?? ''}`}>
      {band}
    </span>
  )
}

/** Double-bezel card — outer shell wrapping a concentric core (FRONTEND.md §4A). */
export function Bezel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bezel ${className}`}>
      <div className="bezel-core h-full">{children}</div>
    </div>
  )
}

export function CTA({
  children, href, variant = 'primary', onClick,
}: { children: ReactNode; href?: string; variant?: 'primary' | 'ghost'; onClick?: () => void }) {
  const cls = variant === 'primary'
    ? 'cta bg-fg text-white hover:shadow-lift-lg active:scale-[.98]'
    : 'cta ring-1 ring-black/[.09] bg-surface text-fg hover:ring-accent/40 hover:text-accent active:scale-[.98]'
  const icon = variant === 'primary' ? 'bg-white/15' : 'bg-fg/[.06]'
  const inner = (
    <>
      {children}
      <span
        className={`cta-icon ${icon} group-hover:translate-x-[2px] group-hover:-translate-y-px group-hover:scale-105`}
        style={{ transition: `transform 500ms ${EASE_CSS}` }}
      >↗</span>
    </>
  )
  const style = { transition: `all 500ms ${EASE_CSS}` }
  return href
    ? <a href={href} className={`group ${cls}`} style={style}>{inner}</a>
    : <button onClick={onClick} className={`group ${cls}`} style={style}>{inner}</button>
}

/**
 * Live-data provenance chip.
 *
 * Rendered beside every computed figure. When the engine is reachable it says
 * so; when it is not, it says these are the last verified figures rather than
 * passing stale numbers off as live. On a page whose entire argument is "our
 * numbers are computed, not claimed", faking that would be the one
 * unforgivable bug.
 */
export function DataSource({ source }: { source: Source }) {
  const map = {
    loading: { dot: 'bg-fg-4 animate-pulse', text: 'Reading engine…', tone: 'text-fg-3' },
    live: { dot: 'bg-band-auto', text: 'Live from engine', tone: 'text-band-auto' },
    offline: { dot: 'bg-band-manager', text: 'Engine offline — last verified run', tone: 'text-band-manager' },
  }[source]
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-eyebrow ${map.tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${map.dot}`} />
      {map.text}
    </span>
  )
}

export function Stat({ value, label, sub }: { value: ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-display text-[clamp(1.7rem,3.4vw,2.5rem)] font-bold text-fg leading-none tabular-nums">
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-accent">{label}</div>
      {sub && <div className="text-[12.5px] text-fg-3 leading-snug max-w-[26ch]">{sub}</div>}
    </div>
  )
}

export function SectionHead({
  eyebrow, title, desc,
}: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col gap-4 mb-12 max-w-[64ch]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display text-[clamp(1.8rem,3.8vw,2.9rem)] font-bold text-fg
                     leading-[1.08] tracking-[-.02em] text-balance">
        {title}
      </h2>
      {desc && <p className="text-[16px] leading-relaxed text-fg-2">{desc}</p>}
    </div>
  )
}

/** Stacked contribution bar — the four scoring terms on one shared scale. */
export function ContributionBar({
  contributions, score, max = 30,
}: { contributions: Record<string, number>; score: number; max?: number }) {
  const order = ['S', 'A', 'L', 'Z'] as const
  const safe = contributions ?? {}
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-9 rounded-lg overflow-hidden bg-surface-2 ring-1 ring-black/[.05] flex">
        {order.map(k => {
          const v = safe[k] ?? 0
          if (v <= 0) return null
          return (
            <div
              key={k}
              style={{
                width: `${(v / max) * 100}%`,
                background: TERM_HEX[k],
                transition: `width 900ms ${EASE_CSS}`,
              }}
              className="h-full flex items-center justify-center"
              title={`${k} = ${v.toFixed(2)}`}
            >
              {v > 2.4 && (
                <span className="font-mono text-[10px] font-semibold text-white">
                  {k} {v.toFixed(1)}
                </span>
              )}
            </div>
          )
        })}
        {/* Approval threshold at 20 points */}
        <div className="absolute inset-y-0 border-l border-dashed border-fg/35"
             style={{ left: `${(20 / max) * 100}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-fg-3">
        <span>0</span>
        <span className="text-fg-2">threshold 20</span>
        <span>total {score.toFixed(1)}</span>
      </div>
    </div>
  )
}
