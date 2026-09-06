import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'

/**
 * Reusable Anime.js v4 physics & micro-interaction helpers.
 *
 * Implements haptic spring interactions and kinetic choreography
 * matching FRONTEND.md §3A and §7.
 */

export function useAnimeHover<T extends HTMLElement = HTMLButtonElement>(options?: {
  scale?: number
  duration?: number
}) {
  const ref = useRef<T>(null)
  const scale = options?.scale ?? 1.03
  const duration = options?.duration ?? 450

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onMouseEnter = () => {
      animate(el, {
        scale,
        duration,
        ease: 'outElastic(1, .75)',
      })
    }

    const onMouseLeave = () => {
      animate(el, {
        scale: 1,
        duration: 350,
        ease: 'outQuad',
      })
    }

    const onMouseDown = () => {
      animate(el, {
        scale: 0.97,
        duration: 150,
        ease: 'outQuad',
      })
    }

    const onMouseUp = () => {
      animate(el, {
        scale,
        duration: 300,
        ease: 'outElastic(1, .8)',
      })
    }

    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('mouseleave', onMouseLeave)
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('mouseenter', onMouseEnter)
      el.removeEventListener('mouseleave', onMouseLeave)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseup', onMouseUp)
    }
  }, [scale, duration])

  return ref
}

/**
 * Stagger reveal container children using Anime.js v4
 */
export function useAnimeStagger<T extends HTMLElement = HTMLDivElement>(
  selector: string = ':scope > *',
  delay = 50,
) {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const items = containerRef.current.querySelectorAll(selector)
    if (!items.length) return

    animate(items, {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 600,
      delay: stagger(delay),
      ease: 'outCubic',
    })
  }, [selector, delay])

  return containerRef
}

/**
 * Pulse aura animation on live badges/dots
 */
export function useAnimePulse<T extends HTMLElement = HTMLSpanElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!ref.current) return
    const anim = animate(ref.current, {
      scale: [1, 1.25, 1],
      opacity: [0.75, 1, 0.75],
      duration: 2200,
      loop: true,
      ease: 'inOutSine',
    })

    return () => {
      try {
        anim.pause()
      } catch {
        /* cleanup */
      }
    }
  }, [])

  return ref
}
