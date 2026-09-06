import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from './shared';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();
  const [addedAnim, setAddedAnim] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const saved = isInWishlist(product.sku);

  const handleAdd = (e) => {
    e.stopPropagation();
    addToCart(product.sku, 1);
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 1200);
    showToast(`Added ${product.name} to cart!`, 'success');
  };

  const handleSave = (e) => {
    e.stopPropagation();
    if (saved) {
      removeFromWishlist(product.sku);
      showToast('Removed from saved items', 'info');
    } else {
      addToWishlist(product);
      showToast('Saved to wishlist!', 'success');
    }
  };

  const tierPrice = parseFloat(product.your_price || product.list_price || 0);
  const originalPrice = parseFloat(product.list_price || 0);
  const brand = (product.category || product.name?.split(' ')[0] || 'BRAND').toUpperCase();
  const saleBadge = product.is_promoted ? 'Featured' : null;

  return (
    <div 
      className="group relative flex flex-col rounded-[1.75rem] p-1.5 bg-[#edf0f4]/80 ring-1 ring-black/[.06] transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 hover:ring-[#0e7490]/30 cursor-pointer"
      style={{ boxShadow: '0 2px 4px rgba(13,27,42,0.03), 0 12px 28px -12px rgba(13,27,42,0.08)' }}
      onClick={() => navigate(`/shop/${product.sku}`)}
    >
      <div className="relative flex flex-col h-full w-full rounded-[calc(1.75rem-0.375rem)] bg-white overflow-hidden ring-1 ring-black/[.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
        {/* Top badges bar */}
        <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
          {saleBadge ? (
            <span className="pointer-events-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#0e7490] text-white shadow-sm ring-1 ring-white/20">
              {saleBadge}
            </span>
          ) : <span />}

          <button
            type="button"
            onClick={handleSave}
            className={`pointer-events-auto w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
              saved 
                ? 'bg-[#be123c] text-white shadow-sm scale-105' 
                : 'bg-white/90 text-[#46586b] hover:text-[#be123c] hover:bg-white shadow-sm hover:scale-105'
            }`}
            title={saved ? 'Remove from wishlist' : 'Save to wishlist'}
          >
            <Heart size={14} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Image container */}
        <div className="relative w-full pt-[75%] bg-[#f8fafc] overflow-hidden border-b border-[#0d1b2a]/[0.04]">
          {product.image && !imgFailed ? (
            <img
              src={product.image}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center px-4">
              <span className="text-[12.5px] font-semibold text-[#7b8ca0] text-center leading-snug line-clamp-3">
                {product.name}
              </span>
            </div>
          )}
        </div>

        {/* Details container */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            {/* Brand & Availability */}
            <div className="flex items-center justify-between text-[10.5px] mb-1.5 font-medium">
              <span className="font-mono tracking-wider uppercase text-[#7b8ca0] font-semibold">{brand}</span>
              <span className={`font-mono tracking-wide uppercase px-2 py-0.5 rounded-full text-[9.5px] font-semibold ${
                product.availability === 'in_stock' ? 'bg-[#047857]/10 text-[#047857]'
                  : product.availability === 'low_stock' ? 'bg-[#b45309]/10 text-[#b45309]'
                  : 'bg-[#46586b]/10 text-[#46586b]'
              }`}>
                {product.availability === 'in_stock' ? 'In stock'
                  : product.availability === 'low_stock' ? 'Low stock'
                  : 'Made to order'}
              </span>
            </div>

            {/* Pricing */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xl font-extrabold text-[#0d1b2a] tracking-tight">
                {formatCurrency(tierPrice)}
              </span>
              {originalPrice > tierPrice && (
                <span className="text-xs text-[#7b8ca0] line-through font-medium">
                  {formatCurrency(originalPrice)}
                </span>
              )}
            </div>

            {/* Product Title */}
            <h4 className="text-[13.5px] font-semibold text-[#0d1b2a] line-clamp-2 leading-snug group-hover:text-[#0e7490] transition-colors mb-4" title={product.name}>
              {product.name}
            </h4>
          </div>

          {/* Add to Cart button */}
          <div onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleAdd}
              className={`w-full py-2 pl-4 pr-2 rounded-full text-[12.5px] font-semibold flex items-center justify-between gap-2 shadow-sm transition-all duration-200 active:scale-[0.98] ${
                addedAnim 
                  ? 'bg-[#047857] text-white ring-1 ring-white/20' 
                  : 'bg-[#0d1b2a] text-white hover:bg-[#0e7490] hover:shadow-lift'
              }`}
            >
              <span className="font-medium tracking-tight">
                {addedAnim ? 'Added to Basket' : 'Add to Quotation'}
              </span>
              <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                {addedAnim ? <Check size={13} /> : <ShoppingBag size={13} />}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
