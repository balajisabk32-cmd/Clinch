import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'

/**
 * Global Lenis smooth scrolling provider.
 *
 * Implements FRONTEND.md §4A:
 * - Buttery inertial scroll momentum
 * - Synchronized with GSAP ticker
 * - Preserves natural touch on mobile
 */

let globalLenis: Lenis | null = null

export function getLenis(): Lenis | null {
  return globalLenis
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Only initialize on viewports > 768px to preserve native mobile feel
    const isMobile = window.innerWidth < 768
    if (isMobile) return

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
    })
    globalLenis = lenis

    const updateTicker = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(updateTicker)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(updateTicker)
      lenis.destroy()
      globalLenis = null
    }
  }, [])

  return <>{children}</>
}
