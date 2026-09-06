import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Package, Heart, ShoppingBag, ArrowLeft, ShieldCheck, Check } from 'lucide-react';
import api from '../api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { StarRating, formatCurrency, TierBadge } from '../components/shared';

export default function ProductDetail() {
  const { id: sku } = useParams();  // route param is sku in the catalog
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    fetchProduct();
    // Track recently viewed (use sku as key)
    try {
      const recent = JSON.parse(localStorage.getItem('clinch_recent') || '[]');
      const updated = [sku, ...recent.filter((r) => r !== sku)].slice(0, 8);
      localStorage.setItem('clinch_recent', JSON.stringify(updated));
    } catch {}
  }, [sku]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/shop/catalog/${sku}`);
      const p = res.data;
      if (!p || p.detail) throw new Error('Not found');
      setProduct(p);

      // Initialize default selected variants
      const groups = normalizeVariants(p.variants || []);
      const initial = {};
      Object.entries(groups).forEach(([groupName, options]) => {
        if (options.length > 0) initial[groupName] = options[0];
      });
      setSelectedVariants(initial);
    } catch {
      showToast('Product not found', 'error');
      navigate('/shop');
    } finally {
      setLoading(false);
    }
  };

  // Helper to normalize variants across different backend schemas
  const normalizeVariants = (variants) => {
    return (variants || []).reduce((acc, v) => {
      if (v.attribute && Array.isArray(v.values)) {
        const groupName = v.attribute;
        if (!acc[groupName]) acc[groupName] = [];
        v.values.forEach((val, idx) => {
          acc[groupName].push({
            id: `${groupName}-${val}`,
            attribute: groupName,
            value: val,
            extraPrice: Number(v.extra_price?.[idx] || 0),
          });
        });
      } else if (v.variant_type || v.attribute) {
        const groupName = v.variant_type || v.attribute;
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push({
          id: v.id || `${groupName}-${v.variant_value || v.value}`,
          attribute: groupName,
          value: v.variant_value || v.value || '',
          extraPrice: Number(v.price_modifier || v.extraPrice || v.extra_price || 0),
        });
      }
      return acc;
    }, {});
  };

  if (loading) return <div className="loading-center"><div className="spinner"></div></div>;
  if (!product) return null;

  const variantGroups = normalizeVariants(product.variants || []);
  const variantMod = Object.values(selectedVariants).reduce(
    (sum, opt) => sum + (opt?.extraPrice || 0),
    0
  );

  const tierPrice = parseFloat(product.your_price || product.list_price || 0);
  const basePrice  = parseFloat(product.list_price || 0);
  const finalPrice = tierPrice + variantMod;
  const savings    = Math.max(0, basePrice - tierPrice);
  const customerTier = product.tier || user?.tier || 'Gold';

  const saved = isInWishlist(product.sku);
  const imageUrl = product.image || product.image_url || (product.sku ? `/products/${product.sku}.jpg` : null);

  const handleAddToCart = async () => {
    await addToCart(product.sku, quantity);
    showToast(`${quantity}× "${product.name}" added to cart!`, 'success');
  };

  const handleSave = () => {
    if (saved) {
      removeFromWishlist(product.sku);
      showToast('Removed from saved items', 'info');
    } else {
      addToWishlist(product);
      showToast('Saved to wishlist!', 'success');
    }
  };

  return (
    <div className="customer-page-container mx-auto max-w-[1240px] px-5 py-8">
      {/* Clean Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-6 flex-wrap" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-[#0e7490] transition-colors font-medium">Home</Link>
        <span>/</span>
        <Link to={`/shop?category=${encodeURIComponent(product.category || '')}`} className="hover:text-[#0e7490] transition-colors font-medium">
          {product.category || 'Catalog'}
        </Link>
        <span>/</span>
        <span className="text-[#0d1b2a] font-semibold truncate max-w-[320px] sm:max-w-md">
          {product.name}
        </span>
      </nav>

      <div className="product-detail-layout">
        {/* Product Image Preview & Gallery */}
        <div className="product-detail-gallery">
          <div className="relative w-full aspect-square bg-[#f8fafc] rounded-2xl border border-[#0d1b2a]/[0.08] overflow-hidden flex items-center justify-center p-8 shadow-sm group">
            {imageUrl && !imgFailed ? (
              <img
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                src={imageUrl}
                alt={product.name}
                loading="eager"
                decoding="async"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <Package size={56} className="text-[#94a3b8] mb-3" />
                <span className="text-sm font-semibold text-[#46586b]">{product.name}</span>
                <span className="text-xs text-[#94a3b8] mt-1">{product.sku}</span>
              </div>
            )}

            {/* Availability status badge */}
            <div className="absolute top-4 left-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-sm ${
                product.availability === 'in_stock'
                  ? 'bg-[#15803d]/10 text-[#15803d] ring-1 ring-[#15803d]/20'
                  : 'bg-[#b45309]/10 text-[#b45309] ring-1 ring-[#b45309]/20'
              }`}>
                {product.availability === 'in_stock' ? 'In Stock' : 'Low Stock'}
              </span>
            </div>
          </div>

          {(product.is_promoted || product.is_popular) && (
            <div className="mt-3 flex gap-2">
              <span className="badge badge-accent">Featured Choice</span>
              <span className="badge badge-success">Verified Genuine</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="product-detail-info">
          <span className="badge badge-accent mb-3 inline-block">{product.category}</span>
          <h1 className="product-detail-name font-display text-2xl sm:text-3xl font-bold text-[#0d1b2a] mb-2 leading-tight">
            {product.name}
          </h1>

          <div className="product-detail-rating flex items-center gap-2 mb-4">
            <StarRating rating={product.rating || 4.5} reviewCount={product.review_count || 12} />
            <span className="text-xs text-[#7b8ca0] font-medium">
              {product.review_count || 12} verified reviews
            </span>
          </div>

          <div className="product-detail-price font-display text-3xl font-bold text-[#0d1b2a] mb-1">
            {formatCurrency(finalPrice)}
          </div>

          {savings > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-[#7b8ca0] line-through">
                {formatCurrency(basePrice + variantMod)}
              </span>
              <div className="savings-tag m-0">
                You save {formatCurrency(savings)} with your <strong>{customerTier.toUpperCase()} tier</strong>
              </div>
            </div>
          )}

          <div className="mb-4">
            <TierBadge tier={customerTier.toLowerCase()} />
          </div>

          {/* Bulk Discount Hint */}
          <div className="bulk-hint mb-5">
            {quantity >= 10
              ? 'Bulk order threshold unlocked! Your quote request qualifies for maximum tier leverage.'
              : 'Buy 10+ units and request a bulk discount when submitting your quote!'}
          </div>

          <div className="divider my-5 border-t border-[#0d1b2a]/[0.08]" />

          {/* Description */}
          <p className="text-sm text-[#46586b] leading-relaxed mb-5">
            {product.description}
          </p>

          {/* Configurable Variants */}
          {Object.entries(variantGroups).length > 0 && (
            <div className="mb-6 space-y-4">
              {Object.entries(variantGroups).map(([groupName, options]) => (
                <div key={groupName} className="variant-group">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#46586b] mb-2">
                    {groupName}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt) => {
                      const isSelected = selectedVariants[groupName]?.id === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'border-[#0e7490] bg-[#0e7490]/10 text-[#0e7490] ring-1 ring-[#0e7490]'
                              : 'border-[#0d1b2a]/[0.12] bg-white text-[#46586b] hover:border-[#0e7490]/50'
                          }`}
                          onClick={() => setSelectedVariants((prev) => ({ ...prev, [groupName]: opt }))}
                        >
                          <span>{opt.value}</span>
                          {opt.extraPrice > 0 && (
                            <span className="ml-1.5 opacity-80">
                              (+{formatCurrency(opt.extraPrice)})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quantity Selector */}
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#46586b]">Quantity</div>
          <div className="qty-selector mb-5">
            <button
              type="button"
              className="qty-btn"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="qty-value font-semibold">{quantity}</span>
            <button
              type="button"
              className="qty-btn"
              onClick={() => setQuantity(quantity + 1)}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Price Summary Breakdown */}
          <div className="rounded-xl bg-[#f8fafc] border border-[#0d1b2a]/[0.08] p-4 mb-5 text-xs">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[#7b8ca0]">Unit price ({customerTier} Tier)</span>
              <span className="font-medium text-[#0d1b2a]">{formatCurrency(finalPrice)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#0d1b2a]/[0.06] text-sm font-bold">
              <span className="text-[#0d1b2a]">Total ({quantity} unit{quantity > 1 ? 's' : ''})</span>
              <span className="text-[#0e7490]">{formatCurrency(finalPrice * quantity)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="product-detail-actions flex items-center gap-3 mb-3">
            <button
              type="button"
              className="btn btn-primary btn-lg flex-1 inline-flex items-center justify-center gap-2"
              onClick={handleAddToCart}
            >
              <ShoppingBag size={18} />
              <span>Add to Cart</span>
            </button>
            <button
              type="button"
              className={`btn btn-lg inline-flex items-center justify-center gap-2 transition-all ${
                saved
                  ? 'bg-[#be123c] text-white border-[#be123c]'
                  : 'btn-secondary text-[#46586b] hover:text-[#be123c]'
              }`}
              style={{ minWidth: '100px' }}
              onClick={handleSave}
            >
              <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
              <span>{saved ? 'Saved' : 'Save'}</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-full flex items-center justify-center gap-2 text-xs"
            onClick={async () => {
              await handleAddToCart();
              navigate('/cart');
            }}
          >
            <span>Add to Cart & View Cart</span>
          </button>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="reviews-section mt-12 pt-8 border-t border-[#0d1b2a]/[0.08]">
        <h2 className="text-xl font-bold text-[#0d1b2a] mb-6">
          Customer Reviews ({product.reviews?.length || 0})
        </h2>
        <div className="reviews-summary flex items-center gap-6 p-6 rounded-2xl bg-[#f8fafc] border border-[#0d1b2a]/[0.08] mb-6">
          <div className="reviews-avg font-display text-4xl font-extrabold text-[#0d1b2a]">
            {parseFloat(product.rating || 4.5).toFixed(1)}
          </div>
          <div>
            <StarRating rating={product.rating || 4.5} />
            <div className="text-xs text-[#7b8ca0] mt-1 font-medium">
              Based on {product.review_count || 12} verified reviews
            </div>
          </div>
        </div>

        {(!product.reviews || product.reviews.length === 0) ? (
          <div className="empty-state p-8 text-center bg-white rounded-2xl border border-dashed border-[#0d1b2a]/[0.12]">
            <h3 className="text-sm font-semibold text-[#0d1b2a] mb-1">No reviews yet</h3>
            <p className="text-xs text-[#7b8ca0]">Be the first enterprise buyer to review this configuration.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {product.reviews.map((review) => (
              <div key={review.id} className="review-card p-5 rounded-xl bg-white border border-[#0d1b2a]/[0.08] shadow-sm">
                <div className="review-header flex items-center justify-between mb-3">
                  <div>
                    <div className="reviewer-name font-semibold text-sm text-[#0d1b2a]">{review.reviewer_name}</div>
                    <StarRating rating={review.rating} />
                  </div>
                  <div className="review-date text-xs text-[#7b8ca0]">
                    {new Date(review.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div className="review-comment text-sm text-[#46586b] leading-relaxed">{review.comment}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
