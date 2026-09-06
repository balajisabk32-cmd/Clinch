import { Link, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../components/shared';

/**
 * Wishlist page — items stored in localStorage by the WishlistContext.
 * Each item is a product object from /shop/catalog with at minimum { sku, name, ... }.
 */
export default function Wishlist() {
  const { wishlist, fetchWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // fetchWishlist is a no-op (local storage), call it for API compatibility
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleMoveToCart = async (item) => {
    await addToCart(item.sku, 1);
    removeFromWishlist(item.sku);
    showToast('Moved to cart!', 'success');
  };

  const price = (item) => parseFloat(item.your_price || item.list_price || 0);

  return (
    <div className="container">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-3">
        <Link to="/shop" className="hover:text-[#0d1b2a] transition-colors">Home</Link>
        <span>•</span>
        <span className="text-[#0d1b2a] font-medium">Saved Items</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Saved Items</h1>
          <p className="page-subtitle">
            {wishlist.length > 0
              ? `${wishlist.length} saved item${wishlist.length !== 1 ? 's' : ''}`
              : 'No saved items yet'}
          </p>
        </div>
      </div>

      {wishlist.length === 0 ? (
        <div className="empty-state">
          <div className="w-16 h-16 rounded-2xl bg-[#edf0f4] text-[#0d1b2a] flex items-center justify-center mx-auto mb-4">
            <Heart size={28} className="text-[#7b8ca0]" />
          </div>
          <h3>Your wishlist is empty</h3>
          <p>Save products you love by clicking the heart icon on any product card</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/shop')}>
            Discover Products
          </button>
        </div>
      ) : (
        <div className="wishlist-grid">
          {wishlist.map((item) => (
            <div key={item.sku} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'var(--bg-hover)' }}>
                <img
                  src={item.image_url}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => navigate(`/shop/${item.sku}`)}
                  onError={(e) => { e.target.src = 'https://placehold.co/300x300/2d2d2d/666?text=Product'; }}
                />
                <span style={{ position: 'absolute', top: 8, left: 8 }} className="badge">
                  {item.category}
                </span>
              </div>
              <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{ fontWeight: 600, marginBottom: 6, cursor: 'pointer', fontSize: '0.9rem' }}
                  onClick={() => navigate(`/shop/${item.sku}`)}
                >
                  {item.name}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, margin: '8px 0' }}>
                  {formatCurrency(price(item))}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-primary btn-sm btn-full" onClick={() => handleMoveToCart(item)}>
                     Move to Cart
                  </button>
                  <button className="btn btn-danger btn-sm btn-full" onClick={() => removeFromWishlist(item.sku)}>
                     Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
