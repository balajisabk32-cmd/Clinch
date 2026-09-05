import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { Menu, Search, Moon, Sun, Bell, ChevronDown } from 'lucide-react';

export function Topbar({ currentTitle, onToggleMobileSidebar, onOpenSearch }) {
  const { theme, toggleTheme } = useTheme();
  // The signed-in administrator, not a hardcoded "Dave Admin" -- showing a name
  // that belongs to nobody makes every audit trail on this screen a fiction.
  const { user } = useAuth();
  const initials = (user?.name || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const ROLE_TITLE = {
    admin: 'Platform Administrator',
    manager: 'Sales Manager',
    finance: 'Finance / Operations',
    rep: 'Sales Representative',
  };

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          className="btn-ghost sidebar-toggle-btn"
          id="sidebar-toggle-btn"
          aria-label="Toggle Navigation"
          onClick={onToggleMobileSidebar}
        >
          <Menu className="icon" size={20} />
        </button>

        <div className="breadcrumb-trail">
          <span className="breadcrumb-root">Clinch Ops</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current" id="breadcrumb-current">{currentTitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Global Omni-Search Trigger */}
        <button
          className="topbar-search-btn global-search-trigger"
          id="topbar-search-trigger"
          onClick={onOpenSearch}
        >
          <Search className="icon icon-sm" size={15} />
          <span className="search-placeholder">Quick search (rules, products, tiers)...</span>
          <span className="search-kbd">Ctrl K</span>
        </button>

        {/* Dark/Light Theme Switcher */}
        <button
          className="btn-icon theme-toggle-btn"
          id="theme-toggle-btn"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="icon icon-sun" size={18} /> : <Moon className="icon icon-moon" size={18} />}
        </button>

        {/* Notifications */}
        <button className="btn-icon notification-btn" id="notification-btn" aria-label="View notifications">
          <Bell className="icon" size={18} />
          <span className="notification-dot"></span>
        </button>

        {/* User Profile */}
        <div className="user-profile-menu">
          <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #00a3e0 0%, #0284c7 100%)', color: '#ffffff', fontWeight: 'bold' }}>{initials}</div>
          <div className="user-details">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{ROLE_TITLE[user?.role] || user?.role}</span>
          </div>
          <ChevronDown className="icon icon-sm" size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </header>
  );
}
