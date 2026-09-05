import { cn } from '../lib/cn'

/**
 * Product imagery, generated rather than photographed.
 *
 * Clinch's catalogue has no images, and inventing photographs of products that
 * do not exist would be exactly the fabrication this project has been removing
 * everywhere else. So these are honestly what they are: typographic category
 * marks, deterministic per SKU, built from the design tokens. Nobody looking at
 * one could mistake it for a photograph of a laptop.
 *
 * Deterministic matters: the same SKU must draw the same tile on every render
 * and every reload, or the grid shimmers on each visit and reads as broken.
 */

const CATEGORY: Record<string, { ink: string; wash: string; glyph: string }> = {
  Hardware:      { ink: 'text-accent',        wash: 'bg-accent-wash',        glyph: '▤' },
  Software:      { ink: 'text-band-manager',  wash: 'bg-band-managerWash',   glyph: '◇' },
  Services:      { ink: 'text-band-auto',     wash: 'bg-band-autoWash',      glyph: '◈' },
  Subscriptions: { ink: 'text-band-finance',  wash: 'bg-band-financeWash',   glyph: '◉' },
}

const FALLBACK = { ink: 'text-fg-3', wash: 'bg-surface-2', glyph: '▢' }

/** Stable small integer from a SKU, so the pattern never changes between loads. */
function hash(sku: string): number {
  let h = 0
  for (let i = 0; i < sku.length; i++) h = (h * 31 + sku.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function CategoryTile({
  sku, category, className, size = 'md',
}: {
  sku: string
  category: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const c = CATEGORY[category] ?? FALLBACK
  const h = hash(sku)
  // Two stable variables per SKU: where the rule sits, and how the mark is
  // offset. Enough that a grid does not look tiled; little enough that it still
  // reads as one family.
  const rule = 28 + (h % 5) * 11
  const shift = (h >> 3) % 3

  const glyphSize = size === 'lg' ? 'text-[54px]' : size === 'sm' ? 'text-[20px]' : 'text-[34px]'
  const pad = size === 'lg' ? 'p-6' : size === 'sm' ? 'p-2.5' : 'p-4'

  return (
    <div
      className={cn('relative overflow-hidden rounded-lg select-none', c.wash, pad, className)}
      aria-hidden="true"
    >
      {/* A single hairline, placed by the hash. Cheap, and it makes each tile
          individual without any of them shouting. */}
      <div
        className="absolute inset-x-0 h-px bg-current opacity-[.14]"
        style={{ top: `${rule}%` }}
      />
      <div className={cn('h-full w-full flex items-center', c.ink,
        shift === 0 ? 'justify-start' : shift === 1 ? 'justify-center' : 'justify-end')}>
        <span className={cn(glyphSize, 'leading-none opacity-70 font-display')}>{c.glyph}</span>
      </div>
      <span className={cn(
        'absolute bottom-1.5 left-2.5 font-mono uppercase tracking-eyebrow opacity-60',
        c.ink, size === 'sm' ? 'text-[7px]' : 'text-[8.5px]',
      )}>
        {category}
      </span>
    </div>
  )
}
