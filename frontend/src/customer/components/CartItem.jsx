import { useState } from 'react';
import { Minus, Plus, Trash2, Tag, Percent } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatCurrency } from './shared';

const PRESET_DISCOUNTS = [0, 5, 10, 15, 20];

export default function CartItem({ item, discountPct = 0, onDiscountChange }) {
  const { updateCartItem, removeFromCart } = useCart();
  const [qty, setQty] = useState(item.qty ?? item.quantity ?? 1);
  const [imgFailed, setImgFailed] = useState(false);

  const handleQtyChange = async (delta) => {
    const newQty = Math.max(1, qty + delta);
    setQty(newQty);
    await updateCartItem(item.sku, newQty);
  };

  const handleDiscountInput = (val) => {
    if (val === '') {
      if (onDiscountChange) onDiscountChange(item.sku, 0);
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(40, num));
      if (onDiscountChange) onDiscountChange(item.sku, clamped);
    }
  };

  const unitPrice = parseFloat(item.your_price || item.list_price || 0);
  const lineTotal = unitPrice * qty;
  const currentDiscount = Number(discountPct || 0);
  const lineSavings = Math.round(lineTotal * (currentDiscount / 100) * 100) / 100;
  const netLineTotal = Math.round((lineTotal - lineSavings) * 100) / 100;

  return (
    <div className="bg-white rounded-2xl border border-[#0d1b2a]/[0.08] p-5 mb-4 shadow-sm hover:border-[#0e7490]/30 transition-all flex flex-col gap-4">
      {/* Top row: Image, Product Details, Qty, Price */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Product Image */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[#f8fafc] border border-[#0d1b2a]/[0.06] shrink-0 overflow-hidden grid place-items-center">
          {item.image && !imgFailed ? (
            <img
              className="w-full h-full object-contain p-2"
              src={item.image}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="px-1.5 text-[10px] font-semibold text-[#7b8ca0] text-center leading-tight line-clamp-3">
              {item.name}
            </span>
          )}
        </div>

        {/* Details & Controls */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-white bg-[#0e7490] px-2.5 py-0.5 rounded-full inline-block shadow-sm">
              {item.category}
            </span>
            <span className="text-[11px] font-mono text-[#7b8ca0]">{item.sku}</span>
          </div>

          <h3 className="text-base font-bold text-[#0d1b2a] truncate mb-1">
            {item.name}
          </h3>

          {item.variant_value && (
            <p className="text-xs text-[#7b8ca0] mb-2">
              {item.variant_type}: {item.variant_value}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-2">
            {/* Quantity Stepper */}
            <div className="inline-flex items-center rounded-lg border border-[#0d1b2a]/[0.1] bg-white p-0.5">
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4] transition-colors"
                onClick={() => handleQtyChange(-1)}
                aria-label="Decrease quantity"
              >
                <Minus size={13} />
              </button>
              <span className="w-8 text-center text-xs font-bold text-[#0d1b2a]">{qty}</span>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4] transition-colors"
                onClick={() => handleQtyChange(1)}
                aria-label="Increase quantity"
              >
                <Plus size={13} />
              </button>
            </div>

            {/* Remove Button */}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-[#7b8ca0] hover:text-[#be123c] font-medium transition-colors ml-auto sm:ml-0"
              onClick={() => removeFromCart(item.sku)}
            >
              <Trash2 size={13} />
              <span>Remove</span>
            </button>
          </div>
        </div>

        {/* Pricing Column */}
        <div className="text-left sm:text-right shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
          <div className="text-lg font-extrabold text-[#0d1b2a]">
            {formatCurrency(currentDiscount > 0 ? netLineTotal : lineTotal)}
          </div>
          {currentDiscount > 0 ? (
            <div className="flex sm:flex-col items-baseline sm:items-end gap-1.5 text-xs">
              <span className="text-[#7b8ca0] line-through">{formatCurrency(lineTotal)}</span>
              <span className="text-[#047857] font-semibold">
                −{formatCurrency(lineSavings)} ({currentDiscount}%)
              </span>
            </div>
          ) : (
            <div className="text-xs text-[#7b8ca0]">
              {qty} × {formatCurrency(unitPrice)}
            </div>
          )}
        </div>
      </div>

      {/* Product-Level Discount Allotment Row */}
      <div className="pt-3 border-t border-[#0d1b2a]/[0.06] bg-[#f8fafc]/70 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0d1b2a]">
            <Percent size={13} className="text-[#0e7490]" />
            <span>Product Discount Allotment:</span>
          </span>
          <span className="text-[11px] text-[#7b8ca0]">
            (Request specific discount for {item.name})
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Buttons */}
          <div className="inline-flex items-center gap-1">
            {PRESET_DISCOUNTS.map((pct) => (
              <button
                key={pct}
                type="button"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  currentDiscount === pct
                    ? 'bg-[#0e7490] text-white shadow-xs'
                    : 'bg-white border border-[#0d1b2a]/[0.1] text-[#46586b] hover:bg-[#edf0f4]'
                }`}
                onClick={() => onDiscountChange && onDiscountChange(item.sku, pct)}
              >
                {pct === 0 ? '0%' : `${pct}%`}
              </button>
            ))}
          </div>

          {/* Custom % input */}
          <div className="inline-flex items-center gap-1 bg-white border border-[#0d1b2a]/[0.12] rounded-md px-2 py-0.5 shadow-xs focus-within:border-[#0e7490]">
            <span className="text-[10px] font-bold text-[#7b8ca0] uppercase">Custom</span>
            <input
              type="number"
              min={0}
              max={40}
              step={1}
              value={currentDiscount}
              onChange={(e) => handleDiscountInput(e.target.value)}
              className="w-10 text-center text-xs font-bold text-[#0d1b2a] outline-none"
              aria-label={`Custom discount percent for ${item.name}`}
            />
            <span className="text-xs font-bold text-[#7b8ca0]">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
