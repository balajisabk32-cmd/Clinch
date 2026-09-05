import { useEffect, useState } from 'react'
import { Zap, PackageX } from 'lucide-react'
import { api, type Availability } from '../lib/api'
import { AnimatedNumber } from './motion/AnimatedNumber'
import { cn } from '../lib/cn'

/**
 * Live available-to-promise for one SKU, at the quantity being considered.
 *
 * Shows AVAILABLE (on-hand minus reserved), never on-hand. On-hand includes
 * units already promised to other orders, and a builder that reports it is how
 * a sales floor commits the same stock twice.
 *
 * Refetches as the quantity changes, debounced, because the split hint depends
 * on the ask: 12 units may come from one depot and 40 may not.
 */

export function StockIndicator({
  sku, qty, className,
}: { sku: string; qty: number; className?: string }) {
  const [data, setData] = useState<Availability | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Debounced: a stepper held down should not fire a request per click.
    const t = window.setTimeout(() => {
      api.availability([sku], qty)
        .then(res => { if (!cancelled) { setData(res.items[sku] ?? null); setFailed(false) } })
        .catch(() => { if (!cancelled) setFailed(true) })
    }, 220)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [sku, qty])

  // Silent when unavailable. A stock hint that cannot load is a missing
  // convenience, not an error the rep needs to act on.
  if (failed || !data) return null

  const stocked = data.depots.filter(d => d.available > 0)
  const short = data.shortfall > 0
  const tone = short ? 'text-band-finance'
    : data.split_required ? 'text-band-manager' : 'text-fg-3'

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className={cn('font-mono text-[10.5px] tabular-nums flex items-center gap-1', tone)}>
        <AnimatedNumber
          value={data.total_available} format="int" flash={false}
          className="text-[10.5px]"
        />
        <span>
          available across {stocked.length} depot{stocked.length === 1 ? '' : 's'}
          {stocked.length > 0 && (
            <> ({stocked.map(d => `${d.warehouse.replace(/ (Warehouse|Depot)$/, '')}: ${d.available}`)
                  .join(', ')})</>
          )}
        </span>
      </div>

      {/* Only when one depot genuinely cannot cover the ask. Flagging a split
          for a quantity the cheapest depot absorbs would push freight up for
          no reason. */}
      {data.split_required && !short && (
        <div className="font-mono text-[10.5px] text-band-manager flex items-center gap-1">
          <Zap size={10} className="shrink-0" />
          Multi-depot split: {data.plan.map(p =>
            `${p.units} from ${p.warehouse}`).join(', ')}
        </div>
      )}

      {short && (
        <div className="font-mono text-[10.5px] text-band-finance flex items-center gap-1">
          <PackageX size={10} className="shrink-0" />
          {data.shortfall} unit{data.shortfall === 1 ? '' : 's'} short — will backorder
        </div>
      )}
    </div>
  )
}
