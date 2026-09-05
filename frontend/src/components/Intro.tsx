import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Fullscreen logo intro (Light Theme).
 *
 * Demo guardrail: this must NEVER be able to trap the viewer. Autoplay can be
 * blocked, the file can fail to decode, or `ended` can fail to fire. There are
 * four independent exits — video end / 3.5s timeupdate, click anywhere, the Skip
 * button, and a hard 4.2-second safety ceiling.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [leaving, setLeaving] = useState(false)
  const done = useRef(false)

  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    if (videoRef.current) {
      videoRef.current.pause()
    }
    try {
      sessionStorage.setItem('dealflow360_intro_shown', 'true')
      localStorage.setItem('dealflow360_intro_shown', 'true')
    } catch {}
    setLeaving(true)
    setTimeout(onDone, 620)
  }, [onDone])

  useEffect(() => {
    const v = videoRef.current
    // Autoplay is blocked in some contexts; failing to start must not stall us.
    v?.play?.().catch(() => {})
    const hardStop = setTimeout(finish, 3800)
    return () => clearTimeout(hardStop)
  }, [finish])

  return (
    <div
      onClick={finish}
      className={`fixed inset-0 z-[100] bg-bg flex items-center justify-center cursor-pointer
                  transition-opacity duration-[600ms] ${leaving ? 'opacity-0' : 'opacity-100'}`}
      role="button"
      aria-label="Skip introduction"
    >
      <video
        ref={videoRef}
        src="/LOGO_ANIMATION.mp4"
        poster="/CLINCH_LOGO_TRANSPARENT.png"
        muted
        playsInline
        autoPlay
        loop={false}
        preload="auto"
        onEnded={finish}
        onError={finish}
        onTimeUpdate={(e) => {
          if (e.currentTarget.currentTime >= 3.45) {
            e.currentTarget.pause()
            finish()
          }
        }}
        className={`max-w-[min(78vw,880px)] w-full h-auto mix-blend-multiply transition-transform duration-[600ms]
                    ${leaving ? 'scale-[.94]' : 'scale-100'}`}
      />
      <button
        onClick={(e) => { e.stopPropagation(); finish() }}
        className="absolute bottom-9 right-9 text-[11px] uppercase tracking-eyebrow
                   text-fg-3 hover:text-accent transition-colors"
      >
        Skip
      </button>
    </div>
  )
}
