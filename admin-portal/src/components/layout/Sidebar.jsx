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
  Sparkles,
  ExternalLink
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
    },
    {
      group: 'Ecosystem Portals',
      links: [
        { route: 'http://localhost:5173', label: 'DealFlow Workspace (:5173)', icon: ExternalLink, isExternal: true },
        { route: 'http://localhost:8085', label: 'Showcase Landing (:8085)', icon: ExternalLink, isExternal: true },
        { route: 'http://localhost:5000', label: 'Clinch CPQ Bench (:5000)', icon: ExternalLink, isExternal: true }
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
          <img
            src="/CLINCH_LOGO_TRANSPARENT.png"
            alt="Clinch Logo"
            style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="brand-info">
            <div className="brand-name">
              DEALFLOW
              <span className="brand-badge">ADMIN</span>
            </div>
            <div className="brand-tagline">Revenue Operations Cockpit</div>
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
                if (link.isExternal) {
                  return (
                    <li key={link.route}>
                      <a
                        href={link.route}
                        className="nav-link"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon className="icon" size={16} />
                        <span>{link.label}</span>
                      </a>
                    </li>
                  );
                }
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
