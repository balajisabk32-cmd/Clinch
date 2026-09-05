import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { StarRating, formatCurrency, TierBadge } from '../components/shared';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProduct();
    // Track recently viewed
    const recent = JSON.parse(localStorage.getItem('df360_recent') || '[]');
    const updated = [parseInt(id), ...recent.filter((r) => r !== parseInt(id))].slice(0, 8);
    localStorage.setItem('df360_recent', JSON.stringify(updated));
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products/${id}`);
      setProduct(res.data);
      if (res.data.variants?.length > 0) setSelectedVariant(res.data.variants[0]);
    } catch {
      showToast('Product not found', 'error');
      navigate('/shop');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner"></div></div>;
  if (!product) return null;

  const tierPrice = parseFloat(product.tier_price || product.base_price);
  const basePrice = parseFloat(product.base_price);
  const variantMod = selectedVariant ? parseFloat(selectedVariant.price_modifier || 0) : 0;
  const finalPrice = tierPrice + variantMod;
  const savings = basePrice - tierPrice;

  const saved = isInWishlist(product.id);

  const handleAddToCart = async () => {
    await addToCart(product.id, selectedVariant?.id || null, quantity);
    showToast(`${quantity}x "${product.name}" added to cart! 🛒`, 'success');
  };

  const handleSave = () => {
    if (saved) removeFromWishlist(product.id);
    else addToWishlist(product.id);
  };

  const groupedVariants = product.variants?.reduce((acc, v) => {
    if (!acc[v.variant_type]) acc[v.variant_type] = [];
    acc[v.variant_type].push(v);
    return acc;
  }, {}) || {};

  return (
    <div className="container">
      {/* Breadcrumb */}
      <div className="breadcrumb" style={{ marginTop: 24 }}>
        <Link to="/shop">Home</Link>
        <span className="breadcrumb-sep">›</span>
        <Link to={`/shop?category=${product.category}`}>{product.category}</Link>
        <span className="breadcrumb-sep">›</span>
        <span style={{ color: 'var(--text-primary)' }}>{product.name}</span>
      </div>

      <div className="product-detail-layout">
        {/* Gallery */}
        <div className="product-detail-gallery">
          <img
            className="product-detail-main-img"
            src={product.image_url}
            alt={product.name}
            onError={(e) => { e.target.src = 'https://placehold.co/600x600/2d2d2d/666?text=Product'; }}
          />
          {product.is_popular && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <span className="badge badge-accent">⭐ Popular Choice</span>
              <span className="badge badge-success">✅ In Stock ({product.stock} units)</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="product-detail-info">
          <span className="badge badge-accent" style={{ marginBottom: 12 }}>{product.category}</span>
          <h1 className="product-detail-name">{product.name}</h1>

          <div className="product-detail-rating">
            <StarRating rating={product.rating} reviewCount={product.review_count} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{product.review_count} verified reviews</span>
          </div>

          <div className="product-detail-price">{formatCurrency(finalPrice)}</div>
          {savings > 0 && (
            <>
              <div className="product-detail-base-price">{formatCurrency(basePrice + variantMod)}</div>
              <div className="savings-tag">🎉 You save {formatCurrency(savings)} with your <strong>{user?.tier} tier</strong></div>
            </>
          )}

          <TierBadge tier={user?.tier || 'bronze'} />

          {/* Bulk Discount Hint */}
          {quantity >= 5 && (
            <div className="bulk-hint" style={{ marginTop: 16 }}>
              💡 <strong>Bulk Tip:</strong> Add to cart and suggest a discount % for 10+ units!
            </div>
          )}
          {quantity < 5 && (
            <div className="bulk-hint" style={{ marginTop: 16 }}>
              📦 Buy 10+ units and request a bulk discount when submitting your quote!
            </div>
          )}

          <div className="divider" />

          {/* Description */}
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
            {product.description}
          </p>

          {/* Variants */}
          {Object.entries(groupedVariants).map(([variantType, variants]) => (
            <div key={variantType} className="variant-group">
              <div className="variant-label">{variantType}</div>
              <div className="variant-options">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    className={`variant-btn ${selectedVariant?.id === v.id ? 'active' : ''}`}
                    onClick={() => setSelectedVariant(v)}
                  >
                    {v.variant_value}
                    {parseFloat(v.price_modifier) > 0 && ` (+${formatCurrency(v.price_modifier)})`}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Quantity */}
          <div style={{ marginBottom: 8, fontSize: '0.875rem', fontWeight: 600 }}>Quantity</div>
          <div className="qty-selector" style={{ marginBottom: 20 }}>
            <button className="qty-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
            <span className="qty-value">{quantity}</span>
            <button className="qty-btn" onClick={() => setQuantity(quantity + 1)}>+</button>
          </div>

          {/* Price Summary */}
          <div style={{
            background: 'var(--bg-hover)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
            marginBottom: 20,
            fontSize: '0.875rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Unit price</span>
              <span>{formatCurrency(finalPrice)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem' }}>
              <span>Total ({quantity} units)</span>
              <span style={{ color: 'var(--accent)' }}>{formatCurrency(finalPrice * quantity)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="product-detail-actions">
            <button className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={handleAddToCart}>
              🛒 Add to Cart
            </button>
            <button
              className={`btn btn-secondary btn-lg ${saved ? 'btn-danger' : ''}`}
              style={{ flex: 1 }}
              onClick={handleSave}
            >
              {saved ? '❤️ Saved' : '🤍 Save'}
            </button>
          </div>

          <button
            className="btn btn-outline btn-full"
            onClick={() => { handleAddToCart(); navigate('/cart'); }}
          >
            ⚡ Add to Cart & View Cart
          </button>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="reviews-section">
        <h2 style={{ marginBottom: 20 }}>Customer Reviews ({product.reviews?.length || 0})</h2>
        <div className="reviews-summary">
          <div className="reviews-avg">{parseFloat(product.rating).toFixed(1)}</div>
          <div>
            <StarRating rating={product.rating} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Based on {product.review_count} reviews
            </div>
          </div>
        </div>

        {product.reviews?.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon">💬</div>
            <h3>No reviews yet</h3>
            <p>Be the first to review this product</p>
          </div>
        ) : (
          product.reviews?.map((review) => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div>
                  <div className="reviewer-name">{review.reviewer_name}</div>
                  <StarRating rating={review.rating} />
                </div>
                <div className="review-date">
                  {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div className="review-comment">{review.comment}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
