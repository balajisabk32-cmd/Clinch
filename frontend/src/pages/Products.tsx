import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, inr } from '../lib/api'
import { ErrorBar, Workspace } from '../components/Workspace'
import { EASE_CSS } from '../lib/motion'

/**
 * Product Dashboard — wireframe screen 16, PS A2.
 *
 * Catalogue with the three counters the wireframe shows (Total Products,
 * Pricelists, Variants) and a table of every product. Creating one is
 * Admin-only and enforced on the server — the button is hidden for other roles
 * as a convenience, but the API refuses regardless.
 */

interface Product {
  sku: string; name: string; category: string
  list_price: number; cost: number
  uom: string; tax_pct: number
  is_recurring?: boolean; recurrence?: string | null
  is_promoted?: boolean; stock_total?: number
  variants?: Array<{ attribute: string; values: string[]; extra_price: number[] }>
}

const CATEGORIES = ['Hardware', 'Software', 'Services', 'Subscriptions'] as const

const BLANK = {
  sku: '', name: '', category: 'Hardware', list_price: '', cost: '',
  uom: 'Each', tax_pct: '18', is_recurring: false, recurrence: 'monthly',
}

export default function Products() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Product[]>([])
  const [pricelists, setPricelists] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<'ALL' | typeof CATEGORIES[number]>('ALL')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({ ...BLANK })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    Promise.all([api.products(), api.pricelists()])
      .then(([p, pl]) => { setRows(p as Product[]); setPricelists(pl); setError(null) })
      .catch(e => setError(`Could not load the catalogue (${e?.message ?? 'unknown error'}).`))
  }, [])
  useEffect(load, [load])

  const visible = useMemo(() => {
    const n = search.trim().toLowerCase()
    return rows.filter(p =>
      (cat === 'ALL' || p.category === cat) &&
      (!n || p.name.toLowerCase().includes(n) || p.sku.toLowerCase().includes(n)))
  }, [rows, cat, search])

  const variantCount = rows.reduce((a, p) => a + (p.variants?.length ?? 0), 0)

  const create = async () => {
    setBusy(true); setError(null)
    try {
      await api.createProduct({
        ...form,
        list_price: Number(form.list_price),
        cost: Number(form.cost),
        tax_pct: Number(form.tax_pct),
        recurrence: form.is_recurring ? form.recurrence : null,
      })
      setNotice(`${form.sku.toUpperCase()} added to the catalogue.`)
      setForm({ ...BLANK }); setCreating(false); load()
    } catch (e: any) {
      setError(
        e?.message?.includes('403')
          ? 'Only an Admin may create products — backend setup is reserved to that role.'
          : e?.message?.includes('409')
          ? `A product with SKU ${form.sku.toUpperCase()} already exists.`
          : e?.message?.includes('422')
          ? 'Check the SKU and that list price is greater than zero.'
          : `Could not create the product (${e?.message ?? 'unknown error'}).`)
    } finally { setBusy(false) }
  }

  return (
    <Workspace onReload={load}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBar message={error} onRetry={load} />}
        {notice && (
          <div className="rounded-xl bg-band-autoWash ring-1 ring-band-auto/25 px-4 py-2.5
                          text-[13px] text-band-auto">{notice}</div>
        )}

        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-[22px] font-bold text-fg">Product catalogue</h1>
            <p className="text-[12.5px] text-fg-3 mt-0.5">
              Every product, variant and price rule in one place.
            </p>
          </div>
          <button
            onClick={() => setCreating(c => !c)}
            className="ml-auto rounded-full bg-fg text-white px-4 py-2 font-display
                       text-[12.5px] font-semibold hover:shadow-lift-lg active:scale-[.98]"
            style={{ transition: `all 320ms ${EASE_CSS}` }}
          >
            {creating ? 'Cancel' : '+ New Product'}
          </button>
        </header>

        {/* Counters (wireframe screen 16) */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Products', value: rows.length,
              sub: `${new Set(rows.map(p => p.category)).size} categories` },
            { label: 'Price Rules', value: pricelists.length,
              sub: `${new Set(pricelists.map(p => p.currency)).size} currencies` },
            { label: 'Variants', value: variantCount,
              sub: variantCount ? 'across attribute sets' : 'none defined yet' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-surface ring-1 ring-black/[.055] p-5 shadow-lift">
              <div className="font-display text-[30px] font-bold text-fg tabular-nums leading-none">
                {c.value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-accent mt-2">
                {c.label}
              </div>
              <p className="text-[12px] text-fg-3 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* New product form */}
        {creating && (
          <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift p-5">
            <h2 className="font-display text-[14px] font-semibold text-fg mb-3">New product</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { k: 'sku', label: 'SKU', ph: 'MON-32' },
                { k: 'name', label: 'Product name', ph: 'UltraWide Monitor 32' },
                { k: 'list_price', label: 'List price', ph: '640', type: 'number' },
                { k: 'cost', label: 'Cost', ph: '420', type: 'number' },
                { k: 'uom', label: 'Unit', ph: 'Each' },
                { k: 'tax_pct', label: 'Tax %', ph: '18', type: 'number' },
              ].map(f => (
                <label key={f.k} className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    {f.label}
                  </span>
                  <input
                    type={f.type ?? 'text'} placeholder={f.ph}
                    value={form[f.k]}
                    onChange={e => setForm({ ...form, [f.k]: e.target.value })}
                    className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                               ring-1 ring-black/[.08] outline-none focus:ring-accent/40
                               placeholder:text-fg-4"
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Category
                </span>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                             ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2.5 self-end pb-2">
                <input
                  type="checkbox" checked={form.is_recurring}
                  onChange={e => setForm({ ...form, is_recurring: e.target.checked })}
                  className="accent-[var(--accent)] w-4 h-4"
                />
                <span className="text-[13px] text-fg-2">Subscription product</span>
              </label>
              {form.is_recurring && (
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    Recurrence
                  </span>
                  <select
                    value={form.recurrence}
                    onChange={e => setForm({ ...form, recurrence: e.target.value })}
                    className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                               ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                  >
                    {['monthly', 'quarterly', 'yearly'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
              )}
            </div>
            <button
              onClick={create}
              disabled={busy || !form.sku || !form.name || !form.list_price}
              className="mt-4 rounded-full bg-fg text-white px-5 py-2 font-display
                         text-[12.5px] font-semibold disabled:opacity-35"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              Create product
            </button>
          </section>
        )}

        {/* Catalogue table */}
        <section className="rounded-2xl bg-surface ring-1 ring-black/[.055] shadow-lift overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-2">
            {(['ALL', ...CATEGORIES] as const).map(c => (
              <button
                key={c} onClick={() => setCat(c)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                  cat === c ? 'bg-fg text-white' : 'text-fg-2 bg-surface-2 hover:text-fg'}`}
                style={{ transition: `all 280ms ${EASE_CSS}` }}
              >
                {c === 'ALL' ? 'All' : c}
              </button>
            ))}
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search catalogue…"
              className="ml-auto w-48 rounded-full bg-surface-2 px-3.5 py-1.5 text-[12.5px]
                         text-fg ring-1 ring-black/[.05] outline-none focus:ring-accent/40
                         placeholder:text-fg-4"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[760px]">
              <thead>
                <tr className="font-mono text-[9.5px] uppercase tracking-wider text-fg-3
                               border-b border-line">
                  <th className="text-left font-medium px-4 py-2.5">Product</th>
                  <th className="text-left font-medium px-3 py-2.5 w-32">Category</th>
                  <th className="text-right font-medium px-3 py-2.5 w-28">Price</th>
                  <th className="text-right font-medium px-3 py-2.5 w-24">Margin</th>
                  <th className="text-left font-medium px-3 py-2.5 w-20">UoM</th>
                  <th className="text-right font-medium px-3 py-2.5 w-16">Tax</th>
                  <th className="text-left font-medium px-4 py-2.5 w-24">Type</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const margin = p.list_price ? ((p.list_price - p.cost) / p.list_price) * 100 : 0
                  return (
                    <tr
                      key={p.sku}
                      onClick={() => navigate(`/app/products/${p.sku}`)}
                      className="border-b border-line last:border-0 cursor-pointer hover:bg-surface-2/60"
                      style={{ transition: `background 200ms ${EASE_CSS}` }}
                    >
                      <td className="px-4 py-2.5">
                        <div className="text-fg font-medium">
                          {p.name}
                          {p.is_promoted && (
                            <span className="ml-2 rounded-full bg-band-managerWash text-band-manager
                                             px-1.5 py-0.5 font-mono text-[9px] font-semibold">
                              PROMO
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-fg-3 mt-0.5">
                          {p.sku}
                          {p.variants && p.variants.length > 0 &&
                            ` · ${p.variants.length} variant set`}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-fg-2">{p.category}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">
                        {inr(p.list_price)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono tabular-nums
                                      ${margin >= 50 ? 'text-band-auto'
                                        : margin >= 25 ? 'text-fg-2' : 'text-band-manager'}`}>
                        {margin.toFixed(0)}%
                      </td>
                      <td className="px-3 py-2.5 text-fg-3">{p.uom}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-fg-3">{p.tax_pct}%</td>
                      <td className="px-4 py-2.5 text-fg-3">
                        {p.is_recurring ? p.recurrence ?? 'recurring' : 'one-time'}
                      </td>
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-fg-3">
                    No products match.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Workspace>
  )
}
