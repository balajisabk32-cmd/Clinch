import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Check } from 'lucide-react'
import { ApiError, shopApi, type ShopProduct } from '../lib/authClient'
import { ShopShell, cartChanged } from '../components/ShopShell'
import { CategoryTile } from '../components/CategoryTile'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { cn } from '../lib/cn'

/**
 * Storefront — the customer's catalogue.
 *
 * Prices shown are the customer's TIER prices, computed on the server from the
 * same price list the quoting engine uses. The storefront deliberately does no
 * pricing arithmetic of its own: a shop that computes its own ladder eventually
 * disagrees with the engine, and then the buyer is shown one number and quoted
 * another.
 */

const AVAILABILITY: Record<string, { label: string; tone: string }> = {
  in_stock:      { label: 'In stock',      tone: 'text-band-auto' },
  low_stock:     { label: 'Low stock',     tone: 'text-band-manager' },
  made_to_order: { label: 'Made to order', tone: 'text-fg-3' },
}

export default function Shop() {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [tier, setTier] = useState('Bronze')
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState<Record<string, boolean>>({})

  const load = useCallback(() => {
    setLoading(true)
    shopApi.catalog({ category: cat, q })
      .then(d => { setProducts(d.products); setCategories(d.categories); setTier(d.tier); setError(null) })
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load the catalogue.'))
      .finally(() => setLoading(false))
  }, [cat, q])

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(load, q ? 250 : 0)
    return () => window.clearTimeout(t)
  }, [load, q])

  const add = async (p: ShopProduct) => {
    try {
      const cart = await shopApi.cart()
      const existing = cart.lines.find(l => l.sku === p.sku)
      await shopApi.setCartLine(p.sku, (existing?.qty ?? 0) + 1)
      cartChanged()
      setAdded(a => ({ ...a, [p.sku]: true }))
      window.setTimeout(() => setAdded(a => ({ ...a, [p.sku]: false })), 1400)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add that to your basket.')
    }
  }

  return (
    <ShopShell>
      <div className="flex flex-col gap-7">
        <header className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="font-display text-[30px] font-bold text-fg tracking-tight leading-tight">
              Catalogue
            </h1>
            <p className="text-[13.5px] text-fg-2 mt-1.5">
              Your {tier} tier pricing is applied to every item. Build a basket and
              request a quotation — your account manager prices it.
            </p>
          </div>
          <label className="ml-auto relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-4" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-[260px] rounded-full bg-surface pl-9 pr-3.5 py-2.5 text-[13px] text-fg
                         ring-1 ring-black/[.08] outline-none focus:ring-accent/45
                         placeholder:text-fg-4"
            />
          </label>
        </header>

        {error && (
          <div role="alert" className="rounded-xl bg-band-financeWash ring-1 ring-band-finance/20
                                       px-4 py-3 text-[13px] text-band-finance">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {['All', ...categories].map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={cn(
                'rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors duration-200',
                cat === c ? 'bg-fg text-white' : 'bg-surface text-fg-2 ring-1 ring-black/[.07] hover:text-fg',
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {loading && products.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-fg-3">Loading the catalogue…</p>
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[14px] text-fg-2">Nothing matches that search.</p>
            <button onClick={() => { setQ(''); setCat('All') }}
                    className="mt-3 text-[13px] text-accent hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(p => {
              const saving = p.list_price - p.your_price
              const avail = AVAILABILITY[p.availability] ?? AVAILABILITY.made_to_order
              return (
                <article
                  key={p.sku}
                  className="group flex flex-col rounded-2xl bg-surface ring-1 ring-black/[.06]
                             shadow-lift overflow-hidden hover:shadow-lift-lg
                             transition-shadow duration-300"
                >
                  <Link to={`/shop/${p.sku}`} className="block">
                    <CategoryTile sku={p.sku} category={p.category} size="md"
                                  className="h-[132px] rounded-none" />
                  </Link>

                  <div className="flex flex-col gap-2 p-4 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/shop/${p.sku}`}
                            className="font-display text-[15px] font-semibold text-fg leading-snug
                                       hover:text-accent transition-colors">
                        {p.name}
                      </Link>
                      {p.is_promoted && (
                        <span className="shrink-0 rounded-full bg-band-managerWash text-band-manager
                                         px-2 py-0.5 font-mono text-[9px] font-semibold">
                          PROMO
                        </span>
                      )}
                    </div>

                    <p className="text-[12.5px] text-fg-3 leading-relaxed line-clamp-2">
                      {p.description || `${p.category} · sold per ${p.uom.toLowerCase()}`}
                    </p>

                    <div className="mt-auto pt-2 flex items-end justify-between gap-3">
                      <div className="flex flex-col">
                        <AnimatedNumber
                          value={p.your_price} format="inr" flash={false}
                          className="font-display text-[19px] font-bold text-fg leading-none"
                        />
                        {saving > 0 && (
                          <span className="mt-1 text-[11.5px] text-fg-3">
                            <span className="line-through">₹{p.list_price.toLocaleString('en-IN')}</span>
                            <span className="ml-1.5 text-band-auto font-semibold">
                              save ₹{Math.round(saving).toLocaleString('en-IN')}
                            </span>
                          </span>
                        )}
                        <span className={cn('mt-1 font-mono text-[10px] uppercase tracking-wider',
                                            avail.tone)}>
                          {avail.label}
                          {p.is_recurring && ` · ${p.recurrence ?? 'recurring'}`}
                        </span>
                      </div>

                      <button
                        onClick={() => add(p)}
                        className={cn(
                          'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2',
                          'font-display text-[12.5px] font-semibold transition-all duration-200',
                          added[p.sku]
                            ? 'bg-band-auto text-white'
                            : 'bg-fg text-white hover:shadow-lift active:scale-[.97]',
                        )}
                      >
                        {added[p.sku]
                          ? <><Check size={13} /> Added</>
                          : <><Plus size={13} /> Add</>}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </ShopShell>
  )
}
