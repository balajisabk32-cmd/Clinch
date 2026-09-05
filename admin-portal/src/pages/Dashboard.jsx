import React from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { BarChart, LineChart } from '../components/common/Charts';
import {
  TrendingUp,
  Package,
  Clock,
  Percent,
  RefreshCw,
  Plus,
  BarChart2,
  Activity,
  Sliders,
  ShieldAlert,
  Calendar,
  CheckCircle
} from 'lucide-react';

export function Dashboard({ onNavigate, onOpenNewProductModal }) {
  const { state, showToast } = useClinchStore();
  const analytics = state.analytics;
  const kpis = analytics.kpis;

  const handleRefresh = () => {
    showToast('Live metrics refreshed from revenue pipeline!', 'info');
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="module-header">
        <div className="module-title-group">
          <h1>Revenue & Operations Cockpit</h1>
          <p>Real-time executive visibility across B2B deal velocity, discount governance, and fulfillment pipelines.</p>
        </div>
        <div className="module-actions">
          <button className="btn btn-secondary" onClick={handleRefresh}>
            <RefreshCw className="icon icon-sm" size={15} />
            Live Refresh
          </button>
          <button className="btn btn-primary" onClick={onOpenNewProductModal}>
            <Plus className="icon icon-sm" size={15} />
            Add Product
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Total Revenue</span>
            <div className="stat-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="stat-value">{kpis.totalRevenue}</div>
          <div className="stat-bottom">
            <span className="stat-delta positive">{kpis.revenueDelta}</span>
            <span className="text-muted">vs previous quarter</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Active Deals in Flight</span>
            <div className="stat-icon" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-value">{kpis.activeDeals}</div>
          <div className="stat-bottom">
            <span className="stat-delta neutral">{kpis.dealsPipeline}</span>
            <span className="text-muted">weighted pipeline value</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Pending Approvals</span>
            <div className="stat-icon" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value">{kpis.pendingApprovals}</div>
          <div className="stat-bottom">
            <span className="stat-delta positive">{kpis.approvalsDelta}</span>
            <span className="text-muted">under management review</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Avg Discount Given</span>
            <div className="stat-icon" style={{ background: 'var(--color-purple-bg)', color: 'var(--color-purple)' }}>
              <Percent size={18} />
            </div>
          </div>
          <div className="stat-value">{kpis.avgDiscount}</div>
          <div className="stat-bottom">
            <span className="stat-delta positive">{kpis.discountDelta}</span>
            <span className="text-muted">margin protection active</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart2 className="icon" size={18} style={{ color: 'var(--accent-primary)' }} />
                Revenue by Product Category
              </h3>
              <p className="card-subtitle">Quarter-to-date bookings split across portfolio product categories</p>
            </div>
            <span className="badge badge-info">Current Q3</span>
          </div>
          <div className="card-body" style={{ paddingTop: '0.5rem' }}>
            <BarChart data={analytics.categoryRevenue} height={230} prefix="$" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock className="icon" size={18} style={{ color: 'var(--color-info)' }} />
                Approval Turnaround Time (Hours)
              </h3>
              <p className="card-subtitle">7-day moving average resolution time for sales discount requests</p>
            </div>
            <span className="badge badge-success">Target &lt; 4.0h</span>
          </div>
          <div className="card-body" style={{ paddingTop: '0.5rem' }}>
            <LineChart data={analytics.turnaroundTrend} height={230} suffix="h" color="#38bdf8" />
          </div>
        </div>
      </div>

      {/* Activity & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity className="icon" size={18} style={{ color: 'var(--accent-primary)' }} />
              Recent System Activity Feed
            </h3>
            <span className="badge badge-purple">Realtime</span>
          </div>
          <div className="card-body">
            <div className="activity-feed">
              {analytics.recentActivity.map(act => (
                <div className="activity-item" key={act.id}>
                  <div className="activity-avatar" style={{ background: act.color }}>
                    <CheckCircle size={14} style={{ color: '#fff' }} />
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">{act.title}</div>
                    <div className="activity-time">{act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders className="icon" size={18} style={{ color: 'var(--color-warning)' }} />
              Admin Quick Actions
            </h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              onClick={() => onNavigate('#discounts')}
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '0.9rem 1rem', width: '100%', textAlign: 'left' }}
            >
              <Sliders className="icon" size={20} style={{ color: 'var(--color-warning)' }} />
              <div style={{ marginLeft: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Review Pending Approval Chains</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inspect 12 discount sign-offs pending manager review</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('#anomalies')}
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '0.9rem 1rem', width: '100%', textAlign: 'left' }}
            >
              <ShieldAlert className="icon" size={20} style={{ color: 'var(--color-danger)' }} />
              <div style={{ marginLeft: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Discount Anomaly Queue (3 High)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deals with discounts significantly above historical average</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('#subscriptions')}
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '0.9rem 1rem', width: '100%', textAlign: 'left' }}
            >
              <Calendar className="icon" size={20} style={{ color: 'var(--accent-primary)' }} />
              <div style={{ marginLeft: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Recurring Subscriptions</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manage recurring product plans and customer contracts</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
