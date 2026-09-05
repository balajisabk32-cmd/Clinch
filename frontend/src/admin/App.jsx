import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { ToastContainer } from './components/common/ToastContainer';
import { OmniSearchModal } from './components/common/OmniSearchModal';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Discounts } from './pages/Discounts';
import { Warehouses } from './pages/Warehouses';
import { Subscriptions } from './pages/Subscriptions';
import { CustomerTiers } from './pages/CustomerTiers';
import { Anomalies } from './pages/Anomalies';
import { Reporting } from './pages/Reporting';

const routeTitles = {
  '#dashboard': 'Revenue Cockpit',
  '#products': 'Product & Price Lists',
  '#discounts': 'Discount Approvals',
  '#warehouses': 'Warehouses & Fulfillment',
  '#subscriptions': 'Recurring Subscriptions',
  '#customerTiers': 'Customer Tier Upgrades',
  '#anomalies': 'Discount Anomalies',
  '#reporting': 'Reporting & Analytics'
};

export function App() {
  const [currentRoute, setCurrentRoute] = useState(() => {
    const raw = window.location.hash || '#dashboard';
    return raw.split('?')[0].split('&')[0];
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isOmniSearchOpen, setIsOmniSearchOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const raw = window.location.hash || '#dashboard';
      const clean = raw.split('?')[0].split('&')[0];
      setCurrentRoute(clean);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Omni-search Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOmniSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTo = (route) => {
    window.location.hash = route;
    setCurrentRoute(route);
  };

  const currentTitle = routeTitles[currentRoute] || 'Revenue Cockpit';

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={navigateTo}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="app-main">
        <Topbar
          currentTitle={currentTitle}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          onOpenSearch={() => setIsOmniSearchOpen(true)}
        />

        <main className="app-content" id="main-content-area">
          {currentRoute === '#dashboard' && (
            <Dashboard
              onNavigate={navigateTo}
              onOpenNewProductModal={() => {
                navigateTo('#products');
                setIsAddProductModalOpen(true);
              }}
            />
          )}

          {currentRoute === '#products' && (
            <Products
              isAddModalOpen={isAddProductModalOpen}
              onOpenAddModal={() => setIsAddProductModalOpen(true)}
              onCloseAddModal={() => setIsAddProductModalOpen(false)}
            />
          )}

          {currentRoute === '#discounts' && <Discounts />}
          {currentRoute === '#warehouses' && <Warehouses />}
          {currentRoute === '#subscriptions' && <Subscriptions />}
          {currentRoute === '#customerTiers' && <CustomerTiers />}
          {currentRoute === '#anomalies' && <Anomalies />}
          {currentRoute === '#reporting' && <Reporting />}

          {/* Fallback */}
          {!routeTitles[currentRoute] && (
            <Dashboard
              onNavigate={navigateTo}
              onOpenNewProductModal={() => {
                navigateTo('#products');
                setIsAddProductModalOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Omni-search modal */}
      <OmniSearchModal
        isOpen={isOmniSearchOpen}
        onClose={() => setIsOmniSearchOpen(false)}
        onNavigate={navigateTo}
      />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
