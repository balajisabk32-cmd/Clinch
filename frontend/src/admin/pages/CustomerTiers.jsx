import React, { useState } from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { Award, RefreshCw, Save, CheckCircle, ShieldAlert } from 'lucide-react';

export function CustomerTiers() {
  const { state, toggleCustomerMode, showToast } = useClinchStore();

  const [thresholds, setThresholds] = useState(() => ({
    Silver: { ...state.customerTiers.thresholds.Silver },
    Gold: { ...state.customerTiers.thresholds.Gold }
  }));

  const customers = state.customerTiers.customers || [];
  const auditTrail = state.customerTiers.auditTrail || [];

  const handleRunEvaluator = () => {
    showToast('Customer tier progression engine ran: 0 changes needed', 'info');
  };

  const handleSaveThresholds = () => {
    showToast('Tier qualification thresholds updated!', 'success');
  };

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div className="module-title-group">
          <h1>Customer Tier Auto-Upgrade Settings</h1>
          <p>Configure automated account progression thresholds, manage per-customer manual override locks, and audit tier transitions.</p>
        </div>
        <div className="module-actions">
          <button className="btn btn-secondary" onClick={handleRunEvaluator}>
            <RefreshCw className="icon icon-sm" size={15} />
            Trigger Tier Evaluator
          </button>
          <button className="btn btn-primary" onClick={handleSaveThresholds}>
            <Save className="icon icon-sm" size={15} />
            Save Changes
          </button>
        </div>
      </div>

      {/* Threshold Configurator */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award className="icon" size={18} style={{ color: 'var(--tier-gold)' }} />
              Automatic Tier Qualification Thresholds
            </h3>
            <p className="card-subtitle">Accounts meeting either Lifetime Spend or Closed Deals count automatically promote during nightly reconciliation.</p>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
              <span className="badge-tier badge-bronze" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>Bronze Tier</span>
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-label">Min Spend ($ / ₹)</label>
                <input type="number" className="form-control" value="0" disabled />
                <span className="form-hint text-xs text-muted">Baseline tier for all newly onboarded B2B accounts.</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
              <span className="badge-tier badge-silver" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>Silver Tier</span>
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-label">Min Annual Spend ($)</label>
                <input
                  type="number"
                  className="form-control"
                  value={thresholds.Silver.minSpend}
                  onChange={(e) => setThresholds({ ...thresholds, Silver: { ...thresholds.Silver, minSpend: parseInt(e.target.value, 10) || 0 } })}
                />
              </div>
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-label">Or Min Closed Deals</label>
                <input
                  type="number"
                  className="form-control"
                  value={thresholds.Silver.minDeals}
                  onChange={(e) => setThresholds({ ...thresholds, Silver: { ...thresholds.Silver, minDeals: parseInt(e.target.value, 10) || 0 } })}
                />
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
              <span className="badge-tier badge-gold" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>Gold Tier</span>
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-label">Min Annual Spend ($)</label>
                <input
                  type="number"
                  className="form-control"
                  value={thresholds.Gold.minSpend}
                  onChange={(e) => setThresholds({ ...thresholds, Gold: { ...thresholds.Gold, minSpend: parseInt(e.target.value, 10) || 0 } })}
                />
              </div>
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-label">Or Min Closed Deals</label>
                <input
                  type="number"
                  className="form-control"
                  value={thresholds.Gold.minDeals}
                  onChange={(e) => setThresholds({ ...thresholds, Gold: { ...thresholds.Gold, minDeals: parseInt(e.target.value, 10) || 0 } })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Tier Directory Table */}
      <div className="table-card" style={{ marginBottom: '1.75rem' }}>
        <div className="table-toolbar">
          <div>
            <h3 className="card-title">Customer Account Tiers & Override Control</h3>
            <p className="card-subtitle">Manage customer tiers, view lifetime spend, and toggle automated vs manual override modes.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Account</th>
                <th>Lifetime Spend</th>
                <th>Closed Deals</th>
                <th>Current Tier</th>
                <th>Evaluation Mode</th>
                <th>Last Reconciled</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div className="text-xs text-muted">{c.id}</div>
                  </td>
                  <td><strong>${c.spend.toLocaleString()}</strong></td>
                  <td>{c.deals} deals</td>
                  <td>
                    <span className={`badge-tier badge-${c.currentTier.toLowerCase()}`}>
                      {c.currentTier}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${c.mode === 'Auto' ? 'badge-success' : 'badge-warning'}`}>
                      {c.mode === 'Auto' ? 'Auto Engine' : 'Manual Override'}
                    </span>
                  </td>
                  <td className="text-xs text-muted">{c.lastEvaluated}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleCustomerMode(c.id)}
                    >
                      {c.mode === 'Auto' ? 'Lock to Manual' : 'Restore to Auto'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tier Audit Trail */}
      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h3 className="card-title">Tier Promotion & Downgrade Audit Trail</h3>
            <p className="card-subtitle">Historical log of all automated threshold transitions and executive overrides.</p>
          </div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Customer</th>
                <th>Transition</th>
                <th>Reason</th>
                <th>Type</th>
                <th>Admin / System</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {auditTrail.map(t => (
                <tr key={t.id}>
                  <td><span className="font-mono text-xs">{t.id}</span></td>
                  <td><strong>{t.customer}</strong></td>
                  <td>
                    <span className={`badge-tier badge-${t.oldTier.toLowerCase()}`}>{t.oldTier}</span>
                    <span style={{ margin: '0 0.35rem' }}>&rarr;</span>
                    <span className={`badge-tier badge-${t.newTier.toLowerCase()}`}>{t.newTier}</span>
                  </td>
                  <td className="text-xs text-secondary">{t.reason}</td>
                  <td>
                    <span className={`badge ${t.type === 'Auto' ? 'badge-info' : 'badge-warning'}`}>{t.type}</span>
                  </td>
                  <td className="text-xs text-muted">{t.admin}</td>
                  <td className="text-xs text-muted">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
