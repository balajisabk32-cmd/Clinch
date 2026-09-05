import { useState } from 'react'
import type { Suggestion } from '../lib/api'
import { inr } from '../lib/api'
import { EASE_CSS } from '../lib/motion'

/**
 * Upsell / cross-sell panel — PS B5.
 *
 * Shown alongside the cart. Each card carries the three things the spec asks
 * for: the suggested product, the margin delta if added, and a promotion tag
 * where applicable — plus the reasoning behind the ranking, because a suggestion
 * that shows its evidence reads as intelligence while the identical suggestion
 * with no explanation reads as a hardcoded list.
 *
 * The panel heading comes from `basis`, not from wishful thinking: showing
 * "Frequently bought together" above results derived from nothing but a promo
 * flag is a small lie, and anyone who adds one obscure item to an empty cart
 * will catch it.
 */
const HEADING: Record<string, { title: string; sub: string }> = {
  'co-purchase': {
    title: 'Frequently bought together',
    sub: 'Ranked by lift against 120 closed orders, filtered to healthy margin',
  },
  promoted: {
    title: 'Promoted this quarter',
    sub: 'No co-purchase signal for this cart yet — showing promoted items above the margin floor',
  },
  none: { title: 'Suggestions', sub: 'Add a product to see cross-sell suggestions' },
}

export function UpsellPanel({
  suggestions, basis, filtered, onAdd, busy,
}: {
  suggestions: Suggestion[]
  basis: string
  filtered: number
  onAdd: (sku: string) => void
  busy: boolean
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const visible = suggestions.filter(s => !dismissed.has(s.sku))
  const head = HEADING[basis] ?? HEADING.none

  return (
    <section className="flex flex-col gap-3" aria-label="Upsell and cross-sell suggestions">
      <div>
        <h2 className="font-display text-[15px] font-semibold text-fg">{head.title}</h2>
        <p className="text-[12px] text-fg-3 leading-snug mt-0.5">{head.sub}</p>
      </div>

      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-2 px-4 py-6 text-center">
          <p className="text-[13px] text-fg-3">
            {suggestions.length === 0
              ? 'No suggestions clear the margin floor for this cart.'
              : 'All suggestions dismissed.'}
          </p>
          {dismissed.size > 0 && (
            <button
              onClick={() => setDismissed(new Set())}
              className="mt-2 text-[12px] font-semibold text-accent underline"
            >
              Restore {dismissed.size}
            </button>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {visible.map(s => (
          <li
            key={s.sku}
            className="rounded-xl bg-surface ring-1 ring-black/[.055] p-3.5 shadow-lift"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-[14px] font-semibold text-fg leading-tight">
                    {s.name}
                  </span>
                  {s.is_promoted && (
                    <span className="rounded-full bg-band-managerWash text-band-manager
                                     px-2 py-0.5 font-mono text-[9.5px] font-semibold tracking-wider
                                     ring-1 ring-band-manager/20">
                      PROMO
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-fg-3">
                  <span>{s.sku}</span>
                  <span className="text-fg-4">·</span>
                  <span>{s.category}</span>
                  <span className="text-fg-4">·</span>
                  <span>{inr(s.list_price)}</span>
                </div>
              </div>

              {/* Margin delta — the number the rep actually acts on (PS B5) */}
              <div className="text-right shrink-0">
                <div className="font-display text-[15px] font-bold text-band-auto tabular-nums leading-none">
                  +{inr(s.margin_delta)}
                </div>
                <div className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3 mt-1">
                  margin · {s.margin_pct}%
                </div>
              </div>
            </div>

            <p className="mt-2.5 text-[12px] leading-snug text-fg-2">{s.reason}</p>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => onAdd(s.sku)}
                disabled={busy}
                className="flex-1 rounded-full bg-fg text-white py-1.5 font-display text-[12.5px]
                           font-semibold hover:shadow-lift-lg active:scale-[.98]
                           disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                Add to Quote
              </button>
              <button
                onClick={() => setDismissed(d => new Set(d).add(s.sku))}
                className="rounded-full px-3.5 py-1.5 text-[12.5px] text-fg-3 ring-1 ring-black/[.07]
                           hover:text-fg hover:ring-black/[.14]"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                Dismiss
              </button>
            </div>

            {/* The evidence, kept visible rather than hidden behind a tooltip */}
            <div className="mt-2.5 pt-2.5 border-t border-line flex gap-4 font-mono text-[10px] text-fg-3">
              <span>lift <b className="text-fg-2 tabular-nums">{s.lift.toFixed(2)}×</b></span>
              <span>confidence <b className="text-fg-2 tabular-nums">{(s.confidence * 100).toFixed(0)}%</b></span>
              <span>support <b className="text-fg-2 tabular-nums">{(s.support * 100).toFixed(0)}%</b></span>
            </div>
          </li>
        ))}
      </ul>

      {filtered > 0 && (
        <p className="text-[11.5px] text-fg-3 leading-snug">
          {filtered} candidate{filtered === 1 ? '' : 's'} withheld — below the 25% minimum margin threshold.
        </p>
      )}
    </section>
  )
}
