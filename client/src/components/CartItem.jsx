import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { formatCurrency } from './shared';

export default function CartItem({ item }) {
  const { updateCartItem, removeFromCart } = useCart();
  const [discount, setDiscount] = useState(parseFloat(item.suggested_discount) || 0);
  const [qty, setQty] = useState(item.quantity);

  const handleQtyChange = async (delta) => {
    const newQty = Math.max(1, qty + delta);
    setQty(newQty);
    await updateCartItem(item.id, { quantity: newQty });
  };

  const handleDiscountBlur = async () => {
    const val = Math.min(50, Math.max(0, discount));
    setDiscount(val);
    await updateCartItem(item.id, { suggested_discount: val });
  };

  const unitPrice = parseFloat(item.unit_price || item.base_price);
  const lineTotal = unitPrice * qty * (1 - discount / 100);

  return (
    <div className="cart-item">
      <img
        className="cart-item-img"
        src={item.image_url}
        alt={item.name}
        onError={(e) => { e.target.src = 'https://placehold.co/90x90/2d2d2d/666?text=Img'; }}
      />

      <div>
        <div className="cart-item-cat">{item.category}</div>
        <div className="cart-item-name">{item.name}</div>
        {item.variant_value && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            {item.variant_type}: {item.variant_value}
          </div>
        )}
        <div className="cart-item-controls">
          <div className="qty-selector">
            <button className="qty-btn" onClick={() => handleQtyChange(-1)}>−</button>
            <span className="qty-value">{qty}</span>
            <button className="qty-btn" onClick={() => handleQtyChange(1)}>+</button>
          </div>

          <div className="discount-input-wrap">
            <span>💬 Suggest Discount:</span>
            <input
              className="input"
              type="number"
              min="0" max="50" step="0.5"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              onBlur={handleDiscountBlur}
            />
            <span>%</span>
          </div>

          <button
            className="btn btn-danger btn-sm"
            onClick={() => removeFromCart(item.id)}
          >
            🗑 Remove
          </button>
        </div>
      </div>

      <div>
        <div className="cart-item-price">{formatCurrency(lineTotal)}</div>
        <div className="cart-item-line-total">{qty} × {formatCurrency(unitPrice)}</div>
        {discount > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', textAlign: 'right' }}>
            −{discount}% proposed
          </div>
        )}
      </div>
    </div>
  );
}
