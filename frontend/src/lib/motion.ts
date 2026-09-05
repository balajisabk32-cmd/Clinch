/**
 * Motion engine — Lenis inertial scroll synchronised to the GSAP ticker.
 *
 * Per MASTER-FRONTEND/gsap-scrolltrigger and FRONTEND.md §4A: Lenis drives
 * scroll, GSAP drives the clock, and lagSmoothing is disabled so scrubbed
 * timelines never jump after a frame drop.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

/** Heavy, expensive easing. Never linear or ease-in-out (Absolute Zero §2). */
export const EASE = 'power3.out'
export const EASE_CSS = 'cubic-bezier(0.32,0.72,0,1)'

let lenis: Lenis | null = null

export function initSmoothScroll() {
  if (lenis) return lenis
  // Respect the user's motion preference rather than forcing inertia on them.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  lenis = new Lenis({ lerp: 0.1, smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis?.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
  // Positions are measured after fonts land, otherwise every trigger is stale.
  document.fonts?.ready.then(() => ScrollTrigger.refresh())
  return lenis
}

export function destroySmoothScroll() {
  lenis?.destroy()
  lenis = null
}

/**
 * Anchor navigation, routed through Lenis.
 *
 * Native scrollIntoView() bypasses Lenis entirely, so `lenis.on('scroll')` never
 * fires, ScrollTrigger never updates, and every reveal below the fold stays
 * parked at opacity 0 — the visitor lands on a blank screen. Anchor clicks must
 * go through Lenis (or, when Lenis is disabled for reduced motion, fall back to
 * native scrolling and refresh ScrollTrigger by hand).
 */
export function scrollToAnchor(hash: string) {
  const el = document.querySelector(hash)
  if (!el) return
  if (lenis) {
    lenis.scrollTo(el as HTMLElement, { offset: -90 })
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }
}

/**
 * Last-resort visibility guard.
 *
 * If ScrollTrigger fails for any reason — a refresh race, a browser that blocks
 * the ticker in a background tab, a jump we did not anticipate — content must
 * still be readable. Anything still invisible after the grace period gets
 * revealed. A demo that shows a blank section is worse than one with no
 * animation at all.
 */
export function guaranteeVisible(scope: HTMLElement, delayMs = 2600) {
  window.setTimeout(() => {
    gsap.utils.toArray<HTMLElement>('[data-reveal], [data-stagger] > *', scope).forEach((el) => {
      if (parseFloat(getComputedStyle(el).opacity) < 0.05) {
        gsap.set(el, { opacity: 1, y: 0, filter: 'none' })
      }
    })
  }, delayMs)
}

/**
 * Standard entry reveal: heavy fade-up with a blur resolve.
 * Nothing on this page appears statically (high-end-visual-design §5C).
 */
export function revealOnScroll(scope: HTMLElement, selector = '[data-reveal]') {
  const targets = gsap.utils.toArray<HTMLElement>(selector, scope)
  targets.forEach((el) => {
    gsap.fromTo(
      el,
      { y: 44, opacity: 0, filter: 'blur(8px)' },
      {
        y: 0, opacity: 1, filter: 'blur(0px)',
        duration: 0.9, ease: EASE,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      },
    )
  })
}

/** Staggered group reveal for card rows and stat clusters. */
export function staggerOnScroll(scope: HTMLElement, selector: string, stagger = 0.08) {
  const groups = gsap.utils.toArray<HTMLElement>(selector, scope)
  groups.forEach((group) => {
    gsap.fromTo(
      Array.from(group.children),
      { y: 32, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.75, ease: EASE, stagger,
        scrollTrigger: { trigger: group, start: 'top 86%', once: true },
      },
    )
  })
}

/** Count a number up when it scrolls into view. Figures should land, not sit. */
export function countUp(el: HTMLElement, to: number, format: (n: number) => string) {
  const obj = { v: 0 }
  gsap.to(obj, {
    v: to, duration: 1.4, ease: EASE,
    scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    onUpdate: () => { el.textContent = format(obj.v) },
  })
}

export { gsap, ScrollTrigger }
