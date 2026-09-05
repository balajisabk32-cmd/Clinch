import React, { useState } from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { Modal } from '../components/common/Modal';
import { Award, Package, GitMerge, Edit, Save, Plus, CheckCircle, Clock } from 'lucide-react';

export function Discounts() {
  const { state, saveTierCeilings, saveProductDiscountRule, saveApprovalChain, showToast } = useClinchStore();

  const [tierCeilings, setTierCeilings] = useState(() => ({
    Bronze: state.discountApproval.tierCeilings?.Bronze ?? 10,
    Silver: state.discountApproval.tierCeilings?.Silver ?? 20,
    Gold: state.discountApproval.tierCeilings?.Gold ?? 30
  }));

  const [activeAuditTab, setActiveAuditTab] = useState('quotes'); // 'quotes' | 'product_rules'
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodRuleForm, setProdRuleForm] = useState({ Bronze: 5, Silver: 10, Gold: 15 });

  const products = state.products;
  const productRules = state.discountApproval.productDiscountRules || {};
  const approvalChain = state.discountApproval.approvalChain || [];
  const quoteAudits = state.discountApproval.auditLogs || [];
  const ruleAudits = state.discountApproval.productRuleAuditLogs || [];

  const handleCeilingChange = (tier, val) => {
    setTierCeilings(prev => ({ ...prev, [tier]: parseInt(val, 10) }));
  };

  const handleSaveCeilings = () => {
    saveTierCeilings(tierCeilings);
  };

  const handleOpenEditRule = (p) => {
    const existing = productRules[p.id] || { Bronze: 5, Silver: 10, Gold: 15 };
    setEditingProduct(p);
    setProdRuleForm({
      Bronze: existing.Bronze || 5,
      Silver: existing.Silver || 10,
      Gold: existing.Gold || 15
    });
  };

  const handleSaveProductRule = () => {
    if (!editingProduct) return;
    saveProductDiscountRule(editingProduct.id, prodRuleForm);
    setEditingProduct(null);
  };

  // Helper to calculate effective caps
  const getEffective = (productId, tier) => {
    const pLimit = productRules[productId]?.[tier] ?? 10;
    const tCeiling = tierCeilings[tier] ?? 20;
    const effective = Math.min(pLimit, tCeiling);
    return {
      effective,
      isCapped: pLimit > tCeiling,
      pLimit,
      tCeiling
    };
  };

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div className="module-title-group">
          <h1>Discount Tier & Approval Chain Setup</h1>
          <p>Product-specific discount governance, customer tier ceilings, and multi-level approval workflows.</p>
        </div>
        <div className="module-actions">
          <button className="btn btn-primary" onClick={handleSaveCeilings}>
            <Save className="icon icon-sm" size={15} />
            Save Global Ceilings
          </button>
        </div>
      </div>

      {/* Explanatory Architecture Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)', borderColor: 'var(--accent-glow)', marginBottom: '1.75rem' }}>
        <div className="card-body" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>1</div>
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Customer Tier Ceiling</strong>
                <p className="text-xs text-muted" style={{ marginTop: '0.15rem' }}>Defines the absolute global maximum discount allowed per customer tier (Bronze, Silver, Gold).</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>2</div>
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Product Discount Limit</strong>
                <p className="text-xs text-muted" style={{ marginTop: '0.15rem' }}>Each individual product sets its own discount limits. Effective max is <code>MIN(Tier Ceiling, Product Limit)</code>.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>3</div>
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Approval Rules Workflow</strong>
                <p className="text-xs text-muted" style={{ marginTop: '0.15rem' }}>Automatically determines who must approve exceptions when a customer requests discounts above the effective limit.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Customer Tier Discount Ceilings (Global) */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award className="icon" size={18} style={{ color: 'var(--tier-gold)' }} />
              Customer Tier Discount Ceilings (Global Maxima)
            </h3>
            <p className="card-subtitle">Customer tier defines the overall ceiling. No product discount can exceed these global ceilings.</p>
          </div>
          <span className="badge badge-info">Global Boundary Rules</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {['Bronze', 'Silver', 'Gold'].map(tier => {
              const maxDiscount = tierCeilings[tier] ?? (tier === 'Bronze' ? 10 : tier === 'Silver' ? 20 : 30);
              return (
                <div key={tier} style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className={`badge-tier badge-${tier.toLowerCase()}`} style={{ minWidth: '90px', textAlign: 'center' }}>
                      {tier} Tier
                    </span>
                    <span className="text-xs text-muted">Global Maximum</span>
                  </div>
                  <div className="slider-container">
                    <input
                      type="range"
                      className="range-slider"
                      min="5"
                      max="45"
                      value={maxDiscount}
                      onChange={(e) => handleCeilingChange(tier, e.target.value)}
                    />
                    <span className="range-bubble">{maxDiscount}%</span>
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: '0.75rem' }}>
                    All {tier} tier customer quotes capped at &le; <strong style={{ color: 'var(--text-primary)' }}>{maxDiscount}%</strong>.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: Product Discount Rules Table */}
      <div className="table-card" style={{ marginBottom: '1.75rem' }}>
        <div className="table-toolbar">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package className="icon" size={18} style={{ color: 'var(--accent-primary)' }} />
              Product Discount Rules
            </h3>
            <p className="card-subtitle">Set the maximum discount allowed for each individual product. Effective limit is MIN(Customer Tier Ceiling, Product Limit).</p>
          </div>
          <span className="badge badge-purple">{products.length} Configured Products</span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Details</th>
                <th>Category</th>
                <th>Base Price</th>
                <th style={{ textAlign: 'center' }}>Bronze Limit</th>
                <th style={{ textAlign: 'center' }}>Silver Limit</th>
                <th style={{ textAlign: 'center' }}>Gold Limit</th>
                <th>Effective Caps per Tier</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const rules = productRules[p.id] || { Bronze: 5, Silver: 10, Gold: 15 };
                const bronzeEff = getEffective(p.id, 'Bronze');
                const silverEff = getEffective(p.id, 'Silver');
                const goldEff = getEffective(p.id, 'Gold');

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                        {p.sku}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{p.category}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>${p.basePrice.toLocaleString()}</strong>
                      <div className="text-xs text-muted">{p.unit}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--tier-bronze)', fontSize: '0.95rem' }}>{rules.Bronze || 0}%</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--tier-silver)', fontSize: '0.95rem' }}>{rules.Silver || 0}%</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--tier-gold)', fontSize: '0.95rem' }}>{rules.Gold || 0}%</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Bronze: </span>
                          <strong style={{ color: 'var(--tier-bronze)' }}>{bronzeEff.effective}%</strong>
                          {bronzeEff.isCapped && <span className="badge badge-warning text-xs" style={{ marginLeft: '0.25rem' }}>Capped by {bronzeEff.tCeiling}%</span>}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Silver: </span>
                          <strong style={{ color: 'var(--tier-silver)' }}>{silverEff.effective}%</strong>
                          {silverEff.isCapped && <span className="badge badge-warning text-xs" style={{ marginLeft: '0.25rem' }}>Capped by {silverEff.tCeiling}%</span>}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Gold: </span>
                          <strong style={{ color: 'var(--tier-gold)' }}>{goldEff.effective}%</strong>
                          {goldEff.isCapped && <span className="badge badge-warning text-xs" style={{ marginLeft: '0.25rem' }}>Capped by {goldEff.tCeiling}%</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditRule(p)}>
                        <Edit className="icon icon-sm" size={14} />
                        Edit Rules
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Approval Chain Flow Builder */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <GitMerge className="icon" size={18} style={{ color: 'var(--color-warning)' }} />
              Approval Chain Flow Builder
            </h3>
            <p className="card-subtitle">Approval rules determine who must approve discount requests when an exception is requested.</p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => showToast('New approval chain step builder opened', 'info')}
          >
            <Plus className="icon icon-sm" size={14} />
            Add Chain Tier
          </button>
        </div>
        <div className="card-body">
          <div className="chain-flow-builder">
            {approvalChain.map((step, idx) => (
              <React.Fragment key={step.id}>
                <div className="chain-step-card">
                  <div className="step-indicator">
                    <div className="step-number">{step.id}</div>
                    <div className="step-details">
                      <h4>{step.label}</h4>
                      <p>Trigger Range: <strong>{step.minDiscount}%</strong> to <strong>{step.maxDiscount}%</strong> discount</p>
                    </div>
                  </div>

                  <div className="step-approvers">
                    <span className="text-xs text-muted" style={{ marginRight: '0.5rem' }}>Approvers:</span>
                    {step.approvers.map((appr, aIdx) => (
                      <span className="approver-pill" key={aIdx}>
                        {appr}
                      </span>
                    ))}
                    <span className="badge badge-info" style={{ marginLeft: '0.75rem' }}>SLA: {step.timeSLA}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => showToast(`Editing Step ${step.id}`, 'info')}>
                      <Edit className="icon icon-sm" size={14} />
                    </button>
                  </div>
                </div>
                {idx < approvalChain.length - 1 && (
                  <div className="chain-arrow-connector">
                    &darr;
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4: Audit Trails */}
      <div className="table-card">
        <div className="tabs-nav" style={{ margin: '1rem 1rem 0' }}>
          <button
            className={`tab-btn ${activeAuditTab === 'quotes' ? 'active' : ''}`}
            onClick={() => setActiveAuditTab('quotes')}
          >
            Quote Discount Approvals ({quoteAudits.length})
          </button>
          <button
            className={`tab-btn ${activeAuditTab === 'product_rules' ? 'active' : ''}`}
            onClick={() => setActiveAuditTab('product_rules')}
          >
            Product Rule History Audit ({ruleAudits.length})
          </button>
        </div>

        <div className="table-responsive">
          {activeAuditTab === 'quotes' ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Deal Name</th>
                  <th>Rep</th>
                  <th>Discount</th>
                  <th>Approver</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th>Reason / Context</th>
                </tr>
              </thead>
              <tbody>
                {quoteAudits.map(log => (
                  <tr key={log.id}>
                    <td><span className="font-mono text-xs">{log.id}</span></td>
                    <td><strong>{log.deal}</strong></td>
                    <td>{log.rep}</td>
                    <td><strong style={{ color: 'var(--color-warning)' }}>{log.discount}</strong></td>
                    <td>{log.approver}</td>
                    <td>
                      <span className={`badge badge-${log.status === 'Approved' ? 'success' : 'danger'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="text-xs text-muted">{log.timestamp}</td>
                    <td className="text-xs text-secondary">{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Product</th>
                  <th>Previous Limits</th>
                  <th>New Limits</th>
                  <th>Modified By</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {ruleAudits.map(log => (
                  <tr key={log.id}>
                    <td><span className="font-mono text-xs">{log.id}</span></td>
                    <td><strong>{log.productName}</strong></td>
                    <td className="text-xs text-muted">{log.oldDiscount}</td>
                    <td><strong className="text-xs" style={{ color: 'var(--accent-primary)' }}>{log.newDiscount}</strong></td>
                    <td>{log.changedBy}</td>
                    <td className="text-xs text-muted">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Product Discount Rule Modal */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={`Edit Discount Rules: ${editingProduct?.name || ''}`}
        width="600px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setEditingProduct(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveProductRule}>Save Product Rule</button>
          </div>
        }
      >
        {editingProduct && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div><strong>SKU:</strong> <span className="font-mono">{editingProduct.sku}</span> | <strong>Base Price:</strong> ${editingProduct.basePrice}</div>
              <div className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>Global tier ceilings in effect: Bronze &le; {tierCeilings.Bronze}%, Silver &le; {tierCeilings.Silver}%, Gold &le; {tierCeilings.Gold}%</div>
            </div>

            {['Bronze', 'Silver', 'Gold'].map(tier => {
              const currentVal = prodRuleForm[tier] ?? 10;
              const ceiling = tierCeilings[tier] ?? 20;
              const eff = Math.min(currentVal, ceiling);

              return (
                <div key={tier} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge-tier badge-${tier.toLowerCase()}`}>{tier} Tier Maximum</span>
                    <span className="text-sm font-semibold">{currentVal}%</span>
                  </div>
                  <div className="slider-container">
                    <input
                      type="range"
                      className="range-slider"
                      min="0"
                      max="40"
                      value={currentVal}
                      onChange={(e) => setProdRuleForm({ ...prodRuleForm, [tier]: parseInt(e.target.value, 10) })}
                    />
                    <span className="range-bubble">{currentVal}%</span>
                  </div>
                  <div className="text-xs text-muted">
                    Effective cap for {tier} reps: <strong style={{ color: 'var(--text-primary)' }}>{eff}%</strong>
                    {currentVal > ceiling && <span className="text-warning" style={{ marginLeft: '0.5rem' }}>(Restricted by {ceiling}% global tier ceiling)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
