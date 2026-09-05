/**
 * Ambient scene — soft light orbs, engineering grid, film grain.
 *
 * FRONTEND.md bans flat blank backgrounds. Both layers are FIXED and
 * pointer-events-none (§6 performance guardrail): grain attached to a scrolling
 * container causes continuous GPU repaints and kills mobile framerate.
 */
export function Ambient() {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Cool accent bloom, upper left */}
        <div
          className="absolute -top-[20%] -left-[12%] w-[54vw] h-[54vw] rounded-full opacity-[.30] blur-[120px]"
          style={{ background: 'radial-gradient(circle, #7FD8EA 0%, transparent 68%)' }}
        />
        {/* Warm counterweight so the page does not read mono-hue */}
        <div
          className="absolute -bottom-[24%] -right-[14%] w-[48vw] h-[48vw] rounded-full opacity-[.24] blur-[130px]"
          style={{ background: 'radial-gradient(circle, #C7C4F0 0%, transparent 70%)' }}
        />
        {/* Faint engineering grid, masked so it fades at the edges */}
        <div
          className="absolute inset-0 opacity-[.55]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(13,27,42,.045) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(13,27,42,.045) 1px, transparent 1px)',
            backgroundSize: '68px 68px',
            maskImage: 'radial-gradient(ellipse 78% 62% at 50% 34%, #000 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 78% 62% at 50% 34%, #000 40%, transparent 100%)',
          }}
        />
      </div>
      {/* Film grain — physical paper texture at the threshold of perception */}
      <div
        aria-hidden
        className="fixed inset-0 z-[60] pointer-events-none opacity-[.028] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </>
  )
}
