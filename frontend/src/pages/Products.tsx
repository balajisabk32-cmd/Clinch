import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, X, Check, Link as LinkIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, inr } from '../lib/api'
import { ErrorBar, Workspace } from '../components/Workspace'
import { ProductImage } from '../components/ProductImage'
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
  image?: string | null
  variants?: Array<{ attribute: string; values: string[]; extra_price: number[] }>
}

const CATEGORIES = ['Hardware', 'Software', 'Services', 'Subscriptions'] as const

const PRESET_IMAGES = [
  { label: 'Laptop 14"', url: '/products/LP14.jpg' },
  { label: 'Laptop 15"', url: '/products/LP15-VIC.jpg' },
  { label: 'Monitor 27"', url: '/products/MON-27.jpg' },
  { label: 'Server Rack', url: '/products/SRV-RACK.jpg' },
  { label: 'Docking Stn', url: '/products/DOCK-01.jpg' },
  { label: 'Cloud Suite', url: '/products/SW-CLOUD.jpg' },
  { label: 'Security SW', url: '/products/SW-SECURE.jpg' },
  { label: 'Onsite Svc', url: '/products/SVC-ONSITE.jpg' },
  { label: 'Warranty Ext', url: '/products/WAR-EXT.jpg' },
]

const BLANK = {
  sku: '', name: '', category: 'Hardware', list_price: '', cost: '',
  uom: 'Each', tax_pct: '18', is_recurring: false, recurrence: 'monthly',
  initial_warehouse: '', initial_stock_qty: '0', image: '',
}

/** Variant options as typed key/value pairs, e.g. Color / Space Gray. */
type Option = { key: string; value: string }

export default function Products() {
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const canManageProducts = user?.role === 'admin' || can('product.manage')
  const [rows, setRows] = useState<Product[]>([])
  const [pricelists, setPricelists] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<'ALL' | typeof CATEGORIES[number]>('ALL')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({ ...BLANK })
  const [busy, setBusy] = useState(false)
  const [depots, setDepots] = useState<string[]>([])
  const [options, setOptions] = useState<Option[]>([{ key: '', value: '' }])

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [imageMode, setImageMode] = useState<'upload' | 'url' | 'presets'>('upload')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(() => {
    Promise.all([api.products(), api.pricelists()])
      .then(([p, pl]) => { setRows(p as Product[]); setPricelists(pl); setError(null) })
      .catch(e => setError(`Could not load the catalogue (${e?.message ?? 'unknown error'}).`))
  }, [])
  useEffect(load, [load])

  // Depots for the storage dropdown. Failing quietly is right: an admin who
  // briefly has no warehouse list should still be able to fill in the rest,
  // and the server applies its own default if none is sent.
  useEffect(() => {
    api.warehouses()
      .then(w => {
        const names = (w as any[]).map(x => x.name)
        setDepots(names)
        setForm(f => ({ ...f, initial_warehouse: f.initial_warehouse || names[0] || '' }))
      })
      .catch(() => { /* dropdown falls back to the server default */ })
  }, [])

  const visible = useMemo(() => {
    const n = search.trim().toLowerCase()
    return rows.filter(p =>
      (cat === 'ALL' || p.category === cat) &&
      (!n || p.name.toLowerCase().includes(n) || p.sku.toLowerCase().includes(n)))
  }, [rows, cat, search])

  const variantCount = rows.reduce((a, p) => a + (p.variants?.length ?? 0), 0)

  const handleImageFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      setUploadError('Please select an image file (PNG, JPG, WebP, GIF)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image exceeds 10MB limit')
      return
    }
    setUploadError(null)
    setUploadingImage(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setImagePreview(dataUrl)
      try {
        const res = await api.uploadProductImage(dataUrl, file.name, form.sku)
        setForm(f => ({ ...f, image: res.url }))
      } catch (err: any) {
        // Keep dataUrl as direct fallback
        setForm(f => ({ ...f, image: dataUrl }))
      } finally {
        setUploadingImage(false)
      }
    }
    reader.onerror = () => {
      setUploadError('Could not read image file')
      setUploadingImage(false)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0])
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const clearImage = () => {
    setImagePreview(null)
    setUploadError(null)
    setForm(f => ({ ...f, image: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const create = async () => {
    setBusy(true); setError(null)
    try {
      const attribute_values = Object.fromEntries(
        options.filter(o => o.key.trim() && o.value.trim())
               .map(o => [o.key.trim(), o.value.trim()]))
      const qty = Number(form.initial_stock_qty || 0)
      await api.createProduct({
        ...form,
        list_price: Number(form.list_price),
        cost: Number(form.cost),
        tax_pct: Number(form.tax_pct),
        recurrence: form.is_recurring ? form.recurrence : null,
        initial_stock_qty: qty,
        attribute_values,
      })
      setNotice(
        `${form.sku.toUpperCase()} added` +
        (qty > 0 ? ` - ${qty} units received into ${form.initial_warehouse}.` : '.'))
      setForm({ ...BLANK, initial_warehouse: depots[0] ?? '' })
      setOptions([{ key: '', value: '' }])
      setImagePreview(null)
      setUploadError(null)
      setCreating(false); load()
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
            <h1 className="font-display text-[19px] font-bold text-fg tracking-tight">Product catalogue</h1>
            <p className="text-[12.5px] text-fg-3 mt-0.5">
              Every product, variant and price rule in one place.
            </p>
          </div>
          {canManageProducts && (
            <button
              onClick={() => {
                setCreating(c => !c)
                if (creating) {
                  setImagePreview(null)
                  setUploadError(null)
                  setForm({ ...BLANK, initial_warehouse: depots[0] ?? '' })
                }
              }}
              className="ml-auto rounded-full bg-fg text-white px-4 py-2 font-display
                         text-[12.5px] font-semibold hover:shadow-lift-lg active:scale-[.98]"
              style={{ transition: `all 320ms ${EASE_CSS}` }}
            >
              {creating ? 'Cancel' : '+ New Product'}
            </button>
          )}
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
            <div key={c.label} className="panel p-5 shadow-lift">
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
        {creating && canManageProducts && (
          <section className="panel p-5">
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
              {/* Where the opening stock lands. A subscription has no shelf,
                  so these two are hidden for a recurring product rather than
                  collecting a number that could never mean anything. */}
              {!form.is_recurring && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                      Storage depot
                    </span>
                    <select
                      value={form.initial_warehouse}
                      onChange={e => setForm({ ...form, initial_warehouse: e.target.value })}
                      className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                                 ring-1 ring-black/[.08] outline-none focus:ring-accent/40"
                    >
                      {depots.length === 0 && <option value="">Loading depots...</option>}
                      {depots.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                      Initial stock
                    </span>
                    <input
                      type="number" min={0} placeholder="0"
                      value={form.initial_stock_qty}
                      onChange={e => setForm({ ...form, initial_stock_qty: e.target.value })}
                      className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                                 ring-1 ring-black/[.08] outline-none focus:ring-accent/40
                                 placeholder:text-fg-4"
                    />
                  </label>
                </>
              )}
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

            {/* Product Photography / Image Upload */}
            <div className="mt-4 pt-4 border-t border-line">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                    Product photography
                  </span>
                  {form.image && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-band-autoWash px-2 py-0.5 text-[10.5px] font-medium text-band-auto">
                      <Check size={12} /> Image ready
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg border border-line text-[11px]">
                  <button
                    type="button"
                    onClick={() => setImageMode('upload')}
                    className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                      imageMode === 'upload' ? 'bg-white shadow-xs text-fg' : 'text-fg-3 hover:text-fg'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('presets')}
                    className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                      imageMode === 'presets' ? 'bg-white shadow-xs text-fg' : 'text-fg-3 hover:text-fg'
                    }`}
                  >
                    Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('url')}
                    className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                      imageMode === 'url' ? 'bg-white shadow-xs text-fg' : 'text-fg-3 hover:text-fg'
                    }`}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              {/* Upload error display */}
              {uploadError && (
                <div className="mb-3 rounded-lg bg-band-financeWash px-3 py-2 text-[12px] text-band-finance flex items-center justify-between">
                  <span>{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="text-band-finance hover:opacity-75">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Live Image Preview Card if image is present */}
              {form.image ? (
                <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3 mb-3">
                  <div className="w-16 h-16 rounded-lg bg-white border border-line p-1 grid place-items-center overflow-hidden shrink-0 shadow-xs">
                    <img
                      src={imagePreview || form.image}
                      alt="Product preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-fg truncate">
                      {form.image.startsWith('data:') ? 'Custom Upload' : form.image.split('/').pop()}
                    </p>
                    <p className="text-[11px] font-mono text-fg-3 truncate">
                      {form.image.startsWith('data:') ? 'base64 data URL' : form.image}
                    </p>
                    {uploadingImage && (
                      <p className="text-[11px] text-accent font-medium mt-0.5 animate-pulse">
                        Uploading to server…
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium text-fg-2 hover:bg-surface-2"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="p-1.5 rounded-lg text-fg-4 hover:text-band-finance hover:bg-band-financeWash transition-colors"
                      title="Remove image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Mode: Upload File Dropzone */}
              {imageMode === 'upload' && !form.image && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-accent bg-accent/5'
                      : 'border-line hover:border-accent/40 bg-surface/50 hover:bg-surface'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageFile(e.target.files[0])
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-surface-2 border border-line grid place-items-center text-fg-3">
                      <Upload size={18} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-fg">
                        Click to upload <span className="text-fg-3 font-normal">or drag & drop</span>
                      </p>
                      <p className="text-[11px] text-fg-3 mt-0.5">
                        PNG, JPG, WebP or GIF up to 10MB
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Presets */}
              {imageMode === 'presets' && (
                <div className="rounded-xl border border-line p-3 bg-surface">
                  <span className="text-[11px] text-fg-3 block mb-2 font-medium">
                    Pick a catalogue preset photo:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {PRESET_IMAGES.map(pr => (
                      <button
                        key={pr.url}
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, image: pr.url }))
                          setImagePreview(pr.url)
                        }}
                        className={`p-2 rounded-lg border text-left flex flex-col items-center gap-1.5 transition-all ${
                          form.image === pr.url
                            ? 'border-accent ring-1 ring-accent bg-accent/5'
                            : 'border-line hover:border-black/20 bg-white'
                        }`}
                      >
                        <img src={pr.url} alt={pr.label} className="w-10 h-10 object-contain" />
                        <span className="text-[10.5px] font-medium text-fg-2 truncate w-full text-center">
                          {pr.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode: Custom URL */}
              {imageMode === 'url' && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon size={14} className="absolute left-3 top-3 text-fg-4" />
                    <input
                      type="text"
                      placeholder="e.g. /products/LP14.jpg or https://images.unsplash.com/..."
                      value={form.image || ''}
                      onChange={e => {
                        const val = e.target.value
                        setForm(f => ({ ...f, image: val }))
                        setImagePreview(val)
                      }}
                      className="w-full rounded-lg bg-surface pl-9 pr-3 py-2 text-[13px] text-fg
                                 ring-1 ring-black/[.08] outline-none focus:ring-accent/40 placeholder:text-fg-4"
                    />
                  </div>
                  {form.image && (
                    <button
                      type="button"
                      onClick={clearImage}
                      className="px-3 py-2 rounded-lg border border-line text-[12px] font-medium text-fg-3 hover:text-fg"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Variant options. Descriptive key/value pairs on one sellable
                SKU - colour, storage, screen size - not separately stocked
                units, which is why they do not create their own quants. */}
            <div className="mt-4 pt-4 border-t border-line">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-3">
                  Variant options
                </span>
                <button
                  onClick={() => setOptions(o => [...o, { key: '', value: '' }])}
                  className="text-[11.5px] font-semibold text-accent hover:underline"
                >
                  + Add option
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {options.map((o, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      placeholder="Option (e.g. Color)"
                      value={o.key}
                      onChange={e => setOptions(prev => prev.map(
                        (x, j) => j === i ? { ...x, key: e.target.value } : x))}
                      className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                                 ring-1 ring-black/[.08] outline-none focus:ring-accent/40
                                 placeholder:text-fg-4"
                    />
                    <input
                      placeholder="Value (e.g. Space Gray)"
                      value={o.value}
                      onChange={e => setOptions(prev => prev.map(
                        (x, j) => j === i ? { ...x, value: e.target.value } : x))}
                      className="rounded-lg bg-surface px-3 py-2 text-[13px] text-fg
                                 ring-1 ring-black/[.08] outline-none focus:ring-accent/40
                                 placeholder:text-fg-4"
                    />
                    <button
                      onClick={() => setOptions(prev =>
                        prev.length === 1 ? [{ key: '', value: '' }]
                                          : prev.filter((_, j) => j !== i))}
                      aria-label="Remove option"
                      className="w-9 rounded-lg text-fg-4 hover:text-band-finance
                                 hover:bg-band-financeWash transition-colors"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
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
        <section className="panel">
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

          <div className="scroll-x">
            <table className="grid-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="w-32">Category</th>
                  <th className="text-right font-medium w-28">Price</th>
                  <th className="text-right font-medium w-24">Margin</th>
                  <th className="w-20">UoM</th>
                  <th className="text-right font-medium w-16">Tax</th>
                  <th className="w-24">Type</th>
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
                      <td>
                        <div className="flex items-center gap-3">
                          <ProductImage
                            src={p.image}
                            name={p.name}
                            className="w-9 h-9 rounded-lg border border-line shrink-0 bg-white shadow-xs"
                          />
                          <div>
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
                          </div>
                        </div>
                      </td>
                      <td className="text-fg-2">{p.category}</td>
                      <td className="text-right font-mono tabular-nums text-fg">
                        {inr(p.list_price)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono tabular-nums
                                      ${margin >= 50 ? 'text-band-auto'
                                        : margin >= 25 ? 'text-fg-2' : 'text-band-manager'}`}>
                        {margin.toFixed(0)}%
                      </td>
                      <td className="text-fg-3">{p.uom}</td>
                      <td className="text-right font-mono text-fg-3">{p.tax_pct}%</td>
                      <td className="text-fg-3">
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
