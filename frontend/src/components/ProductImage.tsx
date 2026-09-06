import { useState } from 'react'
import { cn } from '../lib/cn'

/**
 * Product photography, with an honest fallback.
 *
 * Products that have no photograph get their name set in type on a neutral
 * ground rather than a stock photo of something else or a generic placeholder
 * icon. A wrong picture on a ₹1,35,000 server is worse than no picture: the
 * buyer is choosing hardware by sight.
 *
 * The image sits on white because the supplied shots are cut-outs on white;
 * tinting the container would leave every product in a coloured box.
 */

export function ProductImage({
  src, name, className, sizes = '(max-width: 640px) 50vw, 300px',
}: {
  src?: string | null
  name: string
  className?: string
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={cn('grid place-items-center bg-surface-2 px-4', className)}>
        <span className="font-display text-[13px] font-semibold text-fg-3 text-center
                         leading-snug line-clamp-3">
          {name}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('bg-white grid place-items-center overflow-hidden', className)}>
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        sizes={sizes}
        onError={() => setFailed(true)}
        className="w-full h-full object-contain"
      />
    </div>
  )
}
