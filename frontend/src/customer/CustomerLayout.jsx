import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import './customer.css';

function CustomerInnerShell() {
  const { token, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Ensure Clinch cool silver canvas is permanently applied
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
    document.body.classList.remove('dark');
    document.body.classList.add('customer-portal-active');
    document.body.style.backgroundColor = '#f4f6f8';
    document.body.style.color = '#0d1b2a';

    return () => {
      document.body.classList.remove('customer-portal-active');
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f4f6f8] text-[#0d1b2a]">
        <div className="w-12 h-12 rounded-xl bg-[#0e7490] flex items-center justify-center font-bold text-xl text-white shadow-md">
          C
        </div>
        <p className="text-sm text-[#46586b] font-medium">Connecting to Clinch Deal Engine...</p>
      </div>
    );
  }

  if (!token) {
    localStorage.removeItem('clinch_token');
    localStorage.removeItem('clinch_user');
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="customer-app-shell min-h-screen flex flex-col bg-[#f4f6f8] text-[#0d1b2a]">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-auto border-t border-[#0d1b2a]/[0.08] bg-white py-6 text-xs text-[#7b8ca0]">
        <div className="mx-auto max-w-[1240px] px-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-[16px] w-auto opacity-70" />
            <span>Clinch Customer Storefront • B2B Enterprise Commerce & Deal Governance</span>
          </div>
          <div className="flex items-center gap-4 text-[#46586b]">
            <span>Active Tier: Corporate Contract</span>
            <span>•</span>
            <span>256-Bit Encrypted Deal Engine Session</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function CustomerLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <CustomerInnerShell />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
