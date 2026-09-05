import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

/**
 * THE UNIVERSAL MOTION THREAD.
 *
 * Every figure in Clinch that can change — margin %, blended risk score, split
 * freight cost, proration credit, leakage total — renders through this one
 * component, so the whole product has a single interaction grammar: digits roll
 * on an odometer, and the figure briefly recolours to say whether the change was
 * good or bad.
 *
 * The recolour is keyed to MEANING, not direction. A rising margin and a rising
 * revenue leak are both "up", and colouring them the same green would be a lie
 * the eye believes before the label corrects it — so callers declare `polarity`
 * and the component decides the hue from that. `neutral` is for figures with no
 * good direction (a count of open quotes), which flash in the accent instead.
 *
 * Everything animated here is transform and colour only, so it stays on the
 * compositor. Under `prefers-reduced-motion` the roll and the flash are both
 * dropped and the number simply updates — the information never depends on the
 * animation.
 */

type Polarity = 'higher-better' | 'lower-better' | 'neutral'
export type NumberFormat = 'inr' | 'inr-compact' | 'pct' | 'int' | 'dec' | 'x'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatValue(v: number, format: NumberFormat, precision?: number): string {
  if (!Number.isFinite(v)) return '—'
  switch (format) {
    case 'inr':
      return `₹${precision === 2 ? inr2.format(v) : inr.format(Math.round(v))}`
    case 'inr-compact': {
      // Indian scale, because the whole book is in rupees: 1,00,000 is a lakh
      // and 1,00,00,000 a crore. Rendering ₹4.7M to an Indian sales floor is
      // the kind of detail that reads as someone else's template.
      const abs = Math.abs(v)
      if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
      if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
      return `₹${inr.format(Math.round(v))}`
    }
    case 'pct':
      return `${v.toFixed(precision ?? 1)}%`
    case 'dec':
      return v.toFixed(precision ?? 1)
    case 'x':
      return `${v.toFixed(precision ?? 2)}×`
    case 'int':
    default:
      return inr.format(Math.round(v))
  }
}

/** One digit slot. The 0–9 strip slides; the slot clips it. */
function DigitColumn({ digit, instant }: { digit: string; instant: boolean }) {
  const d = Number(digit)
  return (
    <span
      className="relative inline-block overflow-hidden align-baseline"
      style={{ height: '1.15em', lineHeight: '1.15em' }}
    >
      {/* Invisible glyph holds the slot's natural advance width, so the number
          does not reflow as digits change and columns stay on the grid. */}
      <span className="invisible block" style={{ lineHeight: '1.15em' }}>0</span>
      <motion.span
        className="absolute left-0 top-0 flex flex-col"
        initial={false}
        animate={{ y: `${-d * 1.15}em` }}
        transition={
          instant
            ? { duration: 0 }
            : { type: 'spring', stiffness: 320, damping: 34, mass: 0.75 }
        }
      >
        {DIGITS.map((n) => (
          <span key={n} className="block" style={{ height: '1.15em', lineHeight: '1.15em' }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export function AnimatedNumber({
  value,
  format = 'int',
  precision,
  polarity = 'neutral',
  className,
  suffix,
  prefix,
  flash = true,
}: {
  value: number
  format?: NumberFormat
  precision?: number
  polarity?: Polarity
  className?: string
  /** Unit that travels with the figure — 'h', ' days', ' units'. Kept out of
      `format` because it is presentation, not a number system, and it must be
      inside the accessible label so the value is never read out unitless. */
  suffix?: string
  prefix?: string
  /** Turn off the recolour for figures that change constantly and would strobe. */
  flash?: boolean
}) {
  const reduced = useReducedMotion()
  const previous = useRef(value)
  const [tone, setTone] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = value
    if (!flash || reduced || before === value || !Number.isFinite(before)) return
    setTone(value > before ? 'up' : 'down')
    const t = window.setTimeout(() => setTone(null), 1100)
    return () => window.clearTimeout(t)
  }, [value, flash, reduced])

  // Direction -> meaning -> hue.
  const good =
    polarity === 'neutral' ? null
      : polarity === 'higher-better' ? tone === 'up'
        : tone === 'down'

  const toneClass = !tone
    ? 'text-current'
    : good === null ? 'text-accent'
      : good ? 'text-band-auto' : 'text-band-finance'

  const text = `${prefix ?? ''}${formatValue(value, format, precision)}${suffix ?? ''}`

  return (
    <span
      className={cn(
        'inline-flex items-baseline font-mono tabular-nums tracking-tight',
        'transition-colors duration-300',
        toneClass,
        className,
      )}
    >
      {/* The real value, for assistive tech and — just as important — for
          copy-paste. The odometer below stacks all ten digits in the DOM, so
          without this a finance operator selecting a money column and pasting
          it into a spreadsheet gets "0123456789" for every cell. The strip is
          `select-none`, so a selection picks up this text instead. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex items-baseline select-none">
        {text.split('').map((ch, i) =>
          ch >= '0' && ch <= '9'
            ? <DigitColumn key={i} digit={ch} instant={!!reduced} />
            : <span key={i} className={ch === ',' ? 'mx-[.02em]' : ''}>{ch}</span>,
        )}
      </span>
    </span>
  )
}

/**
 * A figure that also states its own movement.
 *
 * Used where the delta is the point — "margin fell 2.4 pts when you applied that
 * discount" — so the operator sees the consequence, not just the new state.
 */
export function AnimatedDelta({
  value, format = 'pct', precision, polarity = 'higher-better', className,
}: {
  value: number
  format?: NumberFormat
  precision?: number
  polarity?: Polarity
  className?: string
}) {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return null
  const good = polarity === 'neutral' ? null : polarity === 'higher-better' ? value > 0 : value < 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-mono tabular-nums text-[11px] font-semibold',
        good === null ? 'text-fg-3' : good ? 'text-band-auto' : 'text-band-finance',
        className,
      )}
    >
      {value > 0 ? '▲' : '▼'}
      {formatValue(Math.abs(value), format, precision)}
    </span>
  )
}
