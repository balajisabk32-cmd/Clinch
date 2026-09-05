import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import api from '../api';
import { timeAgo } from './shared';

export default function Navbar({ onSearch, searchValue }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchValue || '');

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch {}
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(localSearch);
    navigate(`/shop?search=${encodeURIComponent(localSearch)}`);
  };

  const currentCategory = new URLSearchParams(location.search).get('category');
  const currentSort = new URLSearchParams(location.search).get('sort');

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <nav className="protech-navbar">
      <div className="protech-nav-inner">
        {/* Left: Brand & Catalog Button */}
        <div className="protech-nav-left">
          <Link to="/shop" className="protech-logo">
            <span className="protech-logo-bold">Protech</span>
            <span className="protech-logo-tag">B2B</span>
          </Link>

          <button
            className="protech-catalog-pill"
            onClick={() => navigate('/shop')}
          >
            <span className="catalog-icon">≡</span>
            <span>Catalog</span>
          </button>
        </div>

        {/* Center: Navigation Links */}
        <div className="protech-nav-links">
          <Link
            to="/shop?sort=popular"
            className={`protech-nav-item ${location.pathname === '/shop' && !currentCategory ? 'active' : ''}`}
          >
            Bestsellers
          </Link>

          <button
            type="button"
            onClick={() => currentCategory === 'Hardware' ? navigate('/shop') : navigate('/shop?category=Hardware')}
            className={`protech-nav-item ${currentCategory === 'Hardware' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            Hardware
          </button>

          <button
            type="button"
            onClick={() => currentCategory === 'Software' ? navigate('/shop') : navigate('/shop?category=Software')}
            className={`protech-nav-item ${currentCategory === 'Software' ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            Software
          </button>

          <Link
            to="/quotations"
            className={`protech-nav-item ${location.pathname.startsWith('/quotations') ? 'active' : ''}`}
          >
            Quotations
          </Link>

          <Link
            to="/account?tab=orders"
            className={`protech-nav-item ${location.pathname === '/account' ? 'active' : ''}`}
          >
            Orders
          </Link>
        </div>

        {/* Right: Actions (Search, Wishlist, Cart, Account, Theme) */}
        <div className="protech-nav-right">
          {/* Search Bar / Input */}
          <form className="protech-nav-search" onSubmit={handleSearch}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search hardware, software..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
            />
          </form>

          {/* Wishlist */}
          <button
            className="protech-icon-btn"
            onClick={() => navigate('/wishlist')}
            title="Wishlist"
          >
            🤍
            {wishlistCount > 0 && <span className="protech-badge-dot">{wishlistCount}</span>}
          </button>

          {/* Cart Button */}
          <button
            className="protech-cart-pill"
            onClick={() => navigate('/cart')}
            title="Cart"
          >
            <span style={{ fontSize: '1.1rem' }}>🛒</span>
            <span className="cart-label">Cart</span>
            {cartCount > 0 && (
              <span className="protech-cart-count">{cartCount}</span>
            )}
          </button>

          {/* Notifications Bell */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              className="protech-icon-btn"
              onClick={() => { setShowNotif((v) => !v); setShowProfile(false); }}
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && <span className="protech-badge-dot">{unreadCount}</span>}
            </button>

            {showNotif && (
              <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Notifications</h4>
                  {unreadCount > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No notifications
                  </div>
                ) : (
                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {notifications.map((n) => (
                      <div key={n.id} className={`notification-item ${!n.is_read ? 'unread' : ''}`}>
                        <span className="notification-icon">
                          {n.type === 'upgrade' ? '🏆' : n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : '📋'}
                        </span>
                        <div>
                          <div className="notification-text">{n.message}</div>
                          <div className="notification-time">{timeAgo(n.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <div
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div className="theme-toggle-thumb">
              {theme === 'dark' ? '🌙' : '☀️'}
            </div>
          </div>

          {/* Profile Dropdown */}
          <div style={{ position: 'relative' }} ref={profileRef}>
            <button
              className="protech-profile-pill"
              onClick={() => { setShowProfile((v) => !v); setShowNotif(false); }}
            >
              <span className="profile-avatar">{initials}</span>
              <span className="profile-name">{user?.name?.split(' ')[0] || 'Account'}</span>
            </button>

            {showProfile && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-name">{user?.name}</div>
                  <div className="profile-dropdown-email">{user?.email}</div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge badge-${user?.tier || 'bronze'}`}>
                      {user?.tier?.toUpperCase()} TIER
                    </span>
                  </div>
                </div>
                {[
                  { icon: '👤', label: 'My Account & Tier', path: '/account' },
                  { icon: '📋', label: 'My Quotations', path: '/quotations' },
                  { icon: '📦', label: 'Order History', path: '/account?tab=orders' },
                  { icon: '🤍', label: 'Saved Wishlist', path: '/wishlist' },
                ].map((item) => (
                  <div
                    key={item.path}
                    className="profile-dropdown-item"
                    onClick={() => { navigate(item.path); setShowProfile(false); }}
                  >
                    {item.icon} {item.label}
                  </div>
                ))}
                <div className="divider" style={{ margin: '4px 0' }} />
                <div
                  className="profile-dropdown-item danger"
                  onClick={() => { logout(); navigate('/login'); }}
                >
                  🚪 Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
