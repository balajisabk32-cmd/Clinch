import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ArrowRight } from 'lucide-react'
import { ApiError, shopApi, type Cart as CartData } from '../lib/authClient'
import { ShopShell, cartChanged } from '../components/ShopShell'
import { CategoryTile } from '../components/CategoryTile'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'

/**
 * Basket, and the request that turns it into a quotation.
 *
 * Note what is NOT here: a discount field. The customer asks for a price by
 * requesting a quotation and, once it is priced, by negotiating on it — both of
 * which route through the governance engine. A discount box on the basket would
 * hand the buyer the one number the entire product exists to control.
 */

export default function Cart() {
  const navigate = useNavigate()
  const [cart, setCart] = useState<CartData | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    shopApi.cart().then(setCart)
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load your basket.'))
  }, [])
  useEffect(load, [load])

  const setQty = async (sku: string, qty: number) => {
    try {
      setCart(await shopApi.setCartLine(sku, qty))
      cartChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update that line.')
    }
  }

  const remove = async (sku: string) => {
    try {
      setCart(await shopApi.removeCartLine(sku))
      cartChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove that line.')
    }
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await shopApi.requestQuotation(note)
      cartChanged()
      navigate(`/my/quotations/${res.ref}`, { state: { justRequested: true, rep: res.rep } })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send your request.')
      setBusy(false)
    }
  }

  const empty = !cart || cart.lines.length === 0

  return (
    <ShopShell>
      <div className="flex flex-col gap-7">
        <header>
          <h1 className="font-display text-[30px] font-bold text-fg tracking-tight leading-tight">
            Your basket
          </h1>
          <p className="text-[13.5px] text-fg-2 mt-1.5">
            Send this to your account manager and they will come back with a formal quotation.
          </p>
        </header>

        {error && (
          <div role="alert" className="rounded-xl bg-band-financeWash ring-1 ring-band-finance/20
                                       px-4 py-3 text-[13px] text-band-finance">{error}</div>
        )}

        {empty ? (
          <div className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift
                          py-20 text-center">
            <p className="text-[15px] text-fg-2">Your basket is empty.</p>
            <Link to="/shop"
                  className="inline-flex items-center gap-2 mt-4 rounded-full bg-fg text-white
                             px-5 py-2.5 font-display text-[13px] font-semibold
                             hover:shadow-lift-lg active:scale-[.98] transition-all">
              Browse the catalogue <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
            <section className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift
                                overflow-hidden">
              {cart!.lines.map((l, i) => (
                <div
                  key={l.sku}
                  className={`flex items-center gap-4 p-4 ${
                    i < cart!.lines.length - 1 ? 'border-b border-line' : ''}`}
                >
                  <CategoryTile sku={l.sku} category={l.category} size="sm"
                                className="w-14 h-14 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <Link to={`/shop/${l.sku}`}
                          className="font-display text-[14.5px] font-semibold text-fg
                                     hover:text-accent transition-colors">
                      {l.name}
                    </Link>
                    <div className="font-mono text-[11px] text-fg-3 mt-0.5">
                      {l.sku} · ₹{l.your_price.toLocaleString('en-IN')} each
                      {l.is_recurring && ' · recurring'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 rounded-full ring-1 ring-black/[.08]
                                  bg-surface p-0.5 shrink-0">
                    <button
                      onClick={() => setQty(l.sku, Math.max(0, l.qty - 1))}
                      aria-label={`Decrease ${l.name}`}
                      className="w-7 h-7 rounded-full grid place-items-center text-fg-2
                                 hover:bg-surface-2 hover:text-fg transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-8 text-center font-mono text-[13px] tabular-nums text-fg">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => setQty(l.sku, l.qty + 1)}
                      aria-label={`Increase ${l.name}`}
                      className="w-7 h-7 rounded-full grid place-items-center text-fg-2
                                 hover:bg-surface-2 hover:text-fg transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <AnimatedNumber
                    value={l.line_total} format="inr"
                    className="w-24 text-right font-display text-[15px] font-semibold text-fg"
                  />

                  <button
                    onClick={() => remove(l.sku)}
                    aria-label={`Remove ${l.name}`}
                    className="shrink-0 w-8 h-8 rounded-full grid place-items-center text-fg-4
                               hover:text-band-finance hover:bg-band-financeWash transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </section>

            <aside className="rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift
                              p-5 flex flex-col gap-4 lg:sticky lg:top-24">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Indicative total
                </span>
                <span className="font-mono text-[10px] text-fg-3">
                  {cart!.tier} tier
                </span>
              </div>

              <AnimatedNumber
                value={cart!.subtotal} format="inr"
                className="font-display text-[28px] font-bold text-fg leading-none"
              />
              <p className="text-[11.5px] text-fg-3 leading-relaxed -mt-2">
                Before tax, and before any discount your account manager applies.
                The quotation they send back is the binding figure.
              </p>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Note for your account manager
                </span>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="Timelines, volumes, anything they should know…"
                  className="rounded-lg bg-surface px-3 py-2.5 text-[13px] text-fg resize-y
                             ring-1 ring-black/[.08] outline-none focus:ring-accent/45
                             placeholder:text-fg-4"
                />
              </label>

              <button
                onClick={submit}
                disabled={busy}
                className="rounded-full bg-fg text-white py-3 font-display text-[13.5px]
                           font-semibold hover:shadow-lift-lg active:scale-[.98]
                           disabled:opacity-45 disabled:cursor-not-allowed
                           inline-flex items-center justify-center gap-2 transition-all"
              >
                {busy ? 'Sending…' : <>Request quotation <ArrowRight size={15} /></>}
              </button>
            </aside>
          </div>
        )}
      </div>
    </ShopShell>
  )
}
