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
  const [counterDiscount, setCounterDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/quotations/${id}`);
      setQuote(res.data);
      const initialComments = {};
      (res.data.items || []).forEach((item) => {
        initialComments[item.id] = item.customer_comment || '';
      });
      setLineComments(initialComments);
      if (res.data.requested_discount || res.data.discount_applied) {
        setCounterDiscount(res.data.requested_discount || res.data.discount_applied);
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

    switch (quote.status) {
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

  // Submit discount request / counter-offer to manager
  const handleNegotiate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const commentsPayload = Object.entries(lineComments).map(([item_id, comment]) => ({
        item_id: parseInt(item_id),
        comment,
      }));

      await api.put(`/quotations/${id}/negotiate`, {
        counter_discount: counterDiscount ? parseFloat(counterDiscount) : undefined,
        line_comments: commentsPayload,
      });

      showToast('Discount request submitted for Sales Manager review!', 'success');
      await fetchQuote();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit negotiation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Customer accepts the quotation & generates official order
  const handleAcceptProposal = async () => {
    if (!window.confirm('Confirm and accept this quotation to generate your purchase order?')) return;
    try {
      setAccepting(true);
      const res = await api.put(`/quotations/${id}/confirm`);
      showToast(res.data.message || 'Quotation accepted! Order created.', 'success');
      if (res.data.order) {
        navigate(`/orders/${res.data.order.id}`);
      } else {
        await fetchQuote();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to process order', 'error');
    } finally {
      setAccepting(false);
    }
  };

  // Customer accepts manager's counter-offer
  const handleAcceptCounterOffer = async () => {
    try {
      setActionLoading(true);
      const res = await api.put(`/quotations/${id}/accept-counter`);
      showToast(res.data.message || 'Counter offer accepted!', 'success');
      await fetchQuote();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to accept counter offer', 'error');
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

  // Calculate simulated counter-offer price
  const baseItemsTotal = (quote.items || []).reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0);
  const counterTotal = quote.counter_discount
    ? baseItemsTotal * (1 - Number(quote.counter_discount) / 100)
    : quote.total_amount;

  return (
    <div className="container quotation-detail" style={{ paddingBottom: '80px' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <Link to="/quotations" style={{ color: 'var(--text-muted)' }}>Quotations</Link>
        {' › '}
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{quote.quote_number}</span>
      </div>

      {/* Header */}
      <div className="quotation-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{quote.quote_number}</h1>
            <StatusBadge status={quote.status} />
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Generated on {new Date(quote.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            {quote.updated_at && ` • Updated on ${new Date(quote.updated_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Total Amount</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)' }}>
            {formatCurrency(quote.total_amount)}
          </div>
          {parseFloat(quote.discount_applied) > 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>
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
                <span>💬 Discount Request</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 4 }}>
                  Requested Discount: {quote.requested_discount || counterDiscount}%
                </span>
              </div>
            </div>

            <div>
              {quote.discount_request_status === 'pending_approval' && (
                <span style={{ background: 'rgba(255, 171, 0, 0.15)', color: 'var(--warning)', padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700 }}>
                  🟡 Pending Deal Governance Review
                </span>
              )}
              {quote.discount_request_status === 'approved' && (
                <span style={{ background: 'rgba(0, 230, 118, 0.15)', color: 'var(--success)', padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700 }}>
                  🟢 Discount Approved
                </span>
              )}
              {quote.discount_request_status === 'rejected' && (
                <span style={{ background: 'rgba(255, 82, 82, 0.15)', color: 'var(--error)', padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700 }}>
                  🔴 Discount Request Declined
                </span>
              )}
              {quote.discount_request_status === 'counter_offer' && (
                <span style={{ background: 'rgba(0, 176, 255, 0.15)', color: 'var(--info)', padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700 }}>
                  🔵 Counter Offer Available
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
                    {accepting ? 'Processing...' : '✓ Confirm & Accept Updated Quotation'}
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
                      {actionLoading ? 'Applying...' : `✓ Accept Counter Offer (${quote.counter_discount}%)`}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const el = document.getElementById('negotiate-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      💬 Continue Negotiation
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
          <span>Quotation Line Items ({quote.items?.length || 0})</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All specifications ISV-certified</span>
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
              {(quote.items || []).map((item) => {
                const effectiveUnit = item.unit_price * (1 - (parseFloat(item.discount_pct || 0) / 100));
                const lineTotal = effectiveUnit * item.quantity;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="li-product-cell">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.product_name} className="li-product-img" />
                        ) : (
                          <div className="li-product-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.category}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
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
                    <td style={{ minWidth: '220px' }}>
                      {!isConfirmed ? (
                        <textarea
                          className="comment-field"
                          placeholder="Add comment, required specs or packaging requirements..."
                          value={lineComments[item.id] || ''}
                          onChange={(e) =>
                            setLineComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                        />
                      ) : (
                        <div>
                          {item.customer_comment && (
                            <div className="comment-display">
                              <strong>You:</strong> {item.customer_comment}
                            </div>
                          )}
                          {item.rep_comment && (
                            <div className="comment-display" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                              <strong>Sales Manager:</strong> {item.rep_comment}
                            </div>
                          )}
                          {!item.customer_comment && !item.rep_comment && (
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
      {!isConfirmed && (
        <form id="negotiate-section" onSubmit={handleNegotiate} className="counter-offer-section">
          <h3>💬 Request Better Discount / Customization</h3>
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
          ← Back to All Quotations
        </Link>

        {/* When manager approved or in negotiation: customer can accept and place order */}
        {(isManagerApproved || isInNegotiation) && !isConfirmed && (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleAcceptProposal}
            disabled={accepting}
            style={{ background: 'var(--accent)', color: '#ffffff', fontWeight: 700 }}
          >
            {accepting ? 'Processing Order...' : '✓ Accept Manager Approved Quote & Place Order'}
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
              ⏳ Awaiting Sales Manager Approval
            </span>
          </div>
        )}

        {/* When order is already confirmed */}
        {isConfirmed && (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/account?tab=orders')}
          >
            📦 Track Shipment in Orders →
          </button>
        )}
      </div>
    </div>
  );
}
