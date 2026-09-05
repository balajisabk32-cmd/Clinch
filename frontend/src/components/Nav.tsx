import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EASE_CSS, scrollToAnchor } from '../lib/motion'

/**
 * Floating island nav.
 *
 * Absolute Zero §2 bans "edge-to-edge sticky navbars glued to the top", so this
 * is a detached glass pill (mt-6, mx-auto, w-max, rounded-full) that compacts on
 * scroll. backdrop-blur is safe here because the element is fixed (§6).
 */
const LINKS = [
  { href: '#problem', label: 'Problem' },
  { href: '#engine', label: 'Engine' },
  { href: '#evidence', label: 'Evidence' },
  { href: '#simulator', label: 'Simulator' },
  { href: '#built', label: 'Built' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // IntersectionObserver on a sentinel rather than a scroll listener (§5C).
    const sentinel = document.getElementById('nav-sentinel')
    if (!sentinel) return
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 })
    io.observe(sentinel)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <div id="nav-sentinel" className="absolute top-[90px] h-px w-px" aria-hidden />
      <header className="fixed top-0 inset-x-0 z-40 flex justify-center pointer-events-none">
        <div
          className="pointer-events-auto mt-6 mx-4 flex items-center gap-2 rounded-full border
                     ring-1 ring-black/[.06] bg-surface/80 backdrop-blur-xl px-2 py-2"
          style={{
            transition: `all 700ms ${EASE_CSS}`,
            boxShadow: scrolled ? 'var(--lift-2)' : 'var(--lift-1)',
          }}
        >
          <Link to="/" className="flex items-center pl-2.5 pr-3.5 shrink-0" aria-label="Clinch home">
            {/* The mark already contains the wordmark - a second "Clinch" label
                beside it reads as a duplication bug, so the image carries it alone. */}
            <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-[22px] w-auto" />
          </Link>

          <nav aria-label="Sections" className="hidden md:flex items-center gap-1">
            {LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => { e.preventDefault(); scrollToAnchor(l.href) }}
                className="rounded-full px-3.5 py-1.5 text-[13px] text-fg-2 hover:text-accent hover:bg-surface-2"
                style={{ transition: `all 400ms ${EASE_CSS}` }}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <Link
            to="/shop"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-black/[.08] px-3 py-1.5 font-display text-[13px] font-medium text-fg-2 hover:text-fg hover:bg-surface-2 active:scale-[.98]"
            style={{ transition: `all 400ms ${EASE_CSS}` }}
          >
            🛒 Customer Portal
          </Link>

          <Link
            to="/login"
            className="group ml-1 inline-flex items-center gap-2 rounded-full bg-fg pl-4 pr-1.5 py-1.5
                       font-display text-[13px] font-semibold text-white active:scale-[.98]"
            style={{ transition: `all 500ms ${EASE_CSS}` }}
          >
            Open workspace
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[12px]
                             group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:scale-105"
                  style={{ transition: `transform 500ms ${EASE_CSS}` }}>↗</span>
          </Link>

          {/* Hamburger — morphs to an X rather than swapping icons (§5A) */}
          <button
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="md:hidden relative w-9 h-9 rounded-full ring-1 ring-black/[.08] flex items-center justify-center"
          >
            <span className="absolute w-4 h-px bg-fg"
                  style={{ transition: `transform 500ms ${EASE_CSS}`, transform: open ? 'rotate(45deg)' : 'translateY(-3px)' }} />
            <span className="absolute w-4 h-px bg-fg"
                  style={{ transition: `transform 500ms ${EASE_CSS}`, transform: open ? 'rotate(-45deg)' : 'translateY(3px)' }} />
          </button>
        </div>
      </header>

      {/* Full-screen glass overlay with staggered mask reveal (§5A) */}
      <div
        className={`fixed inset-0 z-30 md:hidden backdrop-blur-3xl bg-bg/92 flex flex-col
                    items-center justify-center gap-2 ${open ? '' : 'pointer-events-none'}`}
        style={{ transition: `opacity 600ms ${EASE_CSS}`, opacity: open ? 1 : 0 }}
        aria-hidden={!open}
      >
        <Link
          to="/shop"
          onClick={() => setOpen(false)}
          className="font-display text-2xl font-semibold text-accent py-2"
        >
          🛒 Customer Portal
        </Link>
        {LINKS.map((l, i) => (
          <a
            key={l.href} href={l.href}
            onClick={(e) => { e.preventDefault(); setOpen(false); scrollToAnchor(l.href) }}
            className="font-display text-2xl font-semibold text-fg py-2"
            style={{
              transition: `all 700ms ${EASE_CSS} ${open ? i * 70 + 90 : 0}ms`,
              opacity: open ? 1 : 0,
              transform: open ? 'translateY(0)' : 'translateY(28px)',
            }}
          >
            {l.label}
          </a>
        ))}
      </div>
    </>
  )
}
