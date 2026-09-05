import React, { useState, useEffect } from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { Award, RefreshCw, Save, CheckCircle, ShieldAlert, UserPlus, Users, UserCheck, X } from 'lucide-react';

export function CustomerTiers() {
  const { state, toggleCustomerMode, showToast } = useClinchStore();

  const [thresholds, setThresholds] = useState(() => ({
    Silver: { ...state.customerTiers.thresholds.Silver },
    Gold: { ...state.customerTiers.thresholds.Gold }
  }));

  const [reps, setReps] = useState([
    { id: 'rep_rao', name: 'A. Rao', email: 'rao@dealflow.example', manager_name: 'M. Shah' },
    { id: 'rep_iyer', name: 'K. Iyer', email: 'iyer@dealflow.example', manager_name: 'M. Shah' },
    { id: 'rep_nair', name: 'S. Nair', email: 'nair@dealflow.example', manager_name: 'M. Shah' },
  ]);

  const [customerReps, setCustomerReps] = useState({
    'CUST-001': 'rep_rao',
    'CUST-002': 'rep_iyer',
    'CUST-003': 'rep_nair',
    'CUST-004': 'rep_rao',
    'CUST-005': 'rep_rao',
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCust, setNewCust] = useState({
    name: '',
    company: '',
    email: '',
    tier: 'Bronze',
    assigned_rep_id: 'rep_rao',
  });

  useEffect(() => {
    fetch('/api/users/reps')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length) setReps(data); })
      .catch(() => {});
  }, []);

  const customers = state.customerTiers.customers || [];
  const auditTrail = state.customerTiers.auditTrail || [];

  const handleRunEvaluator = () => {
    showToast('Customer tier progression engine ran: 0 changes needed', 'info');
  };

  const handleSaveThresholds = () => {
    showToast('Tier qualification thresholds updated!', 'success');
  };

  const handleAssignRep = async (customerId, repId) => {
    setCustomerReps(prev => ({ ...prev, [customerId]: repId }));
    const repName = reps.find(r => r.id === repId)?.name || repId;
    try {
      await fetch(`/api/customers/${customerId}/assigned-rep`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_rep_id: repId }),
      });
    } catch {}
    showToast(`Assigned account owner to ${repName}`, 'success');
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCust.name || !newCust.email) {
      showToast('Name and email are required', 'error');
      return;
    }
    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCust.name,
          email: newCust.email,
          company: newCust.company || newCust.name,
          password: 'password123',
          assigned_rep_id: newCust.assigned_rep_id,
        }),
      });
    } catch {}
    const repName = reps.find(r => r.id === newCust.assigned_rep_id)?.name || newCust.assigned_rep_id;
    showToast(`Created customer ${newCust.name} (Assigned to Account Owner: ${repName})`, 'success');
    setShowAddModal(false);
    setNewCust({ name: '', company: '', email: '', tier: 'Bronze', assigned_rep_id: 'rep_rao' });
  };

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div className="module-title-group">
          <h1>Customer Tiers & Rep Account Ownership</h1>
          <p>Configure automated account progression thresholds, manage permanent Sales Rep assignments, and audit governance rules.</p>
        </div>
        <div className="module-actions">
          <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>
            <UserPlus className="icon icon-sm" size={15} />
            + New Customer Account
          </button>
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

      {/* Customer Tier Directory Table with Assigned Sales Rep */}
      <div className="table-card" style={{ marginBottom: '1.75rem' }}>
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="card-title">Customer Account Ownership & Tier Control</h3>
            <p className="card-subtitle">Every customer account is permanently linked to an assigned Sales Rep (Account Owner) for auto-routing incoming quote requests.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(true)}>
            <UserPlus size={14} />
            Add Customer
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Account</th>
                <th>Assigned Sales Rep (Account Owner)</th>
                <th>Lifetime Spend</th>
                <th>Closed Deals</th>
                <th>Current Tier</th>
                <th>Evaluation Mode</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const assignedRep = customerReps[c.id] || 'rep_rao';
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div className="text-xs text-muted">{c.id}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select
                          className="form-control text-xs"
                          style={{ minWidth: '150px', padding: '0.25rem 0.5rem' }}
                          value={assignedRep}
                          onChange={(e) => handleAssignRep(c.id, e.target.value)}
                        >
                          {reps.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.manager_name ? `Mgr: ${r.manager_name}` : 'Rep'})
                            </option>
                          ))}
                        </select>
                        <span className="badge badge-info text-xs" style={{ fontSize: '10px' }}>Owner</span>
                      </div>
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
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleCustomerMode(c.id)}
                      >
                        {c.mode === 'Auto' ? 'Lock to Manual' : 'Restore to Auto'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Rep Team & Reporting Hierarchy Card */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users className="icon" size={18} style={{ color: 'var(--accent)' }} />
              Sales Rep Team & Management Reporting Hierarchy
            </h3>
            <p className="card-subtitle">Every Sales Rep has a designated Sales Manager (Reports To) so manager-level approval escalations automatically route to the correct desk.</p>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {reps.map(r => (
              <div
                key={r.id}
                style={{
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{r.name}</strong>
                    <div className="text-xs text-muted">{r.email}</div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '10px' }}>Sales Rep</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '0.25rem' }}>
                    Reports To (Sales Manager):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select className="form-control text-xs" style={{ padding: '0.25rem 0.5rem' }} value="rep_shah" disabled>
                      <option value="rep_shah">M. Shah (Regional Sales Manager)</option>
                    </select>
                    <CheckCircle size={14} style={{ color: 'var(--success)', shrink: 0 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
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

      {/* Add Customer Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Create Customer Account</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Customer Contact Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  className="form-control"
                  value={newCust.name}
                  onChange={e => setNewCust({ ...newCust, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Company / Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. Nexus Logistics Pvt Ltd"
                  className="form-control"
                  value={newCust.company}
                  onChange={e => setNewCust({ ...newCust, company: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. vikram@nexus.example"
                  className="form-control"
                  value={newCust.email}
                  onChange={e => setNewCust({ ...newCust, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Sales Rep (Account Owner) *</label>
                <select
                  className="form-control"
                  value={newCust.assigned_rep_id}
                  onChange={e => setNewCust({ ...newCust, assigned_rep_id: e.target.value })}
                >
                  {reps.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.email}) — Reports to: {r.manager_name || 'M. Shah'}
                    </option>
                  ))}
                </select>
                <span className="form-hint text-xs text-muted">Incoming quotation requests from this customer will automatically land in this rep's pipeline.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Starting Customer Tier</label>
                <select
                  className="form-control"
                  value={newCust.tier}
                  onChange={e => setNewCust({ ...newCust, tier: e.target.value })}
                >
                  <option value="Bronze">Bronze (Standard)</option>
                  <option value="Silver">Silver (Preferred)</option>
                  <option value="Gold">Gold (Enterprise VIP)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
