import { useNavigate } from 'react-router-dom';
import { StatusBadge, formatCurrency, timeAgo } from './shared';

export default function QuotationCard({ quotation }) {
  const navigate = useNavigate();

  return (
    <div className="quotation-card" onClick={() => navigate(`/quotations/${quotation.id}`)}>
      <div>
        <div className="quotation-number">📋 {quotation.quote_number}</div>
        <div className="quotation-date">{new Date(quotation.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        <div className="quotation-items-count">{quotation.item_count} item{quotation.item_count !== 1 ? 's' : ''}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
        <StatusBadge status={quotation.status} />
        {quotation.discount_request_status === 'pending_approval' && (
          <span style={{ fontSize: '0.72rem', background: 'rgba(255, 171, 0, 0.12)', color: 'var(--warning)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
            🟡 Discount in review ({quotation.requested_discount}%)
          </span>
        )}
        {quotation.discount_request_status === 'counter_offer' && (
          <span style={{ fontSize: '0.72rem', background: 'rgba(0, 176, 255, 0.12)', color: 'var(--info)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
            🔵 Counter offer ({quotation.counter_discount}%)
          </span>
        )}
      </div>

      <div>
        <div className="quotation-amount">{formatCurrency(quotation.total_amount)}</div>
        {parseFloat(quotation.discount_applied) > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', textAlign: 'right' }}>
            {quotation.discount_applied}% discount
          </div>
        )}
      </div>

      <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>›</div>
    </div>
  );
}
