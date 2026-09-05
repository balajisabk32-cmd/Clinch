import React, { useState } from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { Modal } from '../components/common/Modal';
import {
  Warehouse as WarehouseIcon,
  Plus,
  Package,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Edit,
  Trash2,
  Search,
  Sliders,
  Send,
  Save
} from 'lucide-react';

export function Warehouses() {
  const {
    state,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    addStock,
    removeStock,
    saveReplenishmentRules,
    saveShippingWeighting,
    showToast
  } = useClinchStore();

  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'replenishment' | 'shipping'
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(() => state.warehouses[0]?.id || 'WH-US-01');
  const [stockSearch, setStockSearch] = useState('');

  // Modals
  const [isAddWhOpen, setIsAddWhOpen] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  const [whFormData, setWhFormData] = useState({ name: '', code: '', location: '', contactPerson: '', status: 'Active' });

  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [editingStockItem, setEditingStockItem] = useState(null);
  const [stockFormData, setStockFormData] = useState({ productId: '', quantity: 100, reorderThreshold: 30, lastRestocked: '' });

  // Replenishment & Shipping form state
  const [replenishForm, setReplenishForm] = useState(() => ({ ...state.replenishmentRules }));
  const [shippingForm, setShippingForm] = useState(() => ({ ...state.shippingWeighting }));

  // Simulator
  const [simProduct, setSimProduct] = useState(state.products[0]?.id || 'PRD-102');
  const [simQty, setSimQty] = useState(150);
  const [simResult, setSimResult] = useState(null);

  const warehouses = state.warehouses;
  const currentWh = warehouses.find(w => w.id === selectedWarehouseId) || warehouses[0];
  const currentStock = (currentWh && state.warehouseStock[currentWh.id]) || [];

  const filteredStock = currentStock.filter(s =>
    s.productName.toLowerCase().includes(stockSearch.toLowerCase()) ||
    s.sku.toLowerCase().includes(stockSearch.toLowerCase())
  );

  const handleOpenAddWh = () => {
    setWhFormData({ name: '', code: '', location: '', contactPerson: '', status: 'Active' });
    setIsAddWhOpen(true);
  };

  const handleOpenEditWh = (wh, e) => {
    e.stopPropagation();
    setEditingWh(wh);
    setWhFormData({ ...wh });
  };

  const handleSaveWh = (e) => {
    e.preventDefault();
    if (!whFormData.name || !whFormData.location) {
      showToast('Please provide a Warehouse Name and Location', 'warning');
      return;
    }

    if (editingWh) {
      updateWarehouse(editingWh.id, whFormData);
      setEditingWh(null);
    } else {
      const newId = `WH-${Date.now().toString().slice(-4)}`;
      addWarehouse({ id: newId, ...whFormData });
      setIsAddWhOpen(false);
      setSelectedWarehouseId(newId);
    }
  };

  const handleOpenAddStock = () => {
    const today = new Date().toISOString().split('T')[0];
    setStockFormData({
      productId: state.products[0]?.id || '',
      quantity: 100,
      reorderThreshold: 30,
      lastRestocked: today
    });
    setEditingStockItem(null);
    setIsAddStockOpen(true);
  };

  const handleOpenEditStock = (item) => {
    setEditingStockItem(item);
    setStockFormData({
      productId: item.productId,
      quantity: item.quantity,
      reorderThreshold: item.reorderThreshold,
      lastRestocked: item.lastRestocked
    });
    setIsAddStockOpen(true);
  };

  const handleSaveStock = (e) => {
    e.preventDefault();
    const product = state.products.find(p => p.id === stockFormData.productId);
    if (!product || !currentWh) return;

    addStock(currentWh.id, {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: parseInt(stockFormData.quantity, 10) || 0,
      reorderThreshold: parseInt(stockFormData.reorderThreshold, 10) || 0,
      lastRestocked: stockFormData.lastRestocked || new Date().toISOString().split('T')[0]
    });

    setIsAddStockOpen(false);
  };

  const handleRunSimulator = (e) => {
    e.preventDefault();
    const product = state.products.find(p => p.id === simProduct);
    const needed = parseInt(simQty, 10);
    const splits = [];
    let remaining = needed;

    // Pick warehouses sorted by highest available stock for this product
    const candidateHubs = warehouses.map(wh => {
      const stock = (state.warehouseStock[wh.id] || []).find(s => s.productId === simProduct);
      return {
        wh,
        available: stock ? stock.quantity : 0
      };
    }).sort((a, b) => b.available - a.available);

    for (const hub of candidateHubs) {
      if (remaining <= 0) break;
      if (hub.available > 0) {
        const take = Math.min(remaining, hub.available);
        splits.push({
          warehouseName: hub.wh.name,
          warehouseCode: hub.wh.code,
          quantity: take,
          estimatedCost: Math.round(take * 12.5 * (shippingForm.weightFactor || 1.2))
        });
        remaining -= take;
      }
    }

    setSimResult({
      productName: product?.name || simProduct,
      totalRequested: needed,
      totalFulfilled: needed - remaining,
      shortfall: remaining > 0 ? remaining : 0,
      splits
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div className="module-title-group">
          <h1>Warehouse & Fulfillment Setup</h1>
          <p>Multi-location fulfillment management, per-warehouse stock inventory tracking, replenishment automation, and auto-split shipping logic.</p>
        </div>
        <div className="module-actions">
          <button className="btn btn-secondary" onClick={handleOpenAddWh}>
            <Plus className="icon icon-sm" size={15} />
            Add Warehouse
          </button>
          {activeTab === 'stock' ? (
            <button className="btn btn-primary" onClick={handleOpenAddStock}>
              <Plus className="icon icon-sm" size={15} />
              Add Stock to Hub
            </button>
          ) : activeTab === 'replenishment' ? (
            <button className="btn btn-primary" onClick={() => saveReplenishmentRules(replenishForm)}>
              <Save className="icon icon-sm" size={15} />
              Save Replenishment Rules
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => saveShippingWeighting(shippingForm)}>
              <Save className="icon icon-sm" size={15} />
              Save Shipping Weights
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          Warehouses & Stock Inventory ({warehouses.length} Hubs)
        </button>
        <button
          className={`tab-btn ${activeTab === 'replenishment' ? 'active' : ''}`}
          onClick={() => setActiveTab('replenishment')}
        >
          Replenishment Rules & Triggers
        </button>
        <button
          className={`tab-btn ${activeTab === 'shipping' ? 'active' : ''}`}
          onClick={() => setActiveTab('shipping')}
        >
          Shipping Cost Weightings & Auto-Split
        </button>
      </div>

      {activeTab === 'stock' ? (
        <>
          {/* Warehouses Cards Grid */}
          <div className="warehouse-grid" style={{ marginBottom: '2rem' }}>
            {warehouses.map(wh => {
              const isSelected = currentWh?.id === wh.id;
              const stockItems = state.warehouseStock[wh.id] || [];
              const lowCount = stockItems.filter(s => s.quantity <= s.reorderThreshold).length;
              const totalUnits = stockItems.reduce((acc, item) => acc + item.quantity, 0);

              return (
                <div
                  key={wh.id}
                  className={`warehouse-card ${isSelected ? 'selected-wh-card' : ''}`}
                  onClick={() => setSelectedWarehouseId(wh.id)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--accent-primary)' : undefined,
                    boxShadow: isSelected ? '0 0 0 2px var(--accent-glow)' : undefined
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{wh.name}</h3>
                      <div className="text-xs text-muted" style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                        <MapPin size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{wh.location}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                      <span className={`badge ${wh.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                        {wh.status}
                      </span>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{wh.code}</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card-subtle)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                    <div>
                      <span className="text-muted">Contact:</span>
                      <strong style={{ color: 'var(--text-primary)', marginLeft: '0.25rem' }}>{wh.contactPerson || 'Lead'}</strong>
                    </div>
                    <div>
                      <span className="text-muted">SKUs:</span>
                      <strong style={{ color: 'var(--text-primary)', marginLeft: '0.25rem' }}>{stockItems.length}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', marginTop: '0.75rem' }}>
                    <div>
                      {lowCount > 0 ? (
                        <span className="badge badge-danger">{lowCount} Low Stock</span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Healthy ({totalUnits.toLocaleString()} units)</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWarehouseId(wh.id);
                        }}
                      >
                        {isSelected ? 'Viewing Stock' : 'View Stock'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => handleOpenEditWh(wh, e)}
                        title="Edit Warehouse"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete warehouse ${wh.name}?`)) {
                            deleteWarehouse(wh.id);
                          }
                        }}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stock Table for selected warehouse */}
          {currentWh && (
            <div className="table-card">
              <div className="table-toolbar">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Package className="icon" size={18} style={{ color: 'var(--accent-primary)' }} />
                      Inventory Stock at: <span style={{ color: 'var(--accent-primary)' }}>{currentWh.name}</span>
                    </h3>
                    <span className="badge badge-info">{currentWh.code}</span>
                  </div>
                  <p className="card-subtitle">
                    Contact: <strong>{currentWh.contactPerson}</strong> | Location: <strong>{currentWh.location}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="table-search-box">
                    <Search className="icon icon-sm search-icon" size={14} />
                    <input
                      type="text"
                      placeholder="Filter product name or SKU..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleOpenAddStock}>
                    <Plus size={14} /> Add Stock Entry
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>SKU Code</th>
                      <th>Quantity Available</th>
                      <th>Reorder Threshold</th>
                      <th>Stock Status / Warning</th>
                      <th>Last Restocked Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }} className="text-muted">
                          No stock inventory found in {currentWh.name}. Click "Add Stock Entry" to assign stock.
                        </td>
                      </tr>
                    ) : (
                      filteredStock.map(item => {
                        const isLow = item.quantity <= item.reorderThreshold;
                        return (
                          <tr key={item.productId} style={{ backgroundColor: isLow ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{item.productName}</div>
                              <div className="text-xs text-muted" style={{ marginTop: '0.15rem' }}>ID: {item.productId}</div>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', background: 'var(--bg-hover)', padding: '0.2rem 0.45rem', borderRadius: 'var(--radius-xs)' }}>
                                {item.sku}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: isLow ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                                {item.quantity.toLocaleString()}
                              </span>
                              <span className="text-xs text-muted" style={{ marginLeft: '0.25rem' }}>units</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {item.reorderThreshold.toLocaleString()}
                              </span>
                              <span className="text-xs text-muted" style={{ marginLeft: '0.25rem' }}>min</span>
                            </td>
                            <td>
                              {isLow ? (
                                <span className="badge badge-danger">
                                  <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                                  Low Stock Warning
                                </span>
                              ) : (
                                <span className="badge badge-success">
                                  <CheckCircle size={12} style={{ marginRight: '4px' }} />
                                  Optimal
                                </span>
                              )}
                            </td>
                            <td className="text-xs text-muted">{item.lastRestocked}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditStock(item)}>
                                  <Edit size={14} /> Edit
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    if (window.confirm(`Remove ${item.productName} from this warehouse?`)) {
                                      removeStock(currentWh.id, item.productId);
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
          )}
        </>
      ) : activeTab === 'replenishment' ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Global Replenishment Rules & Triggers</h3>
            <p className="card-subtitle">Automated purchase order thresholds and lead-time buffering across all regional hubs.</p>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Minimum Safety Stock Level</label>
                <input
                  type="number"
                  className="form-control"
                  value={replenishForm.minSafetyStock}
                  onChange={(e) => setReplenishForm({ ...replenishForm, minSafetyStock: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Reorder Batch Quantity</label>
                <input
                  type="number"
                  className="form-control"
                  value={replenishForm.reorderQuantity}
                  onChange={(e) => setReplenishForm({ ...replenishForm, reorderQuantity: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Replenishment Lead Time (Days)</label>
                <input
                  type="number"
                  className="form-control"
                  value={replenishForm.leadTimeDays}
                  onChange={(e) => setReplenishForm({ ...replenishForm, leadTimeDays: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Hardware Supplier</label>
                <input
                  type="text"
                  className="form-control"
                  value={replenishForm.preferredSupplier}
                  onChange={(e) => setReplenishForm({ ...replenishForm, preferredSupplier: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <input
                type="checkbox"
                id="autoPO"
                className="switch-input"
                checked={replenishForm.autoTriggerPO}
                onChange={(e) => setReplenishForm({ ...replenishForm, autoTriggerPO: e.target.checked })}
              />
              <div>
                <label htmlFor="autoPO" style={{ fontWeight: 700, cursor: 'pointer' }}>Auto-generate Draft Purchase Order (PO)</label>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Automatically queue vendor replenishment PO when available quantity falls below reorder threshold</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Shipping Cost Weighting */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Shipping Cost Weighting Configuration</h3>
              <p className="card-subtitle">Factors used by the multi-warehouse auto-split algorithm to route orders cost-effectively.</p>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Weight Surcharge ($/kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={shippingForm.weightFactor}
                    onChange={(e) => setShippingForm({ ...shippingForm, weightFactor: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Distance Surcharge ($/mile)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={shippingForm.distanceFactor}
                    onChange={(e) => setShippingForm({ ...shippingForm, distanceFactor: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Handling Base Surcharge ($)</label>
                  <input
                    type="number"
                    step="1"
                    className="form-control"
                    value={shippingForm.handlingSurcharge}
                    onChange={(e) => setShippingForm({ ...shippingForm, handlingSurcharge: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Auto-Split Simulator */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Multi-Warehouse Order Auto-Split Simulator</h3>
              <p className="card-subtitle">Test how Clinch allocates quantities across regional hubs when an order exceeds single-hub capacity.</p>
            </div>
            <div className="card-body">
              <form onSubmit={handleRunSimulator} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 2, minWidth: '240px' }}>
                  <label className="form-label">Select Product</label>
                  <select
                    className="form-control"
                    value={simProduct}
                    onChange={(e) => setSimProduct(e.target.value)}
                  >
                    {state.products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
                  <label className="form-label">Order Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={simQty}
                    onChange={(e) => setSimQty(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ height: '40px' }}>
                  <Send size={15} style={{ marginRight: '6px' }} /> Simulate Split
                </button>
              </form>

              {simResult && (
                <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <strong>Simulation Result: {simResult.productName}</strong>
                    <span>Requested: <strong>{simResult.totalRequested}</strong> | Fulfilled: <strong style={{ color: 'var(--color-success)' }}>{simResult.totalFulfilled}</strong></span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {simResult.splits.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <div>
                          <strong>{s.warehouseName}</strong> <span className="badge badge-info text-xs">{s.warehouseCode}</span>
                        </div>
                        <div>
                          Units Allocated: <strong>{s.quantity}</strong> | Est. Shipping: <strong>${s.estimatedCost}</strong>
                        </div>
                      </div>
                    ))}
                    {simResult.shortfall > 0 && (
                      <div style={{ padding: '0.65rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>
                        Shortfall of <strong>{simResult.shortfall} units</strong>. Backorder or replenishment PO required.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Warehouse Modal */}
      <Modal
        isOpen={isAddWhOpen || !!editingWh}
        onClose={() => {
          setIsAddWhOpen(false);
          setEditingWh(null);
        }}
        title={editingWh ? 'Edit Warehouse Hub' : 'Add Fulfillment Warehouse'}
        width="550px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => { setIsAddWhOpen(false); setEditingWh(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveWh}>{editingWh ? 'Update Hub' : 'Register Hub'}</button>
          </div>
        }
      >
        <form onSubmit={handleSaveWh} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Warehouse Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Chicago Logistics Hub"
              value={whFormData.name}
              onChange={(e) => setWhFormData({ ...whFormData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Hub Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. US-MIDWEST"
                value={whFormData.code}
                onChange={(e) => setWhFormData({ ...whFormData, code: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control"
                value={whFormData.status}
                onChange={(e) => setWhFormData({ ...whFormData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Location / Address *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Full address and postal code"
              value={whFormData.location}
              onChange={(e) => setWhFormData({ ...whFormData, location: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Person</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Mark Robinson"
              value={whFormData.contactPerson}
              onChange={(e) => setWhFormData({ ...whFormData, contactPerson: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Add / Edit Stock Modal */}
      <Modal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        title={editingStockItem ? `Edit Stock: ${editingStockItem.productName}` : `Add Stock to ${currentWh?.name}`}
        width="500px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setIsAddStockOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveStock}>{editingStockItem ? 'Save Stock' : 'Add Stock'}</button>
          </div>
        }
      >
        <form onSubmit={handleSaveStock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Product</label>
            <select
              className="form-control"
              value={stockFormData.productId}
              onChange={(e) => setStockFormData({ ...stockFormData, productId: e.target.value })}
              disabled={!!editingStockItem}
            >
              {state.products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Quantity Available *</label>
              <input
                type="number"
                className="form-control"
                value={stockFormData.quantity}
                onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reorder Threshold *</label>
              <input
                type="number"
                className="form-control"
                value={stockFormData.reorderThreshold}
                onChange={(e) => setStockFormData({ ...stockFormData, reorderThreshold: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Last Restocked Date</label>
            <input
              type="date"
              className="form-control"
              value={stockFormData.lastRestocked}
              onChange={(e) => setStockFormData({ ...stockFormData, lastRestocked: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
