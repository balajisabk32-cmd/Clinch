import { useState } from 'react';
import { Minus, Plus, Trash2, Tag } from 'lucide-react';
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
    <div className="bg-white rounded-2xl border border-[#0d1b2a]/[0.08] p-5 mb-4 shadow-sm hover:border-[#0e7490]/30 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-5">
      {/* Product Image */}
      <img
        className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl bg-[#f8fafc] border border-[#0d1b2a]/[0.06] shrink-0"
        src={item.image_url}
        alt={item.name}
        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600'; }}
      />

      {/* Details & Controls */}
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-white bg-[#0e7490] px-2.5 py-0.5 rounded-full inline-block mb-1 shadow-sm">
          {item.category}
        </span>
        <h3 className="text-base font-bold text-[#0d1b2a] truncate mb-1">
          {item.name}
        </h3>
        {item.variant_value && (
          <p className="text-xs text-[#7b8ca0] mb-3">
            {item.variant_type}: {item.variant_value}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-2">
          {/* Quantity Stepper */}
          <div className="inline-flex items-center rounded-lg border border-[#0d1b2a]/[0.1] bg-white p-0.5">
            <button
              type="button"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4] transition-colors"
              onClick={() => handleQtyChange(-1)}
            >
              <Minus size={13} />
            </button>
            <span className="w-8 text-center text-xs font-bold text-[#0d1b2a]">{qty}</span>
            <button
              type="button"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4] transition-colors"
              onClick={() => handleQtyChange(1)}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Suggest Discount */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#0d1b2a]/[0.1] text-xs text-[#46586b]">
            <Tag size={12} className="text-[#0e7490]" />
            <span className="font-medium">Suggest Discount:</span>
            <input
              className="w-12 px-1.5 py-0.5 rounded border border-[#0d1b2a]/[0.15] bg-[#f8fafc] text-center font-bold text-[#0d1b2a] text-xs focus:outline-none focus:ring-1 focus:ring-[#0e7490]"
              type="number"
              min="0"
              max="50"
              step="1"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              onBlur={handleDiscountBlur}
            />
            <span className="font-semibold">%</span>
          </div>

          {/* Remove Button */}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-[#7b8ca0] hover:text-[#be123c] font-medium transition-colors ml-auto sm:ml-0"
            onClick={() => removeFromCart(item.id)}
          >
            <Trash2 size={13} />
            <span>Remove</span>
          </button>
        </div>
      </div>

      {/* Pricing Column */}
      <div className="text-left sm:text-right shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
        <div className="text-lg font-extrabold text-[#0d1b2a]">
          {formatCurrency(lineTotal)}
        </div>
        <div className="text-xs text-[#7b8ca0]">
          {qty} × {formatCurrency(unitPrice)}
        </div>
        {discount > 0 && (
          <div className="text-xs font-semibold text-[#047857] mt-0.5">
            −{discount}% proposed discount
          </div>
        )}
      </div>
    </div>
  );
}
