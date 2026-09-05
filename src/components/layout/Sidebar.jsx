import React from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Sliders,
  Warehouse,
  Calendar,
  Award,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

export function Sidebar({ currentRoute, onNavigate, isMobileOpen, onCloseMobile }) {
  const navItems = [
    {
      group: 'Overview',
      links: [
        { route: '#dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { route: '#reporting', label: 'Reporting & Analytics', icon: BarChart3 }
      ]
    },
    {
      group: 'Operations & Pricing',
      links: [
        { route: '#products', label: 'Products & Price Lists', icon: Package },
        { route: '#discounts', label: 'Discount Approvals', icon: Sliders, badge: '12', badgeType: 'warning' },
        { route: '#warehouses', label: 'Warehouses & Split', icon: Warehouse },
        { route: '#subscriptions', label: 'Recurring Subscriptions', icon: Calendar }
      ]
    },
    {
      group: 'Intelligence & Governance',
      links: [
        { route: '#customerTiers', label: 'Customer Tier Upgrades', icon: Award },
        { route: '#anomalies', label: 'Discount Anomalies', icon: ShieldAlert, badge: '3', badgeType: 'danger' }
      ]
    }
  ];

  const handleLinkClick = (route, e) => {
    e.preventDefault();
    onNavigate(route);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside className={`app-sidebar ${isMobileOpen ? 'open' : ''}`} id="app-sidebar">
      <div className="sidebar-header">
        <a href="#dashboard" onClick={(e) => handleLinkClick('#dashboard', e)} className="brand-logo">
          <div className="brand-mark">
            <svg className="icon" viewBox="0 0 24 24" style={{ stroke: '#ffffff', strokeWidth: 2.8 }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <div className="brand-info">
            <div className="brand-name">
              CLINCH
              <span className="brand-badge">360</span>
            </div>
            <div className="brand-tagline">DealFlow & Revenue Portal</div>
          </div>
        </a>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((group, gIdx) => (
          <div className="nav-group" key={gIdx}>
            <div className="nav-group-label">{group.group}</div>
            <ul className="nav-list">
              {group.links.map((link) => {
                const Icon = link.icon;
                const isActive = currentRoute === link.route;
                return (
                  <li key={link.route}>
                    <a
                      href={link.route}
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      onClick={(e) => handleLinkClick(link.route, e)}
                    >
                      <Icon className="icon" size={18} />
                      <span>{link.label}</span>
                      {link.badge && (
                        <span className={`nav-badge ${link.badgeType}`}>{link.badge}</span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="status-dot"></div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>Live RevOps Node</div>
              <div className="text-xs text-muted">Latency: 14ms | US-East</div>
            </div>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>v3.0 React</span>
        </div>
      </div>
    </aside>
  );
}
