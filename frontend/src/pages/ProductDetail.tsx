import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { api, inr } from '../lib/api'
import { ErrorBar, Workspace } from '../components/Workspace'
import { ProductImage } from '../components/ProductImage'
import { EASE_CSS } from '../lib/motion'

/**
 * Product Detail & Pricelist — wireframe screen 17, PS A2.
 *
 * Three blocks, exactly as the wireframe lays them out: general info, product
 * variants with their extra price, and the tier/currency price rules.
 *
 * Tier prices are DERIVED from the list price and the price-list adjustment
 * rather than stored per tier. Storing a price per tier is how catalogues drift:
 * someone updates the list price and three tier books silently keep the old one.
 */

interface Detail {
  sku: string; name: string; category: string; description?: string
  list_price: number; cost: number; uom: string; tax_pct: number
  is_recurring?: boolean; recurrence?: string | null; is_promoted?: boolean
  margin: number; margin_pct: number
  image?: string | null
  variants: Array<{ attribute: string; values: string[]; extra_price: number[] }>
  prices: Array<{ tier: string; currency: string; adjustment_pct: number
                  rule: string; price: number }>
  stock: Array<{ warehouse: string; on_hand: number; available: number }>
}

export default function ProductDetail() {
  const { sku = '' } = useParams()
  const [p, setP] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<Record<string, any> | null>(null)

  const load = useCallback(() => {
    if (!sku) return
    api.product(sku)
      .then(d => { setP(d as Detail); setError(null); setEdit(null) })
      .catch(e => setError(e?.message?.includes('404')
        ? `No product ${sku}.`
        : `Could not load the product (${e?.message ?? 'unknown error'}).`))
  }, [sku])
  useEffect(load, [load])

  const save = async () => {
    if (!edit) return
    setBusy(true); setError(null)
    try {
      await api.updateProduct(sku, {
        ...edit,
        list_price: Number(edit.list_price),
        cost: Number(edit.cost),
        tax_pct: Number(edit.tax_pct),
      })
      setNotice('Product updated. Tier prices recalculated from the new list price.')
      load()
    } catch (e: any) {
      setError(e?.message?.includes('403')
        ? 'Only an Admin may edit the catalogue — backend setup is reserved to that role.'
        : `Could not save (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  const handleDetailImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      try {
        const res = await api.uploadProductImage(dataUrl, file.name, sku)
        setEdit(prev => prev ? ({ ...prev, image: res.url }) : null)
      } catch {
        setEdit(prev => prev ? ({ ...prev, image: dataUrl }) : null)
      }
    }
    reader.readAsDataURL(file)
  }

  if (!p) {
    return (
      <Workspace onReload={load}>
        {error ? <ErrorBar message={error} onRetry={load} />
               : <p className="text-[13px] text-fg-3">Loading product…</p>}
      </Workspace>
    )
  }

  const field = (k: keyof Detail) => edit ? edit[k] : (p as any)[k]

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}
        {notice && (
          <div className="rounded-xl bg-band-autoWash ring-1 ring-band-auto/25 px-4 py-2.5
                          text-[13px] text-band-auto">{notice}</div>
        )}

        <header className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <ProductImage
                src={edit ? edit.image : p.image}
                name={p.name}
                className="w-16 h-16 rounded-xl border border-line bg-white shadow-xs"
              />
              {edit && (
                <label className="absolute inset-0 bg-black/55 rounded-xl flex flex-col items-center justify-center cursor-pointer text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload size={16} />
                  <span className="text-[9px] font-medium mt-0.5">Upload</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleDetailImage}
                  />
                </label>
              )}
            </div>
            <div>
              <Link to="/app/products" className="font-mono text-[11px] text-fg-3 hover:text-accent">
                ← Product catalogue
              </Link>
              <h1 className="font-display text-[19px] font-bold text-fg tracking-tight mt-0.5">{p.name}</h1>
              <div className="font-mono text-[11.5px] text-fg-3 mt-0.5">
                {p.sku} · {p.category}
                {p.is_recurring && ` · ${p.recurrence} subscription`}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {edit ? (
              <>
                <button onClick={() => setEdit(null)}
                        className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2
                                   font-display text-[12.5px] font-semibold text-fg-2">
                  Cancel
                </button>
                <button onClick={save} disabled={busy}
                        className="rounded-full bg-fg text-white px-5 py-2 font-display
                                   text-[12.5px] font-semibold disabled:opacity-35"
                        style={{ transition: `all 320ms ${EASE_CSS}` }}>
                  Save changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setEdit({
                  name: p.name, category: p.category, list_price: p.list_price,
                  cost: p.cost, uom: p.uom, tax_pct: p.tax_pct,
                  description: p.description ?? '',
                  image: p.image ?? '',
                })}
                className="rounded-full bg-fg text-white px-5 py-2 font-display
                           text-[12.5px] font-semibold hover:shadow-lift-lg active:scale-[.98]"
                style={{ transition: `all 320ms ${EASE_CSS}` }}
              >
                Edit product
              </button>
            )}
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
          <div className="flex flex-col gap-4">

            {/* General info */}
            <section className="panel p-5">
              <h2 className="font-display text-[14px] font-semibold text-fg mb-4">General info</h2>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {([
                  ['name', 'Product name', 'text'],
                  ['category', 'Category', 'text'],
                  ['list_price', 'List price', 'number'],
                  ['cost', 'Cost', 'number'],
                  ['uom', 'Unit of measure', 'text'],
                  ['tax_pct', 'Tax %', 'number'],
                ] as const).map(([k, label, type]) => (
                  <label key={k} className="flex items-center gap-3">
                    <span className="text-[12.5px] text-fg-3 w-32 shrink-0">{label}</span>
                    {edit ? (
                      <input
                        type={type}
                        value={field(k as keyof Detail) ?? ''}
                        onChange={e => setEdit({ ...edit, [k]: e.target.value })}
                        className="flex-1 rounded-lg bg-surface px-3 py-1.5 text-[13px] text-fg
                                   ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                      />
                    ) : (
                      <span className="text-[13px] text-fg font-medium">
                        {type === 'number' && (k === 'list_price' || k === 'cost')
                          ? inr(p[k] as number)
                          : String(p[k as keyof Detail] ?? '—')}
                        {k === 'tax_pct' && '%'}
                      </span>
                    )}
                  </label>
                ))}
                <label className="flex items-start gap-3 sm:col-span-2">
                  <span className="text-[12.5px] text-fg-3 w-32 shrink-0 pt-1.5">Description</span>
                  {edit ? (
                    <textarea
                      rows={2} value={edit.description}
                      onChange={e => setEdit({ ...edit, description: e.target.value })}
                      className="flex-1 rounded-lg bg-surface px-3 py-1.5 text-[13px] text-fg
                                 ring-1 ring-black/[.08] outline-none focus:ring-accent/40 resize-y"
                    />
                  ) : (
                    <span className="text-[13px] text-fg-2">{p.description || '—'}</span>
                  )}
                </label>
              </div>

              <div className="mt-4 pt-4 border-t border-line flex flex-wrap gap-x-8 gap-y-2">
                <span className="text-[12.5px] text-fg-3">
                  Margin <b className={`ml-2 font-mono ${
                    p.margin_pct >= 50 ? 'text-band-auto'
                      : p.margin_pct >= 25 ? 'text-fg' : 'text-band-manager'}`}>
                    {inr(p.margin)} ({p.margin_pct}%)
                  </b>
                </span>
                <span className="text-[12.5px] text-fg-3">
                  Type <b className="ml-2 text-fg">
                    {p.is_recurring ? `Recurring · ${p.recurrence}` : 'One-time'}
                  </b>
                </span>
              </div>
            </section>

            {/* Variants */}
            <section className="panel">
              <div className="px-5 py-3 border-b border-line">
                <h2 className="font-display text-[14px] font-semibold text-fg">Product variants</h2>
              </div>
              {p.variants.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-fg-3">
                  No variants defined. This product is sold as a single configuration.
                </p>
              ) : (
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Attribute</th>
                      <th>Values</th>
                      <th className="text-right font-medium w-40">Extra price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.variants.map(v => (
                      <tr key={v.attribute} className="border-b border-line last:border-0">
                        <td className="text-fg font-medium">{v.attribute}</td>
                        <td className="text-fg-2">{v.values.join(', ')}</td>
                        <td className="text-right font-mono tabular-nums text-fg-2">
                          {v.extra_price.map(x => x === 0 ? '—' : `+${inr(x)}`).join(' / ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Pricelists */}
            <section className="panel">
              <div className="px-5 py-3 border-b border-line">
                <h2 className="font-display text-[14px] font-semibold text-fg">Pricelists</h2>
                <p className="text-[11.5px] text-fg-3 mt-0.5">
                  Derived from list price and the tier rule, so a catalogue change can never
                  leave one tier book stale.
                </p>
              </div>
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th className="w-24">Currency</th>
                    <th>Price rule</th>
                    <th className="text-right font-medium w-32">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {p.prices.map(r => (
                    <tr key={`${r.tier}-${r.currency}`} className="border-b border-line last:border-0">
                      <td className="text-fg font-medium">{r.tier}</td>
                      <td className="font-mono text-fg-2">{r.currency}</td>
                      <td className="text-fg-2">{r.rule}</td>
                      <td className="text-right font-mono tabular-nums text-fg font-semibold">
                        {inr(r.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {/* Stock on hand */}
          <aside className="panel p-5
                            lg:sticky lg:top-[72px]">
            <h2 className="font-display text-[14px] font-semibold text-fg mb-3">Quantity on hand</h2>
            {p.stock.length === 0 ? (
              <p className="text-[12.5px] text-fg-3">
                Not stocked — this is a service or licence with no physical inventory.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {p.stock.map(s => (
                  <div key={s.warehouse} className="flex items-center justify-between">
                    <span className="text-[13px] text-fg-2">{s.warehouse}</span>
                    <span className="font-mono text-[13px] tabular-nums">
                      <span className={s.available === 0 ? 'text-band-finance' : 'text-fg'}>
                        {s.available}
                      </span>
                      <span className="text-fg-4"> / {s.on_hand}</span>
                    </span>
                  </div>
                ))}
                <p className="text-[11px] text-fg-3 mt-1 pt-2 border-t border-line">
                  Shown as available / on hand. The difference is stock already reserved
                  against open orders.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Workspace>
  )
}
