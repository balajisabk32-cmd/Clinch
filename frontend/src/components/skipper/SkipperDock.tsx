import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface SkipperDockProps {
  children: ReactNode
  className?: string
}

/**
 * Floating Dock Navigation Bar (FRONTEND.md §4B.6 & §5A Skipper UI pattern):
 * Centered compact floating glass pill with heavy backdrop blur,
 * subtle double-border, and elevation.
 */
export function SkipperDock({ children, className }: SkipperDockProps) {
  return (
    <div className={cn('sticky top-4 z-40 w-full px-4 flex justify-center pointer-events-none', className)}>
      <nav
        className={cn(
          'pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full',
          'bg-surface/85 backdrop-blur-xl ring-1 ring-black/[.08] dark:ring-white/10',
          'shadow-[0_8px_32px_-4px_rgba(13,27,42,0.12),inset_0_1px_1px_rgba(255,255,255,0.85)]',
          'transition-all duration-300 hover:ring-accent/25 hover:shadow-lift-lg',
        )}
      >
        {children}
      </nav>
    </div>
  )
}
