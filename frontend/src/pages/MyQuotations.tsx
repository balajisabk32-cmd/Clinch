import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { ApiError, shopApi, type ShopQuote } from '../lib/authClient'
import { ShopShell } from '../components/ShopShell'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { cn } from '../lib/cn'

/** The customer's own quotations. The server returns only theirs. */

type Row = Omit<ShopQuote, 'lines'>

const STATUS_TONE: Record<string, string> = {
  'Confirmed':                     'bg-band-autoWash text-band-auto ring-band-auto/25',
  'Under Negotiation':             'bg-band-managerWash text-band-manager ring-band-manager/25',
  'Awaiting your account manager': 'bg-surface-2 text-fg-2 ring-black/[.08]',
  'Draft':                         'bg-surface-2 text-fg-3 ring-black/[.08]',
  'Declined':                      'bg-band-financeWash text-band-finance ring-band-finance/25',
  'Ready for your review':         'bg-accent-wash text-accent ring-accent/25',
}

export default function MyQuotations() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    shopApi.quotes()
      .then(r => { setRows(r); setError(null) })
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load your quotations.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <ShopShell>
      <div className="flex flex-col gap-7">
        <header>
          <h1 className="font-display text-[30px] font-bold text-fg tracking-tight leading-tight">
            My quotations
          </h1>
          <p className="text-[13.5px] text-fg-2 mt-1.5">
            Everything your account manager has priced for you, and everything you have asked for.
          </p>
        </header>

        {error && (
          <div role="alert" className="rounded-xl bg-band-financeWash ring-1 ring-band-finance/20
                                       px-4 py-3 text-[13px] text-band-finance">{error}</div>
        )}

        {loading ? (
          <p className="py-20 text-center text-[13px] text-fg-3">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift
                          py-20 text-center flex flex-col items-center gap-3">
            <FileText size={26} className="text-fg-4" />
            <p className="text-[15px] text-fg-2">You have no quotations yet.</p>
            <Link to="/shop"
                  className="inline-flex items-center gap-2 rounded-full bg-fg text-white
                             px-5 py-2.5 font-display text-[13px] font-semibold
                             hover:shadow-lift-lg active:scale-[.98] transition-all">
              Browse the catalogue <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(q => (
              <Link
                key={q.ref}
                to={`/my/quotations/${q.ref}`}
                className="group rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift
                           p-5 flex flex-wrap items-center gap-x-6 gap-y-3
                           hover:shadow-lift-lg hover:ring-accent/30 transition-all duration-300"
              >
                <div className="min-w-0">
                  <div className="font-display text-[16px] font-semibold text-fg leading-tight">
                    Quotation {q.ref}
                  </div>
                  <div className="text-[12px] text-fg-3 mt-1">{q.customer}</div>
                </div>

                <span className={cn(
                  'rounded-full ring-1 px-3 py-1 font-mono text-[10.5px] font-semibold',
                  STATUS_TONE[q.status] ?? 'bg-surface-2 text-fg-2 ring-black/[.08]',
                )}>
                  {q.status}
                </span>

                {q.awaiting_us && (
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    with your account manager
                  </span>
                )}

                <div className="ml-auto flex items-center gap-5">
                  <div className="text-right">
                    <AnimatedNumber
                      value={q.total} format="inr" flash={false}
                      className="font-display text-[18px] font-bold text-fg leading-none"
                    />
                    <div className="font-mono text-[10px] uppercase tracking-eyebrow
                                    text-fg-3 mt-1">
                      incl. tax
                    </div>
                  </div>
                  <ArrowRight size={16}
                              className="text-fg-4 group-hover:text-accent transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ShopShell>
  )
}
