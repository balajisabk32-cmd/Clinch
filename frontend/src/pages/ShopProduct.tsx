import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Check } from 'lucide-react'
import { ApiError, shopApi, type ShopProduct } from '../lib/authClient'
import { ShopShell, cartChanged } from '../components/ShopShell'
import { CategoryTile } from '../components/CategoryTile'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'

/** Product detail — the customer's view. No cost, no margin, no risk. */

const AVAILABILITY: Record<string, { label: string; tone: string }> = {
  in_stock:      { label: 'In stock',      tone: 'text-band-auto' },
  low_stock:     { label: 'Low stock',     tone: 'text-band-manager' },
  made_to_order: { label: 'Made to order', tone: 'text-fg-3' },
}

export default function ShopProductPage() {
  const { sku = '' } = useParams()
  const navigate = useNavigate()
  const [p, setP] = useState<ShopProduct | null>(null)
  const [qty, setQty] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    shopApi.product(sku).then(setP)
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load that product.'))
  }, [sku])

  const add = async () => {
    if (!p) return
    try {
      const cart = await shopApi.cart()
      const existing = cart.lines.find(l => l.sku === p.sku)
      await shopApi.setCartLine(p.sku, (existing?.qty ?? 0) + qty)
      cartChanged()
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1600)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add that to your basket.')
    }
  }

  if (error && !p) {
    return (
      <ShopShell>
        <div className="py-20 text-center">
          <p className="text-[14px] text-band-finance">{error}</p>
          <Link to="/shop" className="mt-3 inline-block text-[13px] text-accent hover:underline">
            Back to the catalogue
          </Link>
        </div>
      </ShopShell>
    )
  }

  if (!p) {
    return <ShopShell><p className="py-20 text-center text-[13px] text-fg-3">Loading…</p></ShopShell>
  }

  const saving = p.list_price - p.your_price
  const avail = AVAILABILITY[p.availability] ?? AVAILABILITY.made_to_order

  return (
    <ShopShell>
      <div className="flex flex-col gap-6">
        <button onClick={() => navigate(-1)}
                className="self-start inline-flex items-center gap-1.5 text-[12.5px] text-fg-3
                           hover:text-accent transition-colors">
          <ArrowLeft size={13} /> Back
        </button>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
          <CategoryTile sku={p.sku} category={p.category} size="lg"
                        className="h-[300px] w-full" />

          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  {p.category}
                </span>
                {p.is_promoted && (
                  <span className="rounded-full bg-band-managerWash text-band-manager
                                   px-2 py-0.5 font-mono text-[9px] font-semibold">PROMO</span>
                )}
              </div>
              <h1 className="font-display text-[30px] font-bold text-fg tracking-tight
                             leading-tight mt-1.5">
                {p.name}
              </h1>
              <p className="font-mono text-[11.5px] text-fg-3 mt-1.5">{p.sku}</p>
            </div>

            {p.description && (
              <p className="text-[14px] text-fg-2 leading-relaxed max-w-[62ch]">
                {p.description}
              </p>
            )}

            <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift p-5
                            flex flex-col gap-4">
              <div>
                <AnimatedNumber
                  value={p.your_price} format="inr" flash={false}
                  className="font-display text-[30px] font-bold text-fg leading-none"
                />
                <div className="mt-1.5 text-[12.5px] text-fg-3">
                  {saving > 0 ? (
                    <>
                      <span className="line-through">₹{p.list_price.toLocaleString('en-IN')}</span>
                      <span className="ml-2 text-band-auto font-semibold">
                        your tier saves ₹{Math.round(saving).toLocaleString('en-IN')}
                      </span>
                    </>
                  ) : (
                    <>List price · your tier adds no adjustment yet</>
                  )}
                  <span className="ml-2">· excl. {p.tax_pct}% tax · per {p.uom.toLowerCase()}</span>
                </div>
                <div className={`mt-2 font-mono text-[10.5px] uppercase tracking-wider ${avail.tone}`}>
                  {avail.label}
                  {p.is_recurring && ` · billed ${p.recurrence ?? 'on a recurring schedule'}`}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-full ring-1 ring-black/[.08]
                                bg-surface p-0.5">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}
                          aria-label="Decrease quantity"
                          className="w-8 h-8 rounded-full grid place-items-center text-fg-2
                                     hover:bg-surface-2 hover:text-fg transition-colors">
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center font-mono text-[14px] tabular-nums text-fg">
                    {qty}
                  </span>
                  <button onClick={() => setQty(q => Math.min(999, q + 1))}
                          aria-label="Increase quantity"
                          className="w-8 h-8 rounded-full grid place-items-center text-fg-2
                                     hover:bg-surface-2 hover:text-fg transition-colors">
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  onClick={add}
                  className={`flex-1 rounded-full py-3 font-display text-[13.5px] font-semibold
                              inline-flex items-center justify-center gap-2 transition-all
                              ${added ? 'bg-band-auto text-white'
                                      : 'bg-fg text-white hover:shadow-lift-lg active:scale-[.98]'}`}
                >
                  {added ? <><Check size={15} /> Added to basket</> : 'Add to basket'}
                </button>
              </div>

              <p className="text-[11.5px] text-fg-3 leading-relaxed">
                Adding to your basket does not commit you. You request a quotation, and
                your account manager returns a priced offer you can negotiate.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-[12.5px] text-band-finance">{error}</p>
            )}
          </div>
        </div>
      </div>
    </ShopShell>
  )
}
