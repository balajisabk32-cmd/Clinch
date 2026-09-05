import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Conditional classes, with later Tailwind utilities winning over earlier ones.
 *
 * Plain string concatenation leaves both `px-3` and `px-6` in the list and lets
 * stylesheet order decide, which is why a component's own padding sometimes
 * cannot be overridden by the caller. twMerge resolves the conflict in favour
 * of the last one written — so `<Card className="px-6">` does what it reads as.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
