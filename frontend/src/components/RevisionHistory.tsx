import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { api, type AuditEvent } from '../lib/api'
import { cn } from '../lib/cn'

/**
 * The back-and-forth on one quotation, read from the audit log.
 *
 * Not a separate revision table: the events are already written on every
 * discount change, send, counter, return and approval, so deriving the history
 * from them means it cannot disagree with the audit trail it is supposed to
 * summarise. There is no cap on revisions and none is implied here.
 */

const ROLE_LABEL: Record<string, string> = {
  rep: 'Sales rep', manager: 'Manager', finance: 'Finance',
  customer: 'Customer', admin: 'Administrator',
}

/** Which side of the conversation an event came from, for the rail colour. */
const TONE: Record<string, string> = {
  customer: 'rail-manager',
  rep: 'rail-auto',
  manager: 'rail-finance',
  finance: 'rail-finance',
}

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short',
                                  hour: '2-digit', minute: '2-digit' })
}

export function RevisionHistory({
  quoteRef, defaultOpen = false, className,
}: { quoteRef: string; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen)
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open || events || failed) return
    api.revisions(quoteRef).then(setEvents).catch(() => setFailed(true))
  }, [open, events, failed, quoteRef])

  const sends = (events ?? []).filter(e => e.event_type === 'sent_to_customer').length

  return (
    <section className={cn('panel', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full panel-head hover:bg-surface-2 transition-colors"
      >
        <span className="panel-title flex items-center gap-1.5">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Revision history
        </span>
        {events && (
          <span className="key text-fg-3">
            {events.length} event{events.length === 1 ? '' : 's'}
            {sends > 0 && ` · ${sends} sent to customer`}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 py-3">
          {failed ? (
            <p className="text-[12.5px] text-fg-3">Could not load the history.</p>
          ) : !events ? (
            <p className="text-[12.5px] text-fg-3">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-[12.5px] text-fg-3">
              Nothing yet. Changes appear here as the quotation moves.
            </p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {events.map((e, i) => (
                <li key={i} className={cn('rail pl-3', TONE[e.actor_role] ?? 'rail-idle')}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12.5px] font-semibold text-fg">{e.actor}</span>
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                      {ROLE_LABEL[e.actor_role] ?? e.actor_role}
                    </span>
                    <span className="ml-auto font-mono text-[10.5px] text-fg-4">
                      {when(e.created_at)}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-fg-2 leading-snug mt-0.5">
                    {e.reason || e.event_type.replace(/_/g, ' ')}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
