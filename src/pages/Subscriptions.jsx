import React, { useState } from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { Modal } from '../components/common/Modal';
import {
  Calendar,
  Plus,
  Package,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit,
  Trash2,
  XCircle
} from 'lucide-react';

export function Subscriptions() {
  const {
    state,
    addRecurringPlan,
    updateRecurringPlan,
    deleteRecurringPlan,
    addCustomerSubscription,
    cancelCustomerSubscription,
    showToast
  } = useClinchStore();

  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'customer_subs'

  // Modals
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    productId: state.products[0]?.id || '',
    billingCycle: 'Monthly',
    recurringPrice: 2000,
    status: 'Active',
    description: ''
  });

  const [isSimQuoteOpen, setIsSimQuoteOpen] = useState(false);
  const [simQuoteForm, setSimQuoteForm] = useState({
    customerName: 'Vertex BioPharma Inc',
    customerTier: 'Gold',
    planId: state.subscriptions.recurringPlans[0]?.id || '',
    startDate: new Date().toISOString().split('T')[0]
  });

  const plans = state.subscriptions?.recurringPlans || [];
  const customerSubs = state.customerSubscriptions || [];

  const totalMRR = customerSubs
    .filter(s => s.status === 'Active')
    .reduce((acc, s) => {
      let monthly = s.finalPrice;
      if (s.billingCycle === 'Yearly') monthly = Math.round(s.finalPrice / 12);
      else if (s.billingCycle === 'Quarterly') monthly = Math.round(s.finalPrice / 3);
      return acc + monthly;
    }, 0);

  const activePlansCount = plans.filter(p => p.status === 'Active').length;
  const activeSubsCount = customerSubs.filter(s => s.status === 'Active').length;

  const handleOpenAddPlan = () => {
    setPlanForm({
      productId: state.products[0]?.id || '',
      billingCycle: 'Monthly',
      recurringPrice: 2000,
      status: 'Active',
      description: ''
    });
    setEditingPlan(null);
    setIsAddPlanOpen(true);
  };

  const handleOpenEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      productId: plan.productId,
      billingCycle: plan.billingCycle,
      recurringPrice: plan.recurringPrice,
      status: plan.status,
      description: plan.description || ''
    });
    setIsAddPlanOpen(true);
  };

  const handleSavePlan = (e) => {
    e.preventDefault();
    if (!planForm.productId || !planForm.recurringPrice) {
      showToast('Please select a product and recurring price', 'warning');
      return;
    }

    if (editingPlan) {
      updateRecurringPlan(editingPlan.id, {
        ...planForm,
        recurringPrice: parseFloat(planForm.recurringPrice) || 0
      });
    } else {
      const newId = `REC-PLAN-${Date.now().toString().slice(-4)}`;
      addRecurringPlan({
        id: newId,
        ...planForm,
        recurringPrice: parseFloat(planForm.recurringPrice) || 0
      });
    }
    setIsAddPlanOpen(false);
  };

  const handleSimulateQuote = (e) => {
    e.preventDefault();
    const plan = plans.find(p => p.id === simQuoteForm.planId);
    const product = state.products.find(p => p.id === plan?.productId);
    if (!plan || !product) return;

    let discountPct = 0;
    if (simQuoteForm.customerTier === 'Gold') discountPct = 15;
    else if (simQuoteForm.customerTier === 'Silver') discountPct = 8;
    else discountPct = 0;

    const finalPrice = Math.round(plan.recurringPrice * (1 - discountPct / 100));

    // compute next billing date
    const d = new Date(simQuoteForm.startDate);
    if (plan.billingCycle === 'Yearly') d.setFullYear(d.getFullYear() + 1);
    else if (plan.billingCycle === 'Quarterly') d.setMonth(d.getMonth() + 3);
    else d.setMonth(d.getMonth() + 1);

    const nextBillingDate = d.toISOString().split('T')[0];

    const newSub = {
      id: `SUB-CUST-${Date.now().toString().slice(-4)}`,
      customerName: simQuoteForm.customerName,
      customerTier: simQuoteForm.customerTier,
      planId: plan.id,
      productId: product.id,
      productName: product.name,
      recurringPrice: plan.recurringPrice,
      discountPct,
      finalPrice,
      billingCycle: plan.billingCycle,
      startDate: simQuoteForm.startDate,
      nextBillingDate,
      status: 'Active',
      autoRenew: true,
      lastInvoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`
    };

    addCustomerSubscription(newSub);
    setIsSimQuoteOpen(false);
    setActiveTab('customer_subs');
  };

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div className="module-title-group">
          <h1>Recurring Product & Subscription Plans</h1>
          <p>Configure recurring products and services that can be added to customer quotations.</p>
        </div>
        <div className="module-actions">
          <button className="btn btn-secondary" onClick={() => setIsSimQuoteOpen(true)}>
            <FileText className="icon icon-sm" size={15} />
            Simulate Quote to Subscription
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddPlan}>
            <Plus className="icon icon-sm" size={15} />
            New Recurring Plan
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="stat-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Active Recurring Plans</span>
            <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
              <Package size={18} />
            </div>
          </div>
          <div className="stat-value">
            {activePlansCount} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-muted)' }}>of {plans.length}</span>
          </div>
          <div className="stat-bottom">
            <span className="stat-delta positive">Available in Quotation Builder</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Active Subscriptions</span>
            <div className="stat-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-value">{activeSubsCount}</div>
          <div className="stat-bottom">
            <span className="stat-delta positive">Live Customer Accounts</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Contracted MRR Run-Rate</span>
            <div className="stat-icon" style={{ background: 'var(--color-purple-bg)', color: 'var(--color-purple)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="stat-value">${totalMRR.toLocaleString()}/mo</div>
          <div className="stat-bottom">
            <span className="stat-delta positive">Normalized Monthly Revenue</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Automated Billing Logic</span>
            <div className="stat-icon" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>Auto-Managed</div>
          <div className="stat-bottom">
            <span className="stat-delta neutral">Proration & cancellations automatic</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          Recurring Product Plans ({plans.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'customer_subs' ? 'active' : ''}`}
          onClick={() => setActiveTab('customer_subs')}
        >
          Active Customer Subscriptions ({customerSubs.length})
        </button>
      </div>

      {activeTab === 'plans' ? (
        <div className="table-card">
          <div className="table-toolbar">
            <div>
              <h3 className="card-title">Recurring Product Catalog Plans</h3>
              <p className="card-subtitle">Products and services configured for recurring recurring billing cycles.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleOpenAddPlan}>
              <Plus size={14} /> Add Recurring Plan
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>SKU Code</th>
                  <th>Billing Cycle</th>
                  <th>Recurring List Price</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }} className="text-muted">
                      No recurring plans created yet.
                    </td>
                  </tr>
                ) : (
                  plans.map(plan => {
                    const product = state.products.find(p => p.id === plan.productId);
                    return (
                      <tr key={plan.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {product?.name || plan.productId}
                          </div>
                          <div className="text-xs text-muted" style={{ marginTop: '0.15rem' }}>
                            {plan.description || product?.description}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', background: 'var(--bg-hover)', padding: '0.2rem 0.45rem', borderRadius: 'var(--radius-xs)' }}>
                            {product?.sku || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-purple">{plan.billingCycle}</span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                            ${plan.recurringPrice.toLocaleString()}
                          </strong>
                          <span className="text-xs text-muted"> / {plan.billingCycle.toLowerCase()}</span>
                        </td>
                        <td>
                          <span className={`badge ${plan.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                            {plan.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditPlan(plan)}>
                              <Edit size={14} /> Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                if (window.confirm('Delete this recurring plan?')) {
                                  deleteRecurringPlan(plan.id);
                                }
                              }}
                              style={{ color: 'var(--color-danger)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-toolbar">
            <div>
              <h3 className="card-title">Customer Subscription Contracts</h3>
              <p className="card-subtitle">Active recurring customer contracts generated from accepted quotations.</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsSimQuoteOpen(true)}>
              <Plus size={14} /> New Contract
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer & Tier</th>
                  <th>Subscribed Product</th>
                  <th>Billing Cycle</th>
                  <th>Contract Price</th>
                  <th>Next Billing Date</th>
                  <th>Auto-Renew</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {customerSubs.map(sub => (
                  <tr key={sub.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sub.customerName}</div>
                      <span className={`badge-tier badge-${sub.customerTier?.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                        {sub.customerTier} Tier
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{sub.productName}</div>
                      <div className="text-xs text-muted">Contract ID: {sub.id}</div>
                    </td>
                    <td>
                      <span className="badge badge-purple">{sub.billingCycle}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '1rem', color: 'var(--accent-primary)' }}>
                        ${sub.finalPrice.toLocaleString()}
                      </strong>
                      {sub.discountPct > 0 && (
                        <div className="text-xs text-muted">({sub.discountPct}% tier discount applied)</div>
                      )}
                    </td>
                    <td className="text-xs text-muted">{sub.nextBillingDate}</td>
                    <td>
                      <span className={`badge ${sub.autoRenew ? 'badge-success' : 'badge-warning'}`}>
                        {sub.autoRenew ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${sub.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {sub.status === 'Active' ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          onClick={() => {
                            if (window.confirm(`Cancel subscription for ${sub.customerName}? Access will remain active until ${sub.nextBillingDate}.`)) {
                              cancelCustomerSubscription(sub.id);
                            }
                          }}
                        >
                          <XCircle size={14} style={{ marginRight: '4px' }} /> Cancel
                        </button>
                      ) : (
                        <span className="text-xs text-muted">Cancelled ({sub.cancelledAt})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Recurring Plan Modal */}
      <Modal
        isOpen={isAddPlanOpen}
        onClose={() => setIsAddPlanOpen(false)}
        title={editingPlan ? 'Edit Recurring Product Plan' : 'Create Recurring Product Plan'}
        width="550px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setIsAddPlanOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSavePlan}>{editingPlan ? 'Update Plan' : 'Create Plan'}</button>
          </div>
        }
      >
        <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Product</label>
            <select
              className="form-control"
              value={planForm.productId}
              onChange={(e) => setPlanForm({ ...planForm, productId: e.target.value })}
            >
              {state.products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Billing Cycle</label>
              <select
                className="form-control"
                value={planForm.billingCycle}
                onChange={(e) => setPlanForm({ ...planForm, billingCycle: e.target.value })}
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Recurring Price ($) *</label>
              <input
                type="number"
                step="1"
                className="form-control"
                value={planForm.recurringPrice}
                onChange={(e) => setPlanForm({ ...planForm, recurringPrice: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Plan Description</label>
            <textarea
              className="form-control"
              rows={2}
              value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
              placeholder="Terms, SLA guarantees, or coverage details..."
            />
          </div>
        </form>
      </Modal>

      {/* Simulate Quote to Subscription Modal */}
      <Modal
        isOpen={isSimQuoteOpen}
        onClose={() => setIsSimQuoteOpen(false)}
        title="Simulate Quote to Subscription Conversion"
        width="550px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setIsSimQuoteOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSimulateQuote}>Convert & Activate</button>
          </div>
        }
      >
        <form onSubmit={handleSimulateQuote} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input
              type="text"
              className="form-control"
              value={simQuoteForm.customerName}
              onChange={(e) => setSimQuoteForm({ ...simQuoteForm, customerName: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Customer Tier</label>
              <select
                className="form-control"
                value={simQuoteForm.customerTier}
                onChange={(e) => setSimQuoteForm({ ...simQuoteForm, customerTier: e.target.value })}
              >
                <option value="Bronze">Bronze (0% Tier Disc)</option>
                <option value="Silver">Silver (8% Tier Disc)</option>
                <option value="Gold">Gold (15% Tier Disc)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Plan to Subscribe</label>
              <select
                className="form-control"
                value={simQuoteForm.planId}
                onChange={(e) => setSimQuoteForm({ ...simQuoteForm, planId: e.target.value })}
              >
                {plans.map(p => {
                  const prod = state.products.find(x => x.id === p.productId);
                  return (
                    <option key={p.id} value={p.id}>
                      {prod?.name || p.productId} (${p.recurringPrice}/{p.billingCycle})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={simQuoteForm.startDate}
              onChange={(e) => setSimQuoteForm({ ...simQuoteForm, startDate: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
