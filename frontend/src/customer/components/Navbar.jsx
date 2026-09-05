import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Store, 
  Layers, 
  Code, 
  FileText, 
  Package, 
  Search, 
  Heart, 
  ShoppingBag, 
  ArrowUpRight, 
  LogOut, 
  User, 
  ChevronDown 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import api from '../api';

const TIER_BADGES = {
  bronze: { label: 'BRONZE', bg: '#fef3c7', text: '#b45309', ring: 'rgba(180, 83, 9, 0.25)' },
  silver: { label: 'SILVER', bg: '#edf0f4', text: '#46586b', ring: 'rgba(13, 27, 42, 0.12)' },
  gold: { label: 'GOLD', bg: '#dcf3ea', text: '#047857', ring: 'rgba(4, 120, 87, 0.25)' },
};

export default function Navbar({ onSearch }) {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const [localSearch, setLocalSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);

  const profileRef = useRef(null);

  useEffect(() => {
    api.get('/account')
      .then(res => setAccountInfo(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(localSearch);
    } else {
      navigate(`/shop?search=${encodeURIComponent(localSearch)}`);
    }
  };

  const queryParams = new URLSearchParams(location.search);
  const currentCategory = queryParams.get('category');
  const userTier = (user?.tier || accountInfo?.tier || 'silver').toLowerCase();
  const tierStyle = TIER_BADGES[userTier] || TIER_BADGES.silver;
  const companyName = user?.company || accountInfo?.company || 'Acme Enterprises Pvt. Ltd.';
  const userName = user?.name || 'Rajesh Kumar';

  return (
    <header className="clinch-storefront-header sticky top-0 z-40 bg-white border-b border-[#0d1b2a]/[0.08]" style={{ boxShadow: '0 1px 3px rgba(13,27,42,0.04)' }}>
      {/* Main Navigation Bar */}
      <div className="mx-auto max-w-[1240px] px-5 h-16 flex items-center justify-between gap-4">
        {/* Left: Clinch Brand Logo + Storefront Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/shop" className="flex items-center gap-2" aria-label="Clinch Storefront">
            <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-[22px] w-auto" />
          </Link>
          <span className="hidden sm:inline-flex items-center font-mono text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#0e7490]/10 text-[#0e7490] ring-1 ring-[#0e7490]/20">
            CUSTOMER PORTAL
          </span>
        </div>

        {/* Center: Primary Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link
            to="/shop"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              location.pathname === '/shop' && !currentCategory
                ? 'bg-[#0d1b2a] text-white'
                : 'text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4]'
            }`}
          >
            <Store size={14} />
            <span>Catalog</span>
          </Link>

          <button
            type="button"
            onClick={() => navigate('/shop?category=Hardware')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              currentCategory === 'Hardware'
                ? 'bg-[#0d1b2a] text-white'
                : 'text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4]'
            }`}
          >
            <Layers size={14} />
            <span>Hardware</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/shop?category=Software')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              currentCategory === 'Software'
                ? 'bg-[#0d1b2a] text-white'
                : 'text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4]'
            }`}
          >
            <Code size={14} />
            <span>Software</span>
          </button>

          <Link
            to="/quotations"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              location.pathname.startsWith('/quotations') || location.pathname.startsWith('/my/quotations')
                ? 'bg-[#0d1b2a] text-white'
                : 'text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4]'
            }`}
          >
            <FileText size={14} />
            <span>Quotations</span>
          </Link>

          <Link
            to="/account?tab=orders"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              location.pathname === '/account' && location.search.includes('tab=orders')
                ? 'bg-[#0d1b2a] text-white'
                : 'text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4]'
            }`}
          >
            <Package size={14} />
            <span>Orders</span>
          </Link>

          <Link
            to="/cart"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              location.pathname === '/cart'
                ? 'bg-[#0d1b2a] text-white shadow-sm'
                : 'text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4]'
            }`}
          >
            <ShoppingBag size={14} />
            <span>Cart</span>
            {cartCount > 0 && (
              <span className={`min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${
                location.pathname === '/cart' ? 'bg-white text-[#0d1b2a]' : 'bg-[#0e7490] text-white'
              }`}>
                {cartCount}
              </span>
            )}
          </Link>
        </nav>

        {/* Right: Search, Wishlist, Cart & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Live Search Pill */}
          <form onSubmit={handleSearch} className="relative hidden md:flex items-center">
            <Search size={14} className="absolute left-3 text-[#7b8ca0]" />
            <input
              type="text"
              placeholder="Search catalog..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
              className="w-40 lg:w-52 pl-8 pr-3 py-1.5 rounded-full text-[12.5px] bg-[#f4f6f8] border border-[#0d1b2a]/[0.08] text-[#0d1b2a] placeholder-[#7b8ca0] focus:outline-none focus:ring-2 focus:ring-[#0e7490]/30 focus:border-[#0e7490] transition-all"
            />
          </form>

          {/* Wishlist Button */}
          <Link
            to="/wishlist"
            className="relative p-2 rounded-full text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4] transition-colors"
            title="Saved Wishlist"
          >
            <Heart size={18} />
            {wishlistCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[17px] h-[17px] px-1 rounded-full bg-[#0e7490] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart Button */}
          <Link
            to="/cart"
            className={`relative p-2 rounded-full transition-colors ${
              location.pathname === '/cart'
                ? 'bg-[#0d1b2a] text-white shadow-sm'
                : 'text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#edf0f4]'
            }`}
            title="View Cart & Request Quotation"
          >
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span className={`absolute top-0 right-0 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${
                location.pathname === '/cart' ? 'bg-white text-[#0d1b2a]' : 'bg-[#0e7490] text-white'
              }`}>
                {cartCount}
              </span>
            )}
          </Link>

          {/* Customer Profile & Standing */}
          <div className="relative pl-1 border-l border-[#0d1b2a]/[0.08]" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-[#edf0f4] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#0e7490] text-white font-semibold text-xs flex items-center justify-center">
                {userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden xl:flex flex-col text-left leading-tight">
                <span className="text-[12px] font-semibold text-[#0d1b2a] truncate max-w-[120px]">
                  {companyName}
                </span>
                <span className="text-[10.5px] text-[#7b8ca0] truncate max-w-[120px]">
                  {userName}
                </span>
              </div>
              <span
                className="font-mono text-[9.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: tierStyle.bg,
                  color: tierStyle.text,
                  boxShadow: `0 0 0 1px ${tierStyle.ring}`
                }}
              >
                {tierStyle.label}
              </span>
              <ChevronDown size={14} className="text-[#7b8ca0]" />
            </button>

            {/* Dropdown Menu */}
            {showProfile && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#0d1b2a]/[0.09] py-2 z-50">
                <div className="px-4 py-2 border-b border-[#0d1b2a]/[0.06]">
                  <p className="text-[13px] font-bold text-[#0d1b2a]">{userName}</p>
                  <p className="text-[11.5px] text-[#7b8ca0] truncate">{companyName}</p>
                  <div className="mt-1.5">
                    <span
                      className="font-mono text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
                      style={{
                        background: tierStyle.bg,
                        color: tierStyle.text,
                        boxShadow: `0 0 0 1px ${tierStyle.ring}`
                      }}
                    >
                      {tierStyle.label} TIER ACTIVE
                    </span>
                  </div>
                </div>

                <Link
                  to="/account"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2 px-4 py-2 text-[12.5px] text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#f4f6f8] transition-colors"
                >
                  <User size={15} />
                  <span>My Account & Tier</span>
                </Link>

                <Link
                  to="/quotations"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2 px-4 py-2 text-[12.5px] text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#f4f6f8] transition-colors"
                >
                  <FileText size={15} />
                  <span>My Quotations</span>
                </Link>

                <Link
                  to="/account?tab=orders"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2 px-4 py-2 text-[12.5px] text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#f4f6f8] transition-colors"
                >
                  <Package size={15} />
                  <span>Order Tracking</span>
                </Link>

                <Link
                  to="/wishlist"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2 px-4 py-2 text-[12.5px] text-[#46586b] hover:text-[#0d1b2a] hover:bg-[#f4f6f8] transition-colors"
                >
                  <Heart size={15} />
                  <span>Saved Wishlist</span>
                </Link>

                <div className="my-1 border-t border-[#0d1b2a]/[0.06]" />



                <button
                  onClick={() => {
                    setShowProfile(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[12.5px] text-[#be123c] hover:bg-[#be123c]/10 transition-colors"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier Standing Bar */}
      <div className="border-t border-[#0d1b2a]/[0.06] bg-[#f8fafc] px-5 py-2">
        <div className="mx-auto max-w-[1240px] flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-2 text-[#46586b]">
            <span className="font-semibold text-[#0d1b2a]">{companyName}</span>
            <span className="text-[#7b8ca0]">•</span>
            <span>Current standing: <strong className="text-[#0e7490]">{tierStyle.label} Tier</strong></span>
            <span className="text-[#7b8ca0]">•</span>
            <span>Enterprise B2B pricing active</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11.5px] text-[#7b8ca0]">
              Next milestone: <strong>Gold Tier (25% off)</strong>
            </span>
            <div className="w-28 h-1.5 rounded-full bg-[#edf0f4] overflow-hidden">
              <div className="h-full bg-[#0e7490] rounded-full" style={{ width: '65%' }} />
            </div>
            <span className="text-[11.5px] font-semibold text-[#0e7490]">65%</span>
          </div>
        </div>
      </div>
    </header>
  );
}
