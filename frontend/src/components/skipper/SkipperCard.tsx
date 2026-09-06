import type { ReactNode, HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface SkipperCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  innerClassName?: string
  hoverEffect?: boolean
}

/**
 * Double-Bezel (Doppelrand) Card Architecture from FRONTEND.md §2C.1:
 * Outer shell (`p-1.5 rounded-[1.75rem]`) wrapping inner core container with
 * concentric radius (`rounded-[calc(1.75rem-0.375rem)]`) and an inner hairline highlight.
 */
export function SkipperCard({
  children,
  className,
  innerClassName,
  hoverEffect = true,
  ...props
}: SkipperCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-[1.75rem] p-1.5 bg-surface-2/70 ring-1 ring-black/[.05]',
        hoverEffect && 'transition-all duration-300 hover:ring-accent/25 hover:shadow-lift',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'relative h-full w-full rounded-[calc(1.75rem-0.375rem)] bg-surface p-5 ring-1 ring-black/[.04]',
          'shadow-[inset_0_1px_1px_rgba(255,255,255,0.85),0_1px_3px_rgba(13,27,42,0.04)]',
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
