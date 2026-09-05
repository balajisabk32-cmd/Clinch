import React, { useState } from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { Modal } from '../components/common/Modal';
import { Plus, Search, Edit, Trash2, Award, DollarSign, X } from 'lucide-react';

export function Products({ onOpenAddModal, isAddModalOpen, onCloseAddModal }) {
  const { state, addProduct, updateProduct, deleteProduct, showToast } = useClinchStore();
  const [activeTab, setActiveTab] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'SaaS Software',
    basePrice: '',
    unit: 'per unit',
    taxRate: 18,
    status: 'Active',
    description: '',
    variants: []
  });

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      category: 'SaaS Software',
      basePrice: '',
      unit: 'per unit',
      taxRate: 18,
      status: 'Active',
      description: '',
      variants: []
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    onOpenAddModal();
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      category: p.category,
      basePrice: p.basePrice,
      unit: p.unit,
      taxRate: p.taxRate,
      status: p.status,
      description: p.description,
      variants: p.variants ? JSON.parse(JSON.stringify(p.variants)) : []
    });
  };

  const handleAddVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { attribute: '', values: '', extraPrice: 0 }]
    }));
  };

  const handleUpdateVariant = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const handleRemoveVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.basePrice) {
      showToast('Please fill out Name, SKU, and Base Price', 'warning');
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        ...formData,
        basePrice: parseFloat(formData.basePrice) || 0,
        taxRate: parseFloat(formData.taxRate) || 0
      });
      setEditingProduct(null);
    } else {
      const newId = `PRD-${Date.now().toString().slice(-3)}`;
      addProduct({
        id: newId,
        ...formData,
        basePrice: parseFloat(formData.basePrice) || 0,
        taxRate: parseFloat(formData.taxRate) || 0
      });
      onCloseAddModal();
    }
    resetForm();
  };

  const products = state.products;
  const priceLists = state.priceLists;

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div className="module-title-group">
          <h1>Product & Price List Management</h1>
          <p>Maintain multi-tier product catalogs, configure variant attribute pricing, and define customer tier rate cards.</p>
        </div>
        <div className="module-actions">
          {activeTab === 'products' ? (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus className="icon icon-sm" size={15} />
              Add New Product
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => showToast('Price rules saved!', 'success')}>
              Save Price Rules
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Product Catalog ({products.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'pricelists' ? 'active' : ''}`}
          onClick={() => setActiveTab('pricelists')}
        >
          Tier Pricing Rules & Currencies
        </button>
      </div>

      {activeTab === 'products' ? (
        <div className="table-card">
          <div className="table-toolbar">
            <div className="table-search-box">
              <Search className="icon icon-sm search-icon" size={14} />
              <input
                type="text"
                placeholder="Search by name, SKU, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="table-filter-group">
              <label className="text-xs text-muted" style={{ marginRight: '0.25rem' }}>Category:</label>
              <select
                className="form-control"
                style={{ width: 'auto', height: '36px', padding: '0 0.75rem' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="SaaS Software">SaaS Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Professional Services">Professional Services</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Base Price</th>
                  <th>Unit</th>
                  <th>Tax %</th>
                  <th>Variants</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }} className="text-muted">
                      No products matched your search or category filter.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                          {p.sku}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', maxWidth: '320px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {p.description}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info">{p.category}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                          ${p.basePrice.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-secondary">{p.unit}</span>
                      </td>
                      <td>
                        <span className="text-sm font-semibold">{p.taxRate}%</span>
                      </td>
                      <td>
                        {p.variants && p.variants.length > 0 ? (
                          <span className="badge badge-purple" title={p.variants.map(v => `${v.attribute}: ${v.values} (+$${v.extraPrice})`).join(', ')}>
                            {p.variants.length} Variant{p.variants.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">Standard</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-success">
                          <span className="badge-dot" style={{ background: 'var(--color-success)' }}></span>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit product & variants"
                          >
                            <Edit className="icon icon-sm" size={14} />
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete ${p.name}?`)) {
                                deleteProduct(p.id);
                              }
                            }}
                            title="Delete product"
                            style={{ color: 'var(--color-danger)' }}
                          >
                            <Trash2 className="icon icon-sm" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>Showing {filteredProducts.length} of {products.length} products</span>
            <span className="text-xs text-muted">All SKU changes logged in audit vault</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award className="icon" size={18} style={{ color: 'var(--accent-primary)' }} />
                  Customer-Tier-Based Pricing Rules
                </h3>
                <p className="card-subtitle">Set rate-card price multipliers applied dynamically to quotes for each customer tier.</p>
              </div>
              <span className="badge badge-info">Auto-Calculated in Quotes</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                {Object.entries(priceLists.tiers).map(([tier, data]) => (
                  <div key={tier} style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span className={`badge-tier badge-${tier.toLowerCase()}`}>{tier} Tier</span>
                      <span className="text-xs text-muted">{data.discountLabel}</span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price Multiplier</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0.5"
                          max="1.2"
                          className="form-control"
                          defaultValue={data.multiplier}
                        />
                        <span className="text-xs text-secondary" style={{ whiteSpace: 'nowrap' }}>
                          ({Math.round((1 - data.multiplier) * 100)}% off)
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      E.g. $1,000 list item resolves to: <strong style={{ color: 'var(--text-primary)' }}>${Math.round(1000 * data.multiplier)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Currencies */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign className="icon" size={18} style={{ color: 'var(--color-success)' }} />
                  Global Pricing Currencies
                </h3>
                <p className="card-subtitle">Active FX rates for international quotation billing.</p>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {priceLists.currencies.map(c => (
                  <div key={c.code} style={{ padding: '1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{c.code} ({c.symbol})</strong>
                      {c.isBase && <span className="badge badge-success">Base Currency</span>}
                    </div>
                    <div className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>
                      Rate: 1 USD = {c.rate} {c.code}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isAddModalOpen || !!editingProduct}
        onClose={() => {
          if (editingProduct) setEditingProduct(null);
          else onCloseAddModal();
        }}
        title={editingProduct ? 'Edit Product & Variants' : 'Add New Product'}
        width="650px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (editingProduct) setEditingProduct(null);
                else onCloseAddModal();
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveProduct}>
              {editingProduct ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Apex Edge Gateway Router X9"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">SKU Code *</label>
              <input
                type="text"
                className="form-control"
                placeholder="HW-APEX-X9"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-control"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="SaaS Software">SaaS Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Professional Services">Professional Services</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Base Price ($) *</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="1200"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Billing Unit</label>
              <input
                type="text"
                className="form-control"
                placeholder="per user / yr"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tax Rate (%)</label>
              <input
                type="number"
                className="form-control"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Detailed product capabilities and specs..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Variants section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Product Variants / Surcharge Attributes</label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddVariant}
              >
                <Plus size={12} /> Add Variant
              </button>
            </div>
            {formData.variants.length === 0 ? (
              <p className="text-xs text-muted" style={{ margin: 0 }}>No variants configured. Click "Add Variant" to create surcharge tiers.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {formData.variants.map((v, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 32px', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Attribute (e.g. Storage)"
                      value={v.attribute}
                      onChange={(e) => handleUpdateVariant(idx, 'attribute', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Option (e.g. 1 TB High-Speed)"
                      value={v.values}
                      onChange={(e) => handleUpdateVariant(idx, 'values', e.target.value)}
                    />
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Extra $"
                      value={v.extraPrice}
                      onChange={(e) => handleUpdateVariant(idx, 'extraPrice', parseFloat(e.target.value) || 0)}
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => handleRemoveVariant(idx)}
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
