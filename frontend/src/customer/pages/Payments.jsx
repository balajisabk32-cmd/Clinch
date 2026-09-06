/**
 * Payments — the customer's own settlement surface.
 *
 * The order tail used to stop at the finance desk: an invoice was raised
 * internally, and the only way it could ever be marked paid was a finance user
 * recording the payment by hand. The customer had no way to see what they owed,
 * let alone settle it. This is the other half of that loop — the same invoices,
 * settled through the same `record_payment` on the server, authored by the
 * customer instead of by finance.
 *
 * Everything shown here comes from `/shop/invoices`, which the server builds
 * field by field from the signed-in account's own company. Nothing internal —
 * no margin, no cost, no risk band — exists in the payload to leak.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const inr = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(Number(v) || 0);

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
};

const BADGE = {
  paid: ['badge-success', 'Paid'],
  partial: ['badge-warning', 'Part paid'],
  unpaid: ['badge-error', 'Unpaid'],
};

/** Past its due date and still owing. */
const isOverdue = (inv) =>
  inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date();

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [methods, setMethods] = useState([]);
  const [open, setOpen] = useState(null);          // ref of the invoice being paid
  const [method, setMethod] = useState('upi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get('/shop/invoices')
      .then((res) => {
        setRows(Array.isArray(res.data) ? res.data : []);
        setError(null);
      })
      .catch(() => setError('Could not load your invoices. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    api.get('/shop/invoices/methods')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setMethods(list);
        setMethod((m) => (list.some((x) => x.key === m) ? m : list[0]?.key ?? m));
      })
      .catch(() => { /* the form falls back to its default method */ });
  }, []);

  const pay = async (inv) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await api.post(`/shop/invoices/${inv.ref}/pay`, { method });
      const paid = res?.data;
      // The shared customer client resolves any response body as `data`, so a
      // refusal arrives as a `detail` payload rather than as a thrown error.
      if (!paid || paid.detail) {
        const d = paid?.detail;
        throw new Error(typeof d === 'string' ? d : d?.message || 'Payment failed.');
      }
      setNotice(
        paid.status === 'paid'
          ? `${inv.ref} settled in full. Your order is now closed.`
          : `Payment received. ${inr(paid.outstanding)} still outstanding on ${inv.ref}.`,
      );
      setOpen(null);
      load();
    } catch (e) {
      setError(e.message || 'Could not take that payment.');
    } finally {
      setBusy(false);
    }
  };

  const download = async (ref) => {
    // The PDF route needs the bearer token, so it cannot be a plain link — an
    // anchor would send no credentials and save the 401 body as a PDF.
    const token = localStorage.getItem('clinch_token');
    try {
      const res = await fetch(`/api/shop/invoices/${ref}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `${ref}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError(`Could not download ${ref}.`);
    }
  };

  const outstanding = rows
    .filter((r) => r.status !== 'paid')
    .reduce((a, r) => a + Number(r.outstanding || 0), 0);
  const settled = rows.filter((r) => r.status === 'paid').length;

  return (
    <div className="container">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-3">
        <Link to="/shop" className="hover:text-[#0d1b2a] transition-colors">Home</Link>
        <span>•</span>
        <span className="text-[#0d1b2a] font-medium">Payments & Invoices</span>
      </div>

      <header className="page-header">
        <div>
          <h1 className="page-title">Payments & Invoices</h1>
          <p className="page-subtitle">
            Invoices raised against your confirmed orders. Settling one here marks it paid
            immediately and closes the order.
          </p>
        </div>
      </header>

      {error && <div className="invoice-alert invoice-alert-error">{error}</div>}
      {notice && <div className="invoice-alert invoice-alert-ok">{notice}</div>}

      {!loading && rows.length > 0 && (
        <div className="invoice-summary">
          <div>
            <span className="invoice-summary-value">{inr(outstanding)}</span>
            <span className="invoice-summary-label">Outstanding</span>
          </div>
          <div>
            <span className="invoice-summary-value">{settled}</span>
            <span className="invoice-summary-label">Settled</span>
          </div>
          <div>
            <span className="invoice-summary-value">{rows.length}</span>
            <span className="invoice-summary-label">Invoices</span>
          </div>
        </div>
      )}

      {loading ? (
        <p className="page-subtitle">Loading your invoices…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h3>No invoices yet</h3>
          <p>An invoice appears here once an order you have confirmed has shipped.</p>
          <Link to="/quotations" className="btn btn-primary">View my quotations</Link>
        </div>
      ) : (
        <div className="invoice-list">
          {rows.map((inv) => {
            const [badge, label] = BADGE[inv.status] || BADGE.unpaid;
            return (
              <article key={inv.ref} className="invoice-card">
                <div className="invoice-card-head">
                  <div className="invoice-card-id">
                    <span className="invoice-ref">{inv.ref}</span>
                    <span className={`badge ${badge}`}>{label}</span>
                    {isOverdue(inv) && <span className="badge badge-error">Overdue</span>}
                  </div>
                  <span className="invoice-amount">{inr(inv.amount)}</span>
                </div>

                <div className="invoice-meta">
                  <span>Order {inv.order_ref}</span>
                  <span>Due {inv.due_date}</span>
                  {inv.paid_at && <span>Paid {when(inv.paid_at)}</span>}
                  {inv.method_label && <span>{inv.method_label}</span>}
                </div>

                {inv.lines?.length > 0 && (
                  <ul className="invoice-lines">
                    {inv.lines.map((l) => (
                      <li key={l.sku}>
                        <span>{l.name} <em>&times;{l.qty}</em></span>
                        <span className="invoice-ref">{inr(l.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {inv.payments?.length > 0 && (
                  <div className="invoice-payments">
                    <span className="invoice-payments-title">Payments received</span>
                    {inv.payments.map((p, i) => (
                      <div key={i} className="invoice-payment-row">
                        <span>{when(p.at)} &middot; {p.method_label}</span>
                        <span className="invoice-ref">{inr(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="invoice-card-foot">
                  <span className="invoice-outstanding">
                    {inv.status === 'paid'
                      ? 'Settled in full'
                      : <>Outstanding <b>{inr(inv.outstanding)}</b></>}
                  </span>
                  <div className="invoice-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => download(inv.ref)}>
                      Download PDF
                    </button>
                    {inv.status !== 'paid' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setOpen(open === inv.ref ? null : inv.ref)}
                      >
                        {open === inv.ref ? 'Cancel' : 'Pay now'}
                      </button>
                    )}
                  </div>
                </div>

                {open === inv.ref && (
                  <div className="invoice-pay-panel">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`method-${inv.ref}`}>
                        Payment method
                      </label>
                      <select
                        id={`method-${inv.ref}`}
                        className="invoice-select"
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                      >
                        {(methods.length ? methods : [{ key: 'upi', label: 'UPI' }]).map((m) => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <p className="page-subtitle">
                      Paying {inr(inv.outstanding)} &mdash; the full outstanding balance
                      on {inv.ref}.
                    </p>
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => pay(inv)}
                    >
                      {busy ? 'Processing…' : `Pay ${inr(inv.outstanding)}`}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
