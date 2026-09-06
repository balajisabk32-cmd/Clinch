import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { StatusBadge, formatCurrency } from '../components/shared';
import StatusTracker from '../components/StatusTracker';
import { useToast } from '../context/ToastContext';

// 5-step Main Quotation Workflow
const MAIN_QUOTE_STEPS = [
  'submitted',
  'manager_approval',
  'in_negotiation',
  'customer_accepted',
  'fulfillment',
];

const getMainStepLabel = (step, { isDone }) => {
  switch (step) {
    case 'submitted':
      return 'SUBMITTED';
    case 'manager_approval':
      return isDone ? 'MANAGER APPROVED' : 'MANAGER APPROVAL';
    case 'in_negotiation':
      return 'IN NEGOTIATION';
    case 'customer_accepted':
      return 'CUSTOMER ACCEPTED';
    case 'fulfillment':
      return 'FULFILLMENT';
    default:
      return step.toUpperCase();
  }
};

// 4-step Discount Request Negotiation Timeline
const DISCOUNT_TIMELINE_STEPS = [
  'requested',
  'manager_review',
  'decision',
  'confirmation',
];

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lineComments, setLineComments] = useState({});
  const [lineDiscounts, setLineDiscounts] = useState({});
  const [counterDiscount, setCounterDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [confirmOutcome, setConfirmOutcome] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/shop/quotes/${id}`);
      const q = res.data;
      // Guard: if backend returned an error body, treat as not-found
      if (!q || q.detail) { setQuote(null); return; }
      setQuote(q);
      const initialComments = {};
      (q.lines || []).forEach((line, i) => {
        initialComments[i] = line.customer_comment || '';
      });
      setLineComments(initialComments);
      if (q.order_discount_pct) {
        setCounterDiscount(q.order_discount_pct);
      }
    } catch (err) {
      showToast('Failed to load quotation details', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Determine current active step index in Main Workflow
  const getMainWorkflowState = () => {
    if (!quote) return { currentStep: 0, statusTitle: '', statusSubtitle: '' };

    switch (quote.state) {
      case 'pending_review':
      case 'pending_approval':
        return {
          currentStep: 1, // Step 0 done (SUBMITTED), Step 1 active (MANAGER APPROVAL)
          statusTitle: 'Awaiting Sales Manager Approval',
          statusSubtitle: 'Your quotation is currently being reviewed by the Sales Manager. You will be able to continue once it is approved.',
        };
      case 'sent':
        return {
          currentStep: 2, // Step 0 done, Step 1 done (MANAGER APPROVED), Step 2 active (IN NEGOTIATION)
          statusTitle: 'Quotation Approved',
          statusSubtitle: 'Your quotation has been approved by the Sales Manager and is now ready for negotiation.',
        };
      case 'under_negotiation':
        return {
          currentStep: 2, // Step 0 done, Step 1 done (MANAGER APPROVED), Step 2 active (IN NEGOTIATION)
          statusTitle: 'Quotation is ready for negotiation.',
          statusSubtitle: 'You can add comments, request a better discount, request customization, or accept the quotation.',
        };
      case 'confirmed':
        return {
          currentStep: 4, // Step 0..3 done, Step 4 active (FULFILLMENT)
          statusTitle: 'Quotation Accepted',
          statusSubtitle: 'Your order has been created and is being prepared for fulfillment.',
        };
      case 'fulfillment':
      case 'delivered':
        return {
          currentStep: 4, // Final fulfillment
          statusTitle: 'Order in Fulfillment',
          statusSubtitle: 'Your order has been routed to the fulfillment team.',
        };
      default:
        return {
          currentStep: 1,
          statusTitle: 'Quotation Submitted',
          statusSubtitle: 'Quotation submitted successfully. It is now being processed for approval.',
        };
    }
  };

  // Submit discount counter-offer via the /shop/quotes/{ref}/request endpoint
  const handleNegotiate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      // Calculate effective discount from per-product allotments if overall counterDiscount not typed
      let effDiscount = counterDiscount ? parseFloat(counterDiscount) : undefined;
      const itemAllotmentNotes = [];
      (quote.lines || []).forEach((item) => {
        const d = lineDiscounts[item.id];
        const c = lineComments[item.id];
        if (d && parseFloat(d) > 0) {
          itemAllotmentNotes.push(`${item.name}: ${d}% requested discount`);
        }
        if (c && c.trim()) {
          itemAllotmentNotes.push(`${item.name}: ${c.trim()}`);
        }
      });

      if (effDiscount === undefined && Object.values(lineDiscounts).some((v) => parseFloat(v) > 0)) {
        const lines = quote?.lines || [];
        let totSub = 0;
        let totDisc = 0;
        lines.forEach((l) => {
          const sub = (l.unit_price || 0) * (l.qty || 1);
          totSub += sub;
          const d = parseFloat(lineDiscounts[l.id] || 0);
          totDisc += sub * (d / 100);
        });
        if (totSub > 0 && totDisc > 0) {
          effDiscount = Math.round((totDisc / totSub) * 10) / 10;
        }
      }

      await api.post(`/shop/quotes/${id}/request`, {
        action: 'negotiate',
        discount_pct: effDiscount,
        note: itemAllotmentNotes.join(' | ') || Object.values(lineComments).filter(Boolean).join(' | ') || undefined,
      });
      showToast('Product discount request submitted for Sales Manager review!', 'success');
      await fetchQuote();
    } catch (err) {
      showToast(err?.message || 'Failed to submit negotiation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /* Customer confirms.
     Posts to /confirm, which re-scores the FINAL terms with the same engine the
     approval desk uses and decides what happens next. Two outcomes, and the
     customer is told which one they got rather than left with a generic
     "accepted": either the order proceeds straight to fulfilment, or it has
     re-entered the approval chain because the terms are still over a ceiling. */
  const handleAcceptProposal = async () => {
    if (!window.confirm('Confirm and accept this quotation?')) return;
    try {
      setAccepting(true);
      const res = await api.post(`/shop/quotes/${id}/confirm`, {});
      const d = res.data || {};
      setConfirmOutcome(d);
      showToast(
        d.message || 'Quotation confirmed.',
        d.approval_required ? 'info' : 'success');
      await fetchQuote();
    } catch (err) {
      showToast(err?.message || 'Could not confirm this quotation', 'error');
    } finally {
      setAccepting(false);
    }
  };

  // Customer accepts manager's counter-offer
  const handleAcceptCounterOffer = async () => {
    try {
      setActionLoading(true);
      const res = await api.post(`/shop/quotes/${id}/request`, { action: 'accept_counter' });
      showToast(res.data?.message || 'Counter offer accepted!', 'success');
      await fetchQuote();
    } catch (err) {
      showToast(err?.message || 'Failed to accept counter offer', 'error');
    } finally {
      setActionLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading quotation details...
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <h2>Quotation not found</h2>
        <Link to="/quotations" className="btn btn-primary" style={{ marginTop: '16px' }}>Back to Quotations</Link>
      </div>
    );
  }

  const { currentStep, statusTitle, statusSubtitle } = getMainWorkflowState();

  const isPendingInitialApproval = quote.status === 'pending_review' || quote.status === 'pending_approval';
  const isManagerApproved = quote.status === 'sent';
  const isInNegotiation = quote.status === 'under_negotiation';
  const isConfirmed = quote.status === 'confirmed' || quote.status === 'fulfillment' || quote.status === 'delivered';

  // Discount Request Card Status calculation
  const hasDiscountRequest = !!quote.discount_request_status;

  const getDiscountStepStates = () => {
    switch (quote.discount_request_status) {
      case 'pending_approval':
        return {
          stepStates: {
            requested: 'done',
            manager_review: 'active',
            decision: 'upcoming',
            confirmation: 'upcoming',
          },
          currentStep: 1,
        };
      case 'approved':
        return {
          stepStates: {
            requested: 'done',
            manager_review: 'done',
            decision: 'done',
            confirmation: 'active',
          },
          currentStep: 3,
        };
      case 'rejected':
        return {
          stepStates: {
            requested: 'done',
            manager_review: 'done',
            decision: 'rejected',
            confirmation: 'upcoming',
          },
          currentStep: 2,
        };
      case 'counter_offer':
        return {
          stepStates: {
            requested: 'done',
            manager_review: 'done',
            decision: 'active',
            confirmation: 'upcoming',
          },
          currentStep: 2,
        };
      default:
        return { stepStates: null, currentStep: 0 };
    }
  };

  const { stepStates: discountStepStates, currentStep: discountCurrentStep } = getDiscountStepStates();

  const getDiscountStepLabel = (step, { isDone, isRejected }) => {
    switch (step) {
      case 'requested':
        return 'Discount Requested';
      case 'manager_review':
        if (quote.discount_request_status === 'pending_approval') {
          return 'Waiting for Sales Manager';
        }
        if (quote.discount_request_status === 'approved') {
          return 'Manager Approved';
        }
        return 'Manager Reviewed';
      case 'decision':
        if (isRejected) return 'Discount Rejected';
        if (quote.discount_request_status === 'counter_offer') return 'Counter Offer Available';
        if (isDone) return 'Approval Decision';
        return 'Approval Decision';
      case 'confirmation':
        return 'Customer Confirmation';
      default:
        return step;
    }
  };

  /* Totals come from the server as `total` (and `subtotal`), computed by the
     same pricing engine as the internal quote. The page read `total_amount`, a
     field that has never existed on this payload, so the headline read "₹0" on
     a quotation whose lines added up to lakhs -- and `items`/`quantity`, which
     do not exist either, so the counter-offer preview was always zero too. */
  const quoteTotal = Number(quote.total ?? 0);
  const baseItemsTotal = (quote.lines || [])
    .reduce((acc, it) => acc + Number(it.unit_price) * Number(it.qty), 0);
  const counterTotal = quote.counter_discount
    ? baseItemsTotal * (1 - Number(quote.counter_discount) / 100)
    : quoteTotal;

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-8">
      {/* What confirming actually did */}
      {confirmOutcome && (
        <div
          role="status"
          className={`mb-6 p-4 rounded-xl border ${
            confirmOutcome.approval_required
              ? 'border-[#b45309]/30 bg-[#fbf0dc] text-[#b45309]'
              : 'border-[#047857]/30 bg-[#dcf3ea] text-[#047857]'
          }`}
        >
          <div className="font-bold text-sm">
            {confirmOutcome.approval_required
              ? 'Confirmed: routed for manager approval due to final discount terms.'
              : 'Confirmed: proceeding to fulfilment.'}
          </div>
          <div className="text-xs mt-1.5 opacity-90">
            {confirmOutcome.approval_required ? (
              <>
                The terms you accepted are above what your account manager can
                approve alone, so {confirmOutcome.routed_to || 'their manager'} is
                reviewing them
                {confirmOutcome.needs_finance ? ', with Finance to follow' : ''}.
                You do not need to do anything.
              </>
            ) : (
              <>
                Your order is with our warehouse team and an invoice will follow.
                No approval was needed: the final terms are within policy.
              </>
            )}
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-4">
        <Link to="/quotations" className="hover:text-[#0d1b2a] transition-colors">Quotations</Link>
        <span>•</span>
        <span className="font-mono text-[#0d1b2a] font-semibold">{quote.quote_number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#0d1b2a] tracking-tight leading-tight m-0">
              {quote.quote_number}
            </h1>
            <StatusBadge status={quote.status} />
          </div>
          <div className="text-xs text-[#7b8ca0]">
            Last updated {quote.last_activity_at
              ? new Date(quote.last_activity_at).toLocaleDateString('en-IN',
                  { day: 'numeric', month: 'long', year: 'numeric' })
              : 'recently'}
            {quote.updated_at && ` • Updated on ${new Date(quote.updated_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </div>
        </div>

        <div className="md:text-right">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#7b8ca0]">
            Total Value
          </div>
          <div className="font-['Syne',sans-serif] text-[1.8rem] font-extrabold text-[#0e7490] leading-tight">
            {formatCurrency(quoteTotal)}
          </div>
          {parseFloat(quote.discount_applied) > 0 && (
            <div className="text-xs font-semibold text-[#047857] mt-0.5">
              Includes {quote.discount_applied}% volume discount
            </div>
          )}
        </div>
      </div>

      {/* =======================================================
          MAIN QUOTATION WORKFLOW TIMELINE
          SUBMITTED → MANAGER APPROVAL → IN NEGOTIATION → CUSTOMER ACCEPTED → FULFILLMENT
          ======================================================= */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', margin: '24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Main Quotation Lifecycle
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
            ● Dynamic Lifecycle Status
          </span>
        </div>

        <StatusTracker
          steps={MAIN_QUOTE_STEPS}
          currentStep={currentStep}
          labels={getMainStepLabel}
        />

        {/* State-Driven Customer Message Bar (Always matches timeline state) */}
        <div style={{
          marginTop: '20px',
          padding: '16px 20px',
          borderRadius: 'var(--radius-sm)',
          background: isConfirmed ? 'rgba(0, 230, 118, 0.08)' : isPendingInitialApproval ? 'rgba(255, 171, 0, 0.08)' : 'var(--bg-hover)',
          border: isConfirmed ? '1px solid rgba(0, 230, 118, 0.25)' : isPendingInitialApproval ? '1px solid rgba(255, 171, 0, 0.25)' : '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: '0.95rem',
              color: isConfirmed ? 'var(--success)' : isPendingInitialApproval ? 'var(--warning)' : 'var(--text-primary)',
              marginBottom: '2px',
            }}>
              {statusTitle}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {statusSubtitle}
            </div>
          </div>

        </div>
      </div>

      {/* =======================================================
          INDEPENDENT DISCOUNT REQUEST STATUS CARD
          Displayed whenever a discount negotiation is requested
          ======================================================= */}
      {hasDiscountRequest && (
        <div className="discount-request-card" style={{
          borderLeft: quote.discount_request_status === 'approved'
            ? '4px solid var(--success)'
            : quote.discount_request_status === 'rejected'
            ? '4px solid var(--error)'
            : quote.discount_request_status === 'counter_offer'
            ? '4px solid var(--info)'
            : '4px solid var(--warning)',
        }}>
          <div className="discount-request-header">
            <div>
              <div className="discount-request-title">
                <span>Discount Request</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 4 }}>
                  Requested Discount: {quote.requested_discount || counterDiscount}%
                </span>
              </div>
            </div>

            <div>
              {quote.discount_request_status === 'pending_approval' && (
                <span style={{ background: 'rgba(255, 171, 0, 0.15)', color: 'var(--warning)', padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700 }}>
                  Pending Deal Governance Review
                </span>
              )}
              {quote.discount_request_status === 'approved' && (
                <span style={{ background: 'rgba(0, 230, 118, 0.15)', color: 'var(--success)', padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700 }}>
                  Discount Approved
                </span>
              )}
              {quote.discount_request_status === 'rejected' && (
                <span style={{ background: 'rgba(255, 82, 82, 0.15)', color: 'var(--error)', padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700 }}>
                  Discount Request Declined
                </span>
              )}
              {quote.discount_request_status === 'counter_offer' && (
                <span style={{ background: 'rgba(0, 176, 255, 0.15)', color: 'var(--info)', padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700 }}>
                  Counter Offer Available
                </span>
              )}
            </div>
          </div>

          {/* 4-Step Negotiation Sub-Timeline */}
          <div style={{ margin: '16px 0 20px' }}>
            <StatusTracker
              steps={DISCOUNT_TIMELINE_STEPS}
              currentStep={discountCurrentStep}
              labels={getDiscountStepLabel}
              stepStates={discountStepStates}
            />
          </div>

          {/* Specific Message & Action Bar for Discount Request Outcome */}
          <div className="discount-request-message-box">
            {/* Outcome 1: Pending Governance Review */}
            {quote.discount_request_status === 'pending_approval' && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flex: 1, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                Your requested discount has been submitted to Clinch deal governance. High-risk requests are escalated to Finance, and approved quotes will be updated automatically.
              </div>
            )}

            {/* Outcome 2: Manager Approved */}
            {quote.discount_request_status === 'approved' && (
              <>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem', marginBottom: '2px' }}>
                    Discount Request Approved
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Your requested discount has been approved. Please review and confirm the updated quotation.
                  </div>
                </div>
                {!isConfirmed && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAcceptProposal}
                    disabled={accepting}
                    style={{ background: 'var(--accent)', color: '#ffffff', fontWeight: 700 }}
                  >
                    {accepting ? 'Processing...' : 'Confirm & Accept Updated Quotation'}
                  </button>
                )}
              </>
            )}

            {/* Outcome 3: Manager Rejected */}
            {quote.discount_request_status === 'rejected' && (
              <>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--error)', fontSize: '0.9rem', marginBottom: '2px' }}>
                    Discount Request Declined
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Your requested discount was not approved. The previous quotation remains available.
                  </div>
                </div>
                {!isConfirmed && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setCounterDiscount('');
                    }}
                  >
                    Propose Alternative Terms
                  </button>
                )}
              </>
            )}

            {/* Outcome 4: Counter Offer Available */}
            {quote.discount_request_status === 'counter_offer' && (
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--info)', fontSize: '0.95rem' }}>
                      Sales Manager has provided a counter offer.
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {quote.counter_notes || 'Sales Manager has proposed the following revised volume discount.'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Revised Offer Value</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {formatCurrency(counterTotal)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--info)', fontWeight: 700 }}>
                      {quote.counter_discount}% bulk discount
                    </div>
                  </div>
                </div>

                {!isConfirmed && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleAcceptCounterOffer}
                      disabled={actionLoading}
                      style={{ background: 'var(--accent)', color: '#ffffff', fontWeight: 700 }}
                    >
                      {actionLoading ? 'Applying...' : `Accept Counter Offer (${quote.counter_discount}%)`}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const el = document.getElementById('negotiate-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                       Continue Negotiation
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================
          LINE ITEMS TABLE & CUSTOMER FEEDBACK
          ======================================================= */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', margin: '24px 0' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* `quote.lines`, not `quote.items`.

              The customer payload has always been {lines: [{id, name, qty,
              unit_price, discount_pct, line_total}]}. This table asked for
              `items`, then for `quantity` and `product_name` inside each row,
              so it rendered ZERO rows on every quotation and the header
              confidently reported "(0)". The whole reason a customer opens this
              page -- to see what they are being quoted for -- was missing. */}
          <span>Quotation line items ({quote.lines?.length || 0})</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="line-items-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th style={{ textAlign: 'center' }}>Discount</th>
                <th style={{ textAlign: 'right' }}>Line Total</th>
                <th>Feedback / Customization</th>
              </tr>
            </thead>
            <tbody>
              {(quote.lines || []).map((item) => {
                // The server computes line_total, discounts included. Recomputing
                // it here was a second pricing rule that could disagree with the
                // engine's.
                const lineTotal = item.line_total;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="li-product-cell">
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.category}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {parseFloat(item.discount_pct) > 0 ? (
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.discount_pct}% off</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {formatCurrency(lineTotal)}
                    </td>
                    <td style={{ minWidth: '240px' }}>
                      {!isConfirmed ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Target Discount:
                            </span>
                            <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}>
                              <input
                                type="number"
                                min="0"
                                max="40"
                                step="1"
                                placeholder="0"
                                value={lineDiscounts[item.id] ?? ''}
                                onChange={(e) => setLineDiscounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                style={{ width: '40px', fontSize: '0.75rem', fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)' }}
                              />
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                            </div>
                          </div>
                          <textarea
                            className="comment-field"
                            placeholder="Add item feedback, required specs or packaging..."
                            value={lineComments[item.id] || ''}
                            onChange={(e) =>
                              setLineComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                          />
                        </div>
                      ) : (
                        <div>
                          {/* Per-line comments live in quote.comments keyed by
                              line_id, not on the line itself. */}
                          {(quote.comments || [])
                            .filter((c) => c.line_id === item.id && c.body)
                            .map((c, i) => (
                              <div key={i} className="comment-display">
                                <strong>{c.author}:</strong> {c.body}
                              </div>
                            ))}
                          {!(quote.comments || []).some((c) => c.line_id === item.id && c.body) && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No comments</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =======================================================
          COUNTER OFFER & DISCOUNT REQUEST FORM
          Customer can request a better discount or customization
          ======================================================= */}
      {/* Negotiation closed: the rep has sent the same terms twice.

          The form used to be offered regardless, so a customer could keep
          submitting an ask the server would refuse -- with no explanation on
          screen of why nothing was happening. */}
      {!isConfirmed && quote.negotiation_locked && (
        <div className="counter-offer-section">
          <h3>Final terms</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            {quote.lock_reason}
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAcceptProposal}
              disabled={accepting}
            >
              {accepting ? 'Processing…' : 'Confirm & place order'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/quotations')}
            >
              Cancel and go back
            </button>
          </div>
        </div>
      )}

      {!isConfirmed && !quote.negotiation_locked && (
        <form id="negotiate-section" onSubmit={handleNegotiate} className="counter-offer-section">
          <h3>Request Better Discount or Customization</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Request a revised volume discount or submit requirements for Sales Manager commercial evaluation.
          </p>
          <div className="counter-offer-inputs">
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                Requested Target Discount (%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                placeholder="e.g. 18"
                value={counterDiscount}
                onChange={(e) => setCounterDiscount(e.target.value)}
                style={{
                  width: '160px',
                  padding: '9px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <button type="submit" className="btn btn-secondary" disabled={submitting}>
              {submitting ? 'Submitting to Manager...' : 'Submit Discount Request & Comments'}
            </button>
          </div>
        </form>
      )}

      {/* =======================================================
          ACTION CTA BAR
          ======================================================= */}
      <div className="quotation-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '28px' }}>
        <Link to="/quotations" className="btn btn-ghost">
          Back to All Quotations
        </Link>

        {/* When manager approved or in negotiation: customer can accept and place order */}
        {(isManagerApproved || isInNegotiation) && !isConfirmed && (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleAcceptProposal}
            disabled={accepting}
            style={{ background: 'var(--accent)', color: '#ffffff', fontWeight: 700 }}
          >
            {accepting ? 'Processing Order...' : 'Accept Manager Approved Quote & Place Order'}
          </button>
        )}

        {/* When still waiting for initial manager approval */}
        {isPendingInitialApproval && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              background: 'rgba(255, 171, 0, 0.12)',
              color: 'var(--warning)',
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.88rem',
              fontWeight: 700,
              border: '1px solid rgba(255, 171, 0, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              Awaiting Sales Manager Approval
            </span>
          </div>
        )}

        {/* When order is already confirmed */}
        {isConfirmed && (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/account?tab=orders')}
          >
            Track Shipment in Orders
          </button>
        )}
      </div>
    </div>
  );
}
