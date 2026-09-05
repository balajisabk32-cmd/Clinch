import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star, ShoppingBag, Check } from 'lucide-react';
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

  const saved = isInWishlist(product.id);

  const handleAdd = (e) => {
    e.stopPropagation();
    addToCart(product.id, null, 1);
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 1200);
    showToast(`Added ${product.name} to cart!`, 'success');
  };

  const handleSave = (e) => {
    e.stopPropagation();
    if (saved) {
      removeFromWishlist(product.id);
      showToast('Removed from saved items', 'info');
    } else {
      addToWishlist(product.id);
      showToast('Saved to wishlist!', 'success');
    }
  };

  const tierPrice = parseFloat(product.tier_price || product.base_price);
  const originalPrice = parseFloat(product.original_price || product.base_price * 1.15);
  const brand = (product.brand || product.name.split(' ')[0]).toUpperCase();
  const saleBadge = product.sale_badge || (product.tier === 'gold' ? 'Gold 15%' : 'Sale 10%');

  return (
    <div 
      className="group relative flex flex-col bg-white rounded-2xl border border-[#0d1b2a]/[0.08] overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-[#0e7490]/40 cursor-pointer"
      style={{ boxShadow: '0 1px 3px rgba(13,27,42,0.04), 0 8px 24px -8px rgba(13,27,42,0.06)' }}
      onClick={() => navigate(`/shop/${product.id}`)}
    >
      {/* Top badges bar */}
      <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
        {saleBadge ? (
          <span className="pointer-events-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#0e7490] text-white shadow-sm">
            {saleBadge}
          </span>
        ) : <span />}

        <button
          type="button"
          onClick={handleSave}
          className={`pointer-events-auto w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
            saved 
              ? 'bg-[#be123c] text-white shadow-sm' 
              : 'bg-white/85 text-[#46586b] hover:text-[#be123c] hover:bg-white shadow-sm'
          }`}
          title={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Image container */}
      <div className="relative w-full pt-[75%] bg-[#f8fafc] overflow-hidden">
        <img
          src={product.image_url}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600';
          }}
        />
      </div>

      {/* Details container */}
      <div className="flex-1 p-5 flex flex-col justify-between">
        <div>
          {/* Brand & Rating */}
          <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
            <span className="font-mono tracking-wider uppercase text-[#7b8ca0]">{brand}</span>
            <div className="flex items-center gap-1 text-[#f59e0b]">
              <Star size={13} fill="currentColor" />
              <span className="font-semibold text-[#0d1b2a]">{product.rating ? parseFloat(product.rating).toFixed(1) : '4.9'}</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-extrabold text-[#0d1b2a]">
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
            className={`w-full py-2.5 px-4 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-2 transition-all ${
              addedAnim 
                ? 'bg-[#047857] text-white' 
                : 'bg-[#0d1b2a] text-white hover:bg-[#0e7490] active:scale-[0.98]'
            }`}
          >
            {addedAnim ? (
              <>
                <Check size={15} />
                <span>Added to Basket</span>
              </>
            ) : (
              <>
                <ShoppingBag size={14} />
                <span>+ Add to Cart</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
