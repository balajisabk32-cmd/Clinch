import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { StatusBadge, formatCurrency } from '../components/shared';
import StatusTracker from '../components/StatusTracker';
import { useToast } from '../context/ToastContext';

const ORDER_STEPS = ['pending_approval', 'processing', 'warehouse_assigned', 'shipped', 'delivered'];
const ORDER_STEP_LABELS = {
  pending_approval: 'Manager Approval',
  processing: 'Processing',
  warehouse_assigned: 'Warehouse Prep',
  shipped: 'Shipped',
  delivered: 'Delivered',
};
const ORDER_STEP_ICONS = {
  pending_approval: '',
  processing: '',
  warehouse_assigned: '',
  shipped: '',
  delivered: '',
};

export default function OrderTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      // Orders in the customer portal are tracked via the quote that generated them.
      // /orders/{id} has no storefront endpoint — use /shop/quotes/{ref} instead.
      const res = await api.get(`/shop/quotes/${id}`);
      const raw = res.data;
      if (!raw || raw.detail) {
        showToast('Order not found', 'error');
        return;
      }
      // Normalize to what the template expects
      setOrder({
        ...raw,
        status: raw.state,
        total_amount: raw.total,
        order_number: raw.ref,
        items: raw.lines ?? [],
      });
    } catch (err) {
      showToast('Failed to load order tracking details', 'error');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading shipment tracking...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <h2>Order not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/account?tab=orders')} style={{ marginTop: '16px' }}>
          Back to Orders
        </button>
      </div>
    );
  }

  let warehouseData = [];
  try {
    warehouseData = typeof order.warehouse_info === 'string'
      ? JSON.parse(order.warehouse_info)
      : (order.warehouse_info || []);
  } catch {
    warehouseData = [];
  }

  const stepIndex = order.current_step !== undefined && order.current_step >= 0
    ? order.current_step
    : ORDER_STEPS.indexOf(order.status) >= 0 ? ORDER_STEPS.indexOf(order.status) : 0;

  return (
    <div className="container tracking-page" style={{ paddingBottom: '80px' }}>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-3">
        <Link to="/shop" className="hover:text-[#0d1b2a] transition-colors">Home</Link>
        <span>•</span>
        <Link to="/account?tab=orders" className="hover:text-[#0d1b2a] transition-colors">Orders</Link>
        <span>•</span>
        <span className="font-mono text-[#0d1b2a] font-semibold">{order.order_number}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 className="font-['Syne',sans-serif] text-[1.8rem] font-extrabold text-[#0d1b2a] m-0">
              {order.order_number}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {order.quote_number && ` • From Quote #${order.quote_number}`}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
            {formatCurrency(order.total_amount)}
          </div>
        </div>
      </div>

      {/* Pending Manager Approval Alert Banner */}
      {order.status === 'pending_approval' && (
        <div style={{
          background: 'rgba(255, 171, 0, 0.08)',
          border: '1px solid rgba(255, 171, 0, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 22px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
 <span style={{ fontSize: '2.2rem' }}></span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: '1rem' }}>
                Order Pending Sales Manager Approval
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                This purchase order includes custom volume pricing with an 18% special discount. It is currently on commercial hold waiting for executive sign-off from the Regional Sales Director before routing to warehouse dispatch.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated Live Status Tracker */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '28px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Fulfillment Timeline</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>● Live Status</span>
        </div>
        <StatusTracker
          steps={ORDER_STEPS}
          currentStep={stepIndex}
          labels={ORDER_STEP_LABELS}
          icons={ORDER_STEP_ICONS}
        />
      </div>

      {/* Logistics & Delivery Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Estimated Delivery Card */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Estimated Delivery</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {order.estimated_delivery
              ? new Date(order.estimated_delivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              : 'Within 5-7 business days'}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Standard commercial freight courier dispatch. Signature required upon receiving.
          </p>
        </div>

        {/* Assigned Warehouse */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Origin Hub</div>
          {warehouseData.length > 0 ? (
            warehouseData.map((wh, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
 <span style={{ fontSize: '1.4rem' }}></span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{wh.warehouse}</div>
                  <span className="warehouse-code">{wh.code}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
 <span style={{ fontSize: '1.4rem' }}></span>
              <div>
                <div style={{ fontWeight: 600 }}>Central Logistics Depot</div>
                <span className="warehouse-code">IND-MUM-HUB1</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items in this Order */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '28px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Order Items ({order.items?.length || 0})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(order.items || []).map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'var(--bg-hover)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.product_name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
                ) : (
 <div style={{ width: 44, height: 44, background: 'var(--bg-card)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}></div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.product_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantity: {item.quantity}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {formatCurrency(item.unit_price * item.quantity * (1 - parseFloat(item.discount_pct || 0) / 100))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Back and Navigation Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/account?tab=orders')}>
          ← Back to Orders
        </button>
        <Link to={`/quotations/${order.quotation_id}`} className="btn btn-secondary">
          View Original Quotation
        </Link>
      </div>
    </div>
  );
}
