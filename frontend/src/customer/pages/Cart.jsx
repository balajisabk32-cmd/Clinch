import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, ArrowLeft, Send, CheckCircle2, ShieldAlert, Sparkles, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import CartItem from '../components/CartItem';
import { formatCurrency } from '../components/shared';

export default function Cart() {
  const { cartItems, cartSubtotal, loading, fetchCart, submitAsQuote, cartCount } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  
  // Per-product discount allotments: { [sku]: discountPct }
  const [lineDiscounts, setLineDiscounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('clinch_cart_discounts') || '{}');
    } catch {
      return {};
    }
  });
  const [askNote, setAskNote] = useState('');

  useEffect(() => { 
    fetchCart(); 
  }, [fetchCart]);

  const handleLineDiscountChange = (sku, pct) => {
    setLineDiscounts((prev) => {
      const next = {
        ...prev,
        [sku]: Number(pct || 0),
      };
      try {
        localStorage.setItem('clinch_cart_discounts', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Subtotal directly from server-computed cart
  const subtotal = cartSubtotal;

  // Compute total discount savings summed from each individual product allotment
  const totalDiscount = Math.round(
    cartItems.reduce((acc, item) => {
      const pct = Number(lineDiscounts[item.sku] || 0);
      const unit = parseFloat(item.your_price || item.list_price || 0);
      const qty = item.qty ?? item.quantity ?? 1;
      return acc + (unit * qty * (pct / 100));
    }, 0) * 100
  ) / 100;

  const estimatedTotal = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);
  const effectiveDiscountPct = subtotal > 0 ? Math.round((totalDiscount / subtotal) * 1000) / 10 : 0;

  // Filter items with active discount requests for summary breakdown
  const discountedItems = cartItems.filter((item) => Number(lineDiscounts[item.sku] || 0) > 0);

  const handleSubmitQuote = async () => {
    setSubmitting(true);
    try {
      // Build full line discounts map across all cart items
      const allDiscounts = {};
      cartItems.forEach((item) => {
        allDiscounts[item.sku] = Number(lineDiscounts[item.sku] || 0);
      });

      const result = await submitAsQuote(
        askNote.trim(),
        effectiveDiscountPct > 0 ? effectiveDiscountPct : null,
        allDiscounts
      );
      try {
        localStorage.removeItem('clinch_cart_discounts');
      } catch {}
      showToast(`Quotation ${result.ref ?? 'submitted'} with your product discount terms! Sent to your account manager.`, 'success', 5000);
      navigate('/quotations');
    } catch (err) {
      showToast(err?.message || 'Failed to submit quote', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#0e7490] border-t-transparent animate-spin" />
        <p className="text-sm text-[#7b8ca0]">Loading your enterprise cart...</p>
      </div>
    );
  }

  return (
    <div className="customer-page-container mx-auto max-w-[1240px] px-5 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-3">
        <Link to="/shop" className="hover:text-[#0d1b2a] transition-colors">Home</Link>
        <span>•</span>
        <span className="text-[#0d1b2a] font-medium">Cart</span>
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="font-['Syne',sans-serif] text-[2.4rem] font-extrabold text-[#0d1b2a] tracking-tight leading-tight">
          Enterprise Cart
        </h1>
        <p className="text-sm text-[#46586b] mt-1">
          {cartCount > 0
            ? `${cartCount} item${cartCount !== 1 ? 's' : ''} in your basket — configure discount allotments per product before submitting for deal governance review`
            : 'Your cart is empty'}
        </p>
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#0d1b2a]/[0.08] p-12 text-center max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#edf0f4] text-[#0d1b2a] flex items-center justify-center mx-auto mb-4">
            <ShoppingBag size={28} />
          </div>
          <h2 className="text-lg font-bold text-[#0d1b2a] mb-1">Your cart is empty</h2>
          <p className="text-sm text-[#7b8ca0] mb-6">
            Browse our hardware and software catalog to build your official quotation request.
          </p>
          <button
            type="button"
            className="w-full py-3 px-5 rounded-xl bg-[#0d1b2a] text-white font-semibold text-sm hover:bg-[#0e7490] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            onClick={() => navigate('/shop')}
          >
            <span>Browse Catalog</span>
            <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Cart Line Items Column */}
          <div className="lg:col-span-8">
            {/* Guidance banner for per-product discount allotment */}
            <div className="bg-[#f8fafc] border border-[#0d1b2a]/[0.08] rounded-2xl p-4 mb-5 shadow-xs flex items-start gap-3">
              <span className="p-2 rounded-xl bg-[#0e7490]/10 text-[#0e7490] shrink-0 mt-0.5">
                <Tag size={18} />
              </span>
              <div className="text-xs text-[#46586b] leading-relaxed">
                <div className="font-bold text-[#0d1b2a] text-[13px] mb-0.5">
                  Itemized Product Discount Allotment
                </div>
                <div>
                  Each product row below allows specifying custom target discounts. Different hardware and software categories carry distinct margin rules &mdash; your account manager evaluates each item individually.
                </div>
              </div>
            </div>

            {/* List of Cart Items */}
            <div>
              {cartItems.map((item) => (
                <CartItem
                  key={item.sku}
                  item={item}
                  discountPct={lineDiscounts[item.sku] || 0}
                  onDiscountChange={handleLineDiscountChange}
                />
              ))}
            </div>

            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-[#46586b] hover:text-[#0d1b2a] transition-colors"
              onClick={() => navigate('/shop')}
            >
              <ArrowLeft size={14} />
              <span>Continue browsing catalog</span>
            </button>
          </div>

          {/* Order Summary Column */}
          <div className="lg:col-span-4 sticky top-24">
            <div className="bg-white rounded-2xl border border-[#0d1b2a]/[0.08] p-6 shadow-sm">
              <h2 className="text-base font-bold text-[#0d1b2a] mb-5 pb-3 border-b border-[#0d1b2a]/[0.06]">
                Order Summary
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center text-[#46586b]">
                  <span>Subtotal ({cartCount} items)</span>
                  <span className="font-semibold text-[#0d1b2a]">{formatCurrency(subtotal)}</span>
                </div>

                {/* Itemized Discount Breakdown */}
                {discountedItems.length > 0 && (
                  <div className="py-2 border-y border-[#0d1b2a]/[0.06] my-2 space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#7b8ca0] mb-1">
                      Product Discount Requests:
                    </div>
                    {discountedItems.map((item) => {
                      const pct = lineDiscounts[item.sku];
                      const unit = parseFloat(item.your_price || item.list_price || 0);
                      const qty = item.qty ?? item.quantity ?? 1;
                      const savings = Math.round(unit * qty * (pct / 100) * 100) / 100;
                      return (
                        <div key={item.sku} className="flex justify-between items-center text-xs text-[#047857]">
                          <span className="truncate max-w-[170px]" title={item.name}>
                            {item.name} ({pct}%)
                          </span>
                          <span className="font-semibold">−{formatCurrency(savings)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {totalDiscount > 0 && (
                  <div className="flex justify-between items-center text-[#047857]">
                    <span className="font-medium">Total Discount Savings</span>
                    <span className="font-bold">
                      −{formatCurrency(totalDiscount)}{' '}
                      <span className="text-[11px] font-normal text-[#7b8ca0]">
                        ({effectiveDiscountPct}% avg)
                      </span>
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-[#0d1b2a]/[0.08] flex justify-between items-baseline">
                  <span className="font-bold text-[#0d1b2a]">Estimated Total</span>
                  <span className="text-2xl font-extrabold text-[#0d1b2a]">
                    {formatCurrency(estimatedTotal)}
                  </span>
                </div>
              </div>

              {totalDiscount > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-[#dcf3ea] border border-[#047857]/20 flex items-start gap-2 text-xs font-medium text-[#047857]">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>
                    Proposed item savings: {formatCurrency(totalDiscount)}. Subject to account manager & governance review.
                  </span>
                </div>
              )}

              {/* Rep notes input */}
              <div className="mt-5">
                <label htmlFor="ask-note" className="block text-xs font-semibold text-[#0d1b2a] mb-1.5">
                  Anything your rep should know (optional)
                </label>
                <textarea
                  id="ask-note"
                  rows={2}
                  value={askNote}
                  onChange={(e) => setAskNote(e.target.value)}
                  placeholder="Repeat order, procurement timeline, multi-year commitment..."
                  className="w-full rounded-xl border border-[#0d1b2a]/[0.1] bg-white px-3 py-2 text-xs text-[#0d1b2a] outline-none focus:border-[#0e7490] resize-y placeholder:text-[#7b8ca0]"
                />
              </div>

              <div className="mt-4 flex items-start gap-2 text-[11px] text-[#7b8ca0] leading-relaxed">
                <ShieldAlert size={14} className="shrink-0 text-[#b45309] mt-0.5" />
                <span>Submitted quotes undergo automated deal health scoring and policy verification.</span>
              </div>

              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  className="w-full py-3 px-5 rounded-xl bg-[#0d1b2a] text-white font-semibold text-sm hover:bg-[#0e7490] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  onClick={handleSubmitQuote}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Submitting to Deal Engine...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Submit Quote Request</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl border border-[#0d1b2a]/[0.1] bg-white text-[#0d1b2a] font-semibold text-xs hover:bg-[#edf0f4] active:scale-[0.98] transition-all"
                  onClick={() => navigate('/shop')}
                >
                  ← Back to Catalog
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
