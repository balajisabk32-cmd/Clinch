import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAnimeHover } from '../../lib/useAnime'

interface SkipperButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  to?: string
  className?: string
}

/**
 * "Button-in-Button" Island CTA from FRONTEND.md §2C.2:
 * Primary pill button with trailing circular sub-pill wrapper for the icon,
 * powered by Anime.js spring physics on hover.
 */
export function SkipperButton({
  children,
  variant = 'primary',
  size = 'md',
  icon = <ArrowUpRight size={14} />,
  to,
  className,
  ...props
}: SkipperButtonProps) {
  const animeRef = useAnimeHover<any>({ scale: 1.025, duration: 400 })

  const baseStyle =
    'inline-flex items-center justify-between font-display font-semibold transition-all duration-200 outline-none select-none disabled:opacity-50 disabled:pointer-events-none'

  const sizeStyles = {
    sm: 'rounded-full pl-4 pr-1.5 py-1.5 text-[12px] gap-2.5',
    md: 'rounded-full pl-5 pr-2 py-2 text-[13.5px] gap-3.5 shadow-sm',
    lg: 'rounded-full pl-6 pr-2.5 py-2.5 text-[15px] gap-4 shadow-lift',
  }

  const iconSubPillSizes = {
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-7 h-7 text-[12px]',
    lg: 'w-8 h-8 text-[14px]',
  }

  const variantStyles = {
    primary:
      'bg-fg text-white hover:bg-fg/90 hover:shadow-lift ring-1 ring-white/15',
    accent:
      'bg-accent text-white hover:bg-accent/95 hover:shadow-lift ring-1 ring-white/20',
    secondary:
      'bg-surface text-fg ring-1 ring-black/[.08] hover:bg-surface-2 hover:ring-black/[.12]',
    ghost:
      'bg-transparent text-fg-2 hover:bg-surface-2/70 hover:text-fg',
  }

  const iconSubPillThemes = {
    primary: 'bg-white/15 text-white',
    accent: 'bg-white/20 text-white',
    secondary: 'bg-black/[.06] text-fg',
    ghost: 'bg-black/[.05] text-fg-2',
  }

  const content = (
    <>
      <span className="font-medium tracking-tight">{children}</span>
      {icon && (
        <span
          className={cn(
            'rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
            iconSubPillSizes[size],
            iconSubPillThemes[variant],
          )}
        >
          {icon}
        </span>
      )}
    </>
  )

  if (to) {
    return (
      <Link
        ref={animeRef}
        to={to}
        className={cn('group', baseStyle, sizeStyles[size], variantStyles[variant], className)}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      ref={animeRef}
      className={cn('group', baseStyle, sizeStyles[size], variantStyles[variant], className)}
      {...props}
    >
      {content}
    </button>
  )
}
