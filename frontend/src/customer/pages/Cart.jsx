import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, ArrowLeft, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import CartItem from '../components/CartItem';
import { formatCurrency } from '../components/shared';

export default function Cart() {
  const { cartItems, loading, fetchCart, submitAsQuote, cartCount } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { 
    fetchCart(); 
  }, [fetchCart]);

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
      showToast(`Quotation ${result.quote_number} submitted! Your sales rep will review it shortly.`, 'success', 5000);
      navigate('/quotations');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit quote', 'error');
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
    <div className="mx-auto max-w-[1240px] px-5 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-3">
        <Link to="/shop" className="hover:text-[#0d1b2a] transition-colors">Home</Link>
        <span>•</span>
        <span className="text-[#0d1b2a] font-medium">Cart</span>
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-['Syne',sans-serif] text-[2.4rem] font-extrabold text-[#0d1b2a] tracking-tight leading-tight">
          Enterprise Cart
        </h1>
        <p className="text-sm text-[#46586b] mt-1">
          {cartCount > 0
            ? `${cartCount} item${cartCount !== 1 ? 's' : ''} in your basket — suggest discounts and submit for deal governance review`
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
          {/* Cart Line Items */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-[#0d1b2a]/[0.08] rounded-2xl p-4 mb-5 flex items-start gap-3 text-xs text-[#46586b] shadow-sm">
              <span className="font-bold text-white bg-[#0e7490] px-2.5 py-0.5 rounded-full text-[10px] shrink-0 uppercase tracking-wider shadow-sm">
                Dealflow Guidance
              </span>
              <span>
                You can propose a customized discount % per product. Your dedicated Sales Rep and Sales Manager will evaluate special tier pricing.
              </span>
            </div>

            <div>
              {cartItems.map((item) => (
                <CartItem key={item.id} item={item} />
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

                {totalDiscount > 0 && (
                  <div className="flex justify-between items-center text-[#047857]">
                    <span>Proposed Discount</span>
                    <span className="font-semibold">−{formatCurrency(totalDiscount)}</span>
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
                <div className="mt-4 p-3 rounded-xl bg-[#dcf3ea] border border-[#047857]/20 flex items-center gap-2 text-xs font-medium text-[#047857]">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>Proposed savings: {formatCurrency(totalDiscount)}. Subject to sales manager approval.</span>
                </div>
              )}

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
                      <span>Submit as Quote Request</span>
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
