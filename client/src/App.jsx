import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

import Navbar from './components/Navbar';
import Login from './pages/Login';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Quotations from './pages/Quotations';
import QuotationDetail from './pages/QuotationDetail';
import Account from './pages/Account';
import OrderTracking from './pages/OrderTracking';

function ProtectedLayout() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem', color: '#000' }}>
          D
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading DealFlow360...</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 0', marginTop: 'auto', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>DealFlow360 Customer Portal • B2B Enterprise Commerce & Quotation Platform</div>
          <div>Secure 256-bit Encrypted Session</div>
        </div>
      </footer>
    </div>
  );
}

function PublicRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (token) {
    return <Navigate to="/shop" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Router>
                <Routes>
                  {/* Public route */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <Login />
                      </PublicRoute>
                    }
                  />

                  {/* Protected routes */}
                  <Route element={<ProtectedLayout />}>
                    <Route path="/" element={<Navigate to="/shop" replace />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/shop/:id" element={<ProductDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/quotations" element={<Quotations />} />
                    <Route path="/quotations/:id" element={<QuotationDetail />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/orders/:id" element={<OrderTracking />} />
                    <Route path="*" element={<Navigate to="/shop" replace />} />
                  </Route>
                </Routes>
              </Router>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
