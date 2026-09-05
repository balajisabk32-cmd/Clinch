import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import CartItem from '../components/CartItem';
import { formatCurrency } from '../components/shared';

export default function Cart() {
  const { cartItems, loading, fetchCart, submitAsQuote, cartCount } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchCart(); }, []);

  const subtotal = cartItems.reduce((sum, item) => {
    return sum + parseFloat(item.unit_price || item.base_price) * item.quantity;
  }, 0);

  const totalDiscount = cartItems.reduce((sum, item) => {
    const price = parseFloat(item.unit_price || item.base_price) * item.quantity;
    const disc = parseFloat(item.suggested_discount || 0) / 100;
    return sum + price * disc;
  }, 0);

  const estimatedTotal = subtotal - totalDiscount;

  const handleSubmitQuote = async () => {
    setSubmitting(true);
    try {
      const result = await submitAsQuote();
      showToast(`🎉 Quote ${result.quote_number} submitted! Your sales rep will review it shortly.`, 'success', 5000);
      navigate('/quotations');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit quote', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner"></div></div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">🛒 My Cart</h1>
        <p className="page-subtitle">
          {cartCount > 0
            ? `${cartCount} item${cartCount !== 1 ? 's' : ''} — suggest discounts and submit as a quote`
            : 'Your cart is empty'}
        </p>
      </div>

      {cartItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Add products from the shop to start building your quote request</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/shop')}>
            🛍️ Browse Products
          </button>
        </div>
      ) : (
        <div className="cart-layout">
          {/* Cart Items */}
          <div>
            <div style={{
              background: 'var(--info-bg)',
              border: '1px solid var(--info)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              display: 'flex',
              gap: 10,
            }}>
              💡 <span>You can suggest a discount % per line item. Your sales rep will review and respond to your quote.</span>
            </div>
            {cartItems.map((item) => (
              <CartItem key={item.id} item={item} />
            ))}
          </div>

          {/* Summary */}
          <div className="cart-summary">
            <div className="cart-summary-title">Order Summary</div>

            <div className="cart-summary-row">
              <span>Subtotal ({cartCount} items)</span>
              <span className="amount">{formatCurrency(subtotal)}</span>
            </div>

            {totalDiscount > 0 && (
              <div className="cart-summary-row">
                <span>Proposed Discount</span>
                <span className="savings">−{formatCurrency(totalDiscount)}</span>
              </div>
            )}

            <div className="cart-summary-row total">
              <span>Estimated Total</span>
              <span className="amount">{formatCurrency(estimatedTotal)}</span>
            </div>

            {totalDiscount > 0 && (
              <div style={{
                background: 'var(--success-bg)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.82rem',
                color: 'var(--success)',
                margin: '14px 0',
              }}>
                ✅ You proposed saving {formatCurrency(totalDiscount)}. Your rep will confirm the final discount.
              </div>
            )}

            <div className="divider" />

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              ⚠️ Final prices are subject to rep approval. You'll receive a notification once reviewed.
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleSubmitQuote}
              disabled={submitting}
            >
              {submitting ? '⏳ Submitting...' : '📤 Submit as Quote Request'}
            </button>

            <button
              className="btn btn-secondary btn-full btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => navigate('/shop')}
            >
              ← Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
