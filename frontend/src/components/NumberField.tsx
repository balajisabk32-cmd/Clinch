import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

/**
 * A numeric field you can actually type two digits into.
 *
 * The inputs this replaces called the API on every keystroke and disabled
 * themselves while the request was in flight. Typing "14" therefore sent 1,
 * re-rendered from the server's response with the value 1, and disabled the
 * field mid-keystroke -- which drops focus, so the 4 went nowhere and you had
 * to click back in. Every multi-digit discount in the product had to be entered
 * one digit per click.
 *
 * The fix is a local draft. Keystrokes only ever touch local state; the value
 * is committed on blur, on Enter, or after a pause. The field is never disabled
 * because a request is running -- only because editing is genuinely not allowed
 * -- and an incoming prop is ignored while the field has focus, so a response
 * to the previous edit cannot overwrite what is being typed now.
 */

export function NumberField({
  value, onCommit, disabled = false, min = 0, max = 100, step = 0.5,
  className, suffix, ariaLabel, debounceMs = 700, id,
}: {
  value: number
  onCommit: (next: number) => void
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  className?: string
  suffix?: string
  ariaLabel?: string
  /** Commit this long after typing stops. Blur and Enter commit immediately. */
  debounceMs?: number
  id?: string
}) {
  const [draft, setDraft] = useState(String(value ?? 0))
  const focused = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const lastCommitted = useRef(value)

  // Accept the authoritative value only when the user is not mid-edit.
  useEffect(() => {
    if (focused.current) return
    lastCommitted.current = value
    setDraft(String(value ?? 0))
  }, [value])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  const commit = (raw: string) => {
    window.clearTimeout(timer.current)
    // An empty or half-typed value ("", "-", ".") is not a number yet; fall
    // back to what was last committed rather than sending NaN or 0.
    const parsed = Number(raw)
    const next = raw.trim() === '' || Number.isNaN(parsed)
      ? lastCommitted.current
      : clamp(parsed)
    if (next !== lastCommitted.current) {
      lastCommitted.current = next
      onCommit(next)
    }
    setDraft(String(next))
  }

  return (
    <span className="relative inline-flex items-center w-full">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        onFocus={() => { focused.current = true }}
        onChange={e => {
          setDraft(e.target.value)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => commit(e.target.value), debounceMs)
        }}
        onBlur={e => { focused.current = false; commit(e.target.value) }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.key === 'Escape') {
            window.clearTimeout(timer.current)
            setDraft(String(lastCommitted.current))
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className={cn(
          'w-full rounded-lg bg-surface px-2 py-1 text-center font-mono tabular-nums',
          'ring-1 outline-none disabled:opacity-40 disabled:cursor-not-allowed',
          suffix && 'pr-5',
          className ?? 'ring-black/[.08] text-fg focus:ring-accent/45',
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2 font-mono text-[10.5px] text-fg-4">
          {suffix}
        </span>
      )}
    </span>
  )
}
