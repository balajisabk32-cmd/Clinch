import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, StarRating } from '../components/shared';

export default function Wishlist() {
  const { wishlist, fetchWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { fetchWishlist(); }, []);

  const handleMoveToCart = async (item) => {
    await addToCart(item.product_id, null, 1);
    await removeFromWishlist(item.id);
    showToast('Moved to cart! 🛒', 'success');
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">❤️ Saved Items</h1>
        <p className="page-subtitle">
          {wishlist.length > 0 ? `${wishlist.length} saved item${wishlist.length !== 1 ? 's' : ''}` : 'No saved items yet'}
        </p>
      </div>

      {wishlist.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🤍</div>
          <h3>Your wishlist is empty</h3>
          <p>Save products you love by clicking the heart icon on any product card</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/shop')}>
            🛍️ Discover Products
          </button>
        </div>
      ) : (
        <div className="wishlist-grid">
          {wishlist.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'var(--bg-hover)' }}>
                <img
                  src={item.image_url}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => navigate(`/shop/${item.product_id}`)}
                  onError={(e) => { e.target.src = 'https://placehold.co/300x300/2d2d2d/666?text=Product'; }}
                />
                <span style={{ position: 'absolute', top: 8, left: 8 }} className={`badge badge-${item.category?.toLowerCase().replace(/ /g, '-')}`}>
                  {item.category}
                </span>
              </div>
              <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{ fontWeight: 600, marginBottom: 6, cursor: 'pointer', fontSize: '0.9rem' }}
                  onClick={() => navigate(`/shop/${item.product_id}`)}
                >
                  {item.name}
                </div>
                <StarRating rating={item.rating} reviewCount={item.review_count} />
                <div style={{ fontSize: '1.2rem', fontWeight: 800, margin: '8px 0' }}>
                  {formatCurrency(item.tier_price)}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-primary btn-sm btn-full" onClick={() => handleMoveToCart(item)}>
                    🛒 Move to Cart
                  </button>
                  <button className="btn btn-danger btn-sm btn-full" onClick={() => removeFromWishlist(item.id)}>
                    🗑 Remove
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
