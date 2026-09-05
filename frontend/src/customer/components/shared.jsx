export function StarRating({ rating, reviewCount }) {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);
  return (
    <div className="product-card-rating">
      <div className="stars">
        {stars.map((s) => (
          <span key={s} className={`star ${s <= Math.round(rating) ? '' : 'empty'}`}>★</span>
        ))}
      </div>
      {reviewCount !== undefined && (
        <span className="rating-count">({reviewCount})</span>
      )}
    </div>
  );
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount || 0);
}

export function TierBadge({ tier }) {
  return <span className={`badge badge-${tier}`}>🏷️ {tier}</span>;
}

export function StatusBadge({ status }) {
  const labels = {
    pending_approval: 'Awaiting Manager Approval',
    re_entering_approval: 'Awaiting Manager Approval',
    pending_review: 'Under Review',
    sent: 'Manager Approved',
    under_negotiation: 'In Negotiation',
    confirmed: 'Confirmed',
    fulfillment: 'In Fulfillment',
    processing: 'Processing',
    warehouse_assigned: 'Warehouse Prep',
    shipped: 'Shipped',
    delivered: 'Delivered',
  };
  return (
    <span className={`status-badge status-${status}`}>
      {labels[status] || status}
    </span>
  );
}

export function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
