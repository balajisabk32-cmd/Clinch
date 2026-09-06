import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useAnimePulse } from '../../lib/useAnime'

interface SkipperBadgeProps {
  children: ReactNode
  pulse?: boolean
  variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
  className?: string
}

/**
 * Eyebrow badge from FRONTEND.md §2C.3:
 * Microscopic pill tag with uppercase tracking, hairline border,
 * and optional live pulse indicator.
 */
export function SkipperBadge({
  children,
  pulse = false,
  variant = 'neutral',
  className,
}: SkipperBadgeProps) {
  const pulseRef = useAnimePulse<HTMLSpanElement>()

  const variants = {
    neutral: 'bg-surface text-fg-2 ring-black/[.08]',
    accent: 'bg-accent-wash text-accent ring-accent/25',
    success: 'bg-band-autoWash text-band-auto ring-band-auto/30',
    warning: 'bg-band-managerWash text-band-manager ring-band-manager/30',
    danger: 'bg-band-financeWash text-band-finance ring-band-finance/30',
  }

  const dotTones = {
    neutral: 'bg-fg-3',
    accent: 'bg-accent',
    success: 'bg-band-auto',
    warning: 'bg-band-manager',
    danger: 'bg-band-finance',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase font-semibold tracking-[0.14em] ring-1 shadow-2xs select-none',
        variants[variant],
        className,
      )}
    >
      {pulse && (
        <span
          ref={pulseRef}
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotTones[variant])}
        />
      )}
      {children}
    </span>
  )
}
