import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from './shared';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();
  const saved = isInWishlist(product.id);

  const handleAdd = (e) => {
    e.stopPropagation();
    addToCart(product.id, null, 1);
    showToast(`Added ${product.name} to cart!`, 'success');
  };

  const handleSave = (e) => {
    e.stopPropagation();
    if (saved) {
      removeFromWishlist(product.id);
      showToast('Removed from saved items', 'info');
    } else {
      addToWishlist(product.id);
      showToast('Saved to wishlist! ❤️', 'success');
    }
  };

  const tierPrice = parseFloat(product.tier_price || product.base_price);
  const originalPrice = parseFloat(product.original_price || product.base_price * 1.15);
  const brand = (product.brand || product.name.split(' ')[0]).toUpperCase();
  const saleBadge = product.sale_badge || (product.tier === 'gold' ? 'Gold 15%' : 'Sale 10%');

  return (
    <div className="protech-card" onClick={() => navigate(`/shop/${product.id}`)}>
      {/* Top Floating Row: Sale Badge & Heart */}
      <div className="protech-card-topbar">
        {saleBadge ? (
          <span className="protech-sale-badge">{saleBadge}</span>
        ) : (
          <span />
        )}
        <button
          className={`protech-heart-btn ${saved ? 'active' : ''}`}
          onClick={handleSave}
          title={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          {saved ? '♥' : '♡'}
        </button>
      </div>

      {/* Image Wrap */}
      <div className="protech-card-image-wrap">
        <img
          src={product.image_url}
          alt={product.name}
          className="protech-card-img"
          loading="lazy"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600';
          }}
        />
      </div>

      {/* Card Info */}
      <div className="protech-card-info">
        {/* Brand & Rating Row */}
        <div className="protech-brand-rating-row">
          <span className="protech-card-brand">{brand}</span>
          <div className="protech-card-rating">
            <span className="star-icon">★</span>
            <span className="rating-num">{product.rating ? parseFloat(product.rating).toFixed(1) : '4.8'}</span>
          </div>
        </div>

        {/* Price Row */}
        <div className="protech-price-row">
          <span className="protech-current-price">{formatCurrency(tierPrice)}</span>
          {originalPrice > tierPrice && (
            <span className="protech-original-price">{formatCurrency(originalPrice)}</span>
          )}
        </div>

        {/* Product Title */}
        <h4 className="protech-product-title" title={product.name}>
          {product.name}
        </h4>

        {/* Action Button */}
        <div className="protech-card-footer" onClick={(e) => e.stopPropagation()}>
          <button className="protech-add-cart-btn" onClick={handleAdd}>
            <span>+ Add to Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
}
