// Module: Warehouse & Fulfillment Setup (Module 3)
window.renderWarehousesModule = function (container) {
  const store = window.clinchStore;
  const allProducts = store.getProducts();
  
  // State within module
  let activeSubTab = 'stock'; // 'stock' | 'replenishment' | 'shipping'
  let selectedWarehouseId = 'WH-US-01'; // Default active warehouse for stock view
  let stockSearchQuery = '';

  function render() {
    const warehouses = store.getWarehouses();
    // Ensure selectedWarehouseId is valid
    if (!warehouses.some(w => w.id === selectedWarehouseId) && warehouses.length > 0) {
      selectedWarehouseId = warehouses[0].id;
    }

    const replenishment = store.getReplenishmentRules();
    const shipping = store.getShippingWeighting();
    const currentWh = warehouses.find(w => w.id === selectedWarehouseId) || warehouses[0];
    const currentStock = currentWh ? store.getWarehouseStock(currentWh.id) : [];

    // Filter stock
    const filteredStock = currentStock.filter(item => {
      const q = stockSearchQuery.toLowerCase();
      return item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    });

    // Count low stock items across all warehouses for badges
    const lowStockMap = {};
    let totalLowStockCount = 0;
    warehouses.forEach(wh => {
      const stock = store.getWarehouseStock(wh.id);
      const lowCount = stock.filter(s => s.quantity <= s.reorderThreshold).length;
      lowStockMap[wh.id] = lowCount;
      totalLowStockCount += lowCount;
    });

    container.innerHTML = `
      <div class="module-header animate-fade-in">
        <div class="module-title-group">
          <h1>Warehouse & Fulfillment Setup</h1>
          <p>Multi-location fulfillment management, per-warehouse stock inventory tracking, replenishment automation, and auto-split shipping logic.</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary" id="btn-open-add-warehouse">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Warehouse
          </button>
          ${activeSubTab === 'stock' ? `
            <button class="btn btn-primary" id="btn-open-add-stock">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              Add Stock to Hub
            </button>
          ` : activeSubTab === 'replenishment' ? `
            <button class="btn btn-primary" id="btn-save-replenish-rules">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Save Replenishment Rules
            </button>
          ` : `
            <button class="btn btn-primary" id="btn-save-shipping-weights">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Save Shipping Weights
            </button>
          `}
        </div>
      </div>

      <!-- Main Navigation Tabs -->
      <div class="tabs-nav animate-fade-in">
        <button class="tab-btn ${activeSubTab === 'stock' ? 'active' : ''}" data-subtab="stock">
          Warehouses & Stock Inventory (${warehouses.length} Hubs${totalLowStockCount > 0 ? ` · <span style="color: var(--color-danger);">${totalLowStockCount} Low</span>` : ''})
        </button>
        <button class="tab-btn ${activeSubTab === 'replenishment' ? 'active' : ''}" data-subtab="replenishment">
          Replenishment Rules & Triggers
        </button>
        <button class="tab-btn ${activeSubTab === 'shipping' ? 'active' : ''}" data-subtab="shipping">
          Shipping Cost Weightings & Auto-Split
        </button>
      </div>

      ${activeSubTab === 'stock' ? renderStockTab(warehouses, currentWh, filteredStock, lowStockMap) : 
        activeSubTab === 'replenishment' ? renderReplenishmentTab(replenishment) : 
        renderShippingTab(shipping)}
    `;

    setupEventListeners(warehouses, currentWh, replenishment, shipping);
  }

  // SUB-TAB 1: Warehouses CRUD & Stock Management per Warehouse
  function renderStockTab(warehouses, currentWh, filteredStock, lowStockMap) {
    return `
      <!-- Warehouses Cards Overview -->
      <div class="warehouse-grid animate-fade-in" style="margin-bottom: 2rem;">
        ${warehouses.map(wh => {
          const isSelected = wh.id === currentWh.id;
          const lowCount = lowStockMap[wh.id] || 0;
          const stockItems = store.getWarehouseStock(wh.id);
          const totalUnits = stockItems.reduce((acc, item) => acc + item.quantity, 0);

          return `
            <div class="warehouse-card ${isSelected ? 'selected-wh-card' : ''}" 
                 data-wh-id="${wh.id}"
                 title="Click anywhere to view ${wh.name} stock inventory"
                 style="${isSelected ? 'border-color: var(--accent-primary); box-shadow: 0 0 0 2px var(--accent-glow);' : ''}">
              <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">${wh.name}</h3>
                  </div>
                  <div class="text-xs text-muted" style="margin-top: 0.25rem; display: flex; align-items: flex-start; gap: 0.35rem; line-height: 1.3;">
                    <svg class="icon icon-sm" style="flex-shrink: 0; margin-top: 1px;" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <span>${wh.location}</span>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem;">
                  <span class="badge ${wh.status === 'Active' ? 'badge-success' : 'badge-warning'}">
                    <span class="badge-dot" style="background: ${wh.status === 'Active' ? 'var(--color-success)' : 'var(--color-warning)'};"></span>
                    ${wh.status}
                  </span>
                  <span class="badge badge-info" style="font-size: 0.68rem;">${wh.code}</span>
                </div>
              </div>

              <div style="background: var(--bg-card-subtle); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem;">
                <div>
                  <span class="text-muted">Contact Person:</span>
                  <strong style="color: var(--text-primary); margin-left: 0.25rem;">${wh.contactPerson || 'Logistics Lead'}</strong>
                </div>
                <div>
                  <span class="text-muted">SKUs:</span>
                  <strong style="color: var(--text-primary); margin-left: 0.25rem;">${stockItems.length}</strong>
                </div>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                <div>
                  ${lowCount > 0 ? `
                    <span class="badge badge-danger" title="${lowCount} SKU(s) below reorder threshold">
                      ⚠️ ${lowCount} Low Stock
                    </span>
                  ` : `
                    <span class="badge badge-success" style="font-size: 0.72rem;">Stock Healthy (${totalUnits.toLocaleString()} units)</span>
                  `}
                </div>

                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm btn-select-wh" data-id="${wh.id}">
                    ${isSelected ? 'Viewing Stock' : 'View Stock'}
                  </button>
                  <button class="btn btn-ghost btn-sm btn-edit-wh" data-id="${wh.id}" title="Edit Warehouse Info">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button class="btn btn-ghost btn-sm btn-del-wh" data-id="${wh.id}" title="Remove Warehouse" style="color: var(--color-danger);">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Specific Warehouse Stock Section -->
      <div class="table-card animate-fade-in" id="warehouse-stock-table-card">
        <div class="table-toolbar">
          <div>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <h3 class="card-title">
                <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                Inventory Stock at: <span style="color: var(--accent-primary);">${currentWh.name}</span>
              </h3>
              <span class="badge badge-info">${currentWh.code}</span>
              <span class="badge ${currentWh.status === 'Active' ? 'badge-success' : 'badge-warning'}">${currentWh.status}</span>
            </div>
            <p class="card-subtitle">
              Contact: <strong>${currentWh.contactPerson}</strong> | Location: <strong>${currentWh.location}</strong>
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div class="table-search-box">
              <svg class="icon icon-sm search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" id="stock-search-input" placeholder="Filter product name or SKU..." value="${stockSearchQuery}" />
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-quick-add-stock">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Stock Entry
            </button>
          </div>
        </div>

        <!-- Stock Table -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU Code</th>
                <th>Quantity Available</th>
                <th>Reorder Threshold</th>
                <th>Stock Status / Warning</th>
                <th>Last Restocked Date</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStock.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 3rem;" class="text-muted">
                    No stock inventory found in ${currentWh.name}. Click "Add Stock Entry" to assign product quantities to this warehouse.
                  </td>
                </tr>
              ` : filteredStock.map(item => {
                const isLow = item.quantity <= item.reorderThreshold;
                const rowBg = isLow ? 'background-color: rgba(239, 68, 68, 0.05);' : '';
                return `
                  <tr style="${rowBg}">
                    <td>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${item.productName}</div>
                      <div class="text-xs text-muted" style="margin-top: 0.15rem;">Product ID: ${item.productId}</div>
                    </td>
                    <td>
                      <span style="font-family: var(--font-mono); font-size: 0.8rem; background: var(--bg-hover); padding: 0.2rem 0.45rem; border-radius: var(--radius-xs); border: 1px solid var(--border-color);">
                        ${item.sku}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; align-items: baseline; gap: 0.35rem;">
                        <span style="font-size: 1.15rem; font-weight: 800; color: ${isLow ? 'var(--color-danger)' : 'var(--text-primary)'};">
                          ${item.quantity.toLocaleString()}
                        </span>
                        <span class="text-xs text-muted">units</span>
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; align-items: baseline; gap: 0.35rem;">
                        <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-secondary);">
                          ${item.reorderThreshold.toLocaleString()}
                        </span>
                        <span class="text-xs text-muted">units min</span>
                      </div>
                    </td>
                    <td>
                      ${isLow ? `
                        <span class="badge badge-danger" style="font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: var(--radius-sm);">
                          ⚠️ Low Stock Warning (${item.quantity} ≤ ${item.reorderThreshold})
                        </span>
                      ` : `
                        <span class="badge badge-success" style="font-size: 0.72rem;">
                          <span class="badge-dot" style="background: var(--color-success);"></span>
                          Optimal Supply (+${item.quantity - item.reorderThreshold} buffer)
                        </span>
                      `}
                    </td>
                    <td class="text-sm text-secondary">
                      <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <svg class="icon icon-sm text-muted" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>${item.lastRestocked || '2026-08-15'}</span>
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 0.4rem;">
                        <button class="btn btn-secondary btn-sm btn-edit-stock" data-pid="${item.productId}" data-wh="${currentWh.id}" title="Edit Stock & Threshold">
                          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          Edit
                        </button>
                        <button class="btn btn-ghost btn-sm btn-del-stock" data-pid="${item.productId}" data-wh="${currentWh.id}" title="Remove Stock Entry" style="color: var(--color-danger);">
                          <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="table-pagination">
          <span>Showing ${filteredStock.length} items in ${currentWh.name}</span>
          <span class="text-xs text-muted">A single product SKU can exist across multiple hubs with independent quantities</span>
        </div>
      </div>
    `;
  }

  // SUB-TAB 2: Replenishment Rules & Automated Trigger Controls
  function renderReplenishmentTab(replenishment) {
    return `
      <div style="max-width: 900px; margin: 0 auto;" class="animate-fade-in">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                <svg class="icon" style="color: var(--color-info);" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                Replenishment Rule Configuration
              </h3>
              <p class="card-subtitle">Automate inventory restocking flags and purchase order generation when stock falls below thresholds.</p>
            </div>
          </div>
          <div class="card-body">
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Global Default Min Safety Stock (Units)</label>
                  <input type="number" id="replenish-min-stock" class="form-control" value="${replenishment.minSafetyStock}" />
                  <span class="form-hint">Baseline threshold applied when specific product rule is not set.</span>
                </div>
                <div class="form-group">
                  <label class="form-label">Default Restock Order Batch Size (Units)</label>
                  <input type="number" id="replenish-reorder-qty" class="form-control" value="${replenishment.reorderQuantity}" />
                  <span class="form-hint">Quantity generated on automated purchase order drafts.</span>
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Supplier Restock Lead Time (Days)</label>
                  <input type="number" id="replenish-lead-days" class="form-control" value="${replenishment.leadTimeDays}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Primary Hardware & Component Supplier</label>
                  <input type="text" id="replenish-supplier" class="form-control" value="${replenishment.preferredSupplier}" />
                </div>
              </div>

              <div style="padding: 1.25rem; background: var(--bg-card-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Auto-Flag For Reorder When Below Threshold</div>
                    <div class="text-xs text-muted">Instantly flag low-stock SKUs on warehouse dash and trigger replenishment alerts</div>
                  </div>
                  <label class="switch-label">
                    <input type="checkbox" class="switch-input" id="replenish-auto-flag" ${replenishment.autoFlagBelowThreshold ? 'checked' : ''} />
                    <span class="switch-slider"></span>
                  </label>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                  <div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Automated ERP Purchase Order (PO) Creation</div>
                    <div class="text-xs text-muted">Create unapproved draft PO in NetSuite / SAP when inventory drops below safety threshold</div>
                  </div>
                  <label class="switch-label">
                    <input type="checkbox" class="switch-input" id="replenish-auto-po" ${replenishment.autoTriggerPO ? 'checked' : ''} />
                    <span class="switch-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // SUB-TAB 3: Shipping Cost Weighting & Auto-Split Simulator
  function renderShippingTab(shipping) {
    return `
      <div style="display: flex; flex-direction: column; gap: 1.75rem;" class="animate-fade-in">
        <!-- Shipping Cost Coefficients -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                Shipping Cost Weighting Settings (Auto-Split Engine)
              </h3>
              <p class="card-subtitle">These algorithmic weights decide which warehouse fulfills customer orders to minimize overall freight costs and transit delay.</p>
            </div>
          </div>
          <div class="card-body">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Weight Cost Factor ($/kg)</label>
                <input type="number" step="0.1" id="ship-weight-factor" class="form-control" value="${shipping.weightFactor}" />
                <span class="form-hint">Marginal freight charge per kilogram.</span>
              </div>
              <div class="form-group">
                <label class="form-label">Distance Cost Factor ($/mile)</label>
                <input type="number" step="0.01" id="ship-dist-factor" class="form-control" value="${shipping.distanceFactor}" />
                <span class="form-hint">Ground freight mileage coefficient.</span>
              </div>
              <div class="form-group">
                <label class="form-label">Express Air Priority Multiplier</label>
                <input type="number" step="0.1" id="ship-urgency-factor" class="form-control" value="${shipping.urgencyMultiplier}" />
                <span class="form-hint">Surcharge applied for overnight next-day delivery.</span>
              </div>
              <div class="form-group">
                <label class="form-label">Warehouse Handling Surcharge ($)</label>
                <input type="number" step="1" id="ship-handling-fee" class="form-control" value="${shipping.handlingSurcharge}" />
                <span class="form-hint">Fixed pick-and-pack fee per fulfillment node split.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Interactive Simulator -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                <svg class="icon" style="color: var(--color-purple);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                Fulfillment Auto-Split Simulator (Inventory-Aware)
              </h3>
              <p class="card-subtitle">Test how Clinch allocates quote line items across available regional stock.</p>
            </div>
            <span class="badge badge-purple">Live Order Routing Simulator</span>
          </div>
          <div class="card-body">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Destination Customer Region</label>
                <select id="sim-destination" class="form-control">
                  <option value="us_east">North America - East Coast (New York / Washington DC)</option>
                  <option value="us_west">North America - West Coast (San Francisco / Seattle)</option>
                  <option value="europe">Europe (London / Frankfurt / Paris)</option>
                  <option value="apac">Asia-Pacific / India (Bengaluru / Singapore)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Order Consignment Weight (kg)</label>
                <input type="number" id="sim-weight" class="form-control" value="65" min="1" max="2000" />
              </div>
              <div class="form-group">
                <label class="form-label">Shipping Priority</label>
                <select id="sim-priority" class="form-control">
                  <option value="standard">Standard Ground Logistics (3-5 Days)</option>
                  <option value="express">Guaranteed Express Air (Next-Day)</option>
                </select>
              </div>
            </div>

            <div style="margin-top: 1.25rem;">
              <button type="button" class="btn btn-secondary" id="btn-run-simulation">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Calculate Optimal Fulfillment Split
              </button>
            </div>

            <div id="sim-output-box" class="simulator-result"></div>
          </div>
        </div>
      </div>
    `;
  }

  function runSimulation(shipping) {
    const dest = document.getElementById('sim-destination')?.value || 'us_east';
    const weight = parseFloat(document.getElementById('sim-weight')?.value) || 65;
    const priority = document.getElementById('sim-priority')?.value || 'standard';
    const isExpress = priority === 'express';

    const weightCost = weight * (shipping?.weightFactor || 2.4);
    const handling = (shipping?.handlingSurcharge || 25);
    const speedMult = isExpress ? (shipping?.urgencyMultiplier || 1.6) : 1.0;

    let primaryNode = 'Ashburn Logistics Hub (US-EAST)';
    let secondaryNode = 'Silicon Valley Fulfillment (US-WEST)';
    let distance = 240;

    if (dest === 'us_west') {
      primaryNode = 'Silicon Valley Fulfillment (US-WEST)';
      secondaryNode = 'Ashburn Logistics Hub (US-EAST)';
      distance = 310;
    } else if (dest === 'europe') {
      primaryNode = 'Frankfurt Central Depot (EU-CENTRAL)';
      secondaryNode = 'Ashburn Logistics Hub (US-EAST)';
      distance = 420;
    } else if (dest === 'apac') {
      primaryNode = 'Bengaluru Tech Logistics Hub (IN-SOUTH)';
      secondaryNode = 'Jurong Port Warehouse (APAC-SG)';
      distance = 380;
    }

    const distCost = distance * (shipping?.distanceFactor || 0.12);
    const totalLogistics = Math.round((weightCost + distCost + handling * 2) * speedMult);

    const outBox = document.getElementById('sim-output-box');
    if (outBox) {
      outBox.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Optimal Multi-Warehouse Split Computed</div>
            <div class="text-xs text-muted">Delivery SLA: ${isExpress ? 'Next Business Day (Guaranteed Express Air)' : '3-4 Business Days (Ground Carrier)'}</div>
          </div>
          <div style="text-align: right;">
            <span class="text-xs text-muted">Estimated Freight Cost:</span>
            <div style="font-size: 1.45rem; font-weight: 800; color: var(--accent-primary);">$${totalLogistics.toLocaleString()}</div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
          <div class="split-route-item">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge badge-success">Split 1 (75% Order Volume)</span>
              <strong>${primaryNode}</strong>
            </div>
            <span class="text-xs text-muted">Local geographic proximity | 100% Stock Available</span>
          </div>

          <div class="split-route-item">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge badge-info">Split 2 (25% Order Volume)</span>
              <strong>${secondaryNode}</strong>
            </div>
            <span class="text-xs text-muted">Cross-dock fulfillment for specialized appliances</span>
          </div>
        </div>
      `;
    }
  }

  function setupEventListeners(warehouses, currentWh, replenishment, shipping) {
    // Sub-tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSubTab = btn.getAttribute('data-subtab');
        render();
      });
    });

    // Stock search
    const stockSearch = document.getElementById('stock-search-input');
    if (stockSearch) {
      stockSearch.addEventListener('input', (e) => {
        stockSearchQuery = e.target.value;
        render();
        const input = document.getElementById('stock-search-input');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    }

    // Warehouse card selection - clicking anywhere on the card
    container.querySelectorAll('.warehouse-card[data-wh-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        // If clicking edit or delete action buttons inside the card, do not trigger card selection
        if (e.target.closest('.btn-edit-wh') || e.target.closest('.btn-del-wh')) {
          return;
        }
        const whId = card.getAttribute('data-wh-id');
        if (whId) {
          selectedWarehouseId = whId;
          render();
          const tableCard = document.getElementById('warehouse-stock-table-card');
          if (tableCard) {
            tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // Warehouse card selection via explicit button
    container.querySelectorAll('.btn-select-wh').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedWarehouseId = btn.getAttribute('data-id');
        render();
        const tableCard = document.getElementById('warehouse-stock-table-card');
        if (tableCard) {
          tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Add Warehouse modal
    document.getElementById('btn-open-add-warehouse')?.addEventListener('click', () => {
      openWarehouseModal();
    });

    // Edit Warehouse modal
    container.querySelectorAll('.btn-edit-wh').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const wh = warehouses.find(w => w.id === id);
        if (wh) openWarehouseModal(wh);
      });
    });

    // Delete Warehouse
    container.querySelectorAll('.btn-del-wh').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm(`Remove warehouse ${id} and all its assigned stock records?`)) {
          store.deleteWarehouse(id);
          window.showToast(`Warehouse ${id} deleted`, 'info');
          render();
        }
      });
    });

    // Add Stock entry modal
    document.getElementById('btn-open-add-stock')?.addEventListener('click', () => {
      openStockModal(currentWh);
    });
    document.getElementById('btn-quick-add-stock')?.addEventListener('click', () => {
      openStockModal(currentWh);
    });

    // Edit Stock entry
    container.querySelectorAll('.btn-edit-stock').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-pid');
        const whId = btn.getAttribute('data-wh');
        const stockList = store.getWarehouseStock(whId);
        const item = stockList.find(s => s.productId === pid || s.sku === pid);
        const wh = warehouses.find(w => w.id === whId);
        if (item && wh) {
          openStockModal(wh, item);
        }
      });
    });

    // Remove Stock entry
    container.querySelectorAll('.btn-del-stock').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-pid');
        const whId = btn.getAttribute('data-wh');
        if (confirm(`Remove product ${pid} from this warehouse's stock list?`)) {
          store.removeWarehouseStock(whId, pid);
          window.showToast(`Product ${pid} removed from warehouse stock`, 'info');
          render();
        }
      });
    });

    // Save Replenishment Rules button
    document.getElementById('btn-save-replenish-rules')?.addEventListener('click', () => {
      replenishment.minSafetyStock = parseInt(document.getElementById('replenish-min-stock').value, 10) || 150;
      replenishment.reorderQuantity = parseInt(document.getElementById('replenish-reorder-qty').value, 10) || 600;
      replenishment.leadTimeDays = parseInt(document.getElementById('replenish-lead-days').value, 10) || 14;
      replenishment.preferredSupplier = document.getElementById('replenish-supplier').value.trim();
      replenishment.autoFlagBelowThreshold = document.getElementById('replenish-auto-flag').checked;
      replenishment.autoTriggerPO = document.getElementById('replenish-auto-po').checked;

      store.saveReplenishmentRules(replenishment);
      window.showToast('Replenishment rules and automated triggers saved successfully!', 'success');
      render();
    });

    // Save Shipping Weights button
    document.getElementById('btn-save-shipping-weights')?.addEventListener('click', () => {
      shipping.weightFactor = parseFloat(document.getElementById('ship-weight-factor').value) || 2.4;
      shipping.distanceFactor = parseFloat(document.getElementById('ship-dist-factor').value) || 0.12;
      shipping.urgencyMultiplier = parseFloat(document.getElementById('ship-urgency-factor').value) || 1.6;
      shipping.handlingSurcharge = parseFloat(document.getElementById('ship-handling-fee').value) || 25;

      store.saveShippingWeighting(shipping);
      window.showToast('Shipping cost weighting parameters saved!', 'success');
      runSimulation(shipping);
    });

    // Simulation triggers
    if (activeSubTab === 'shipping') {
      document.getElementById('btn-run-simulation')?.addEventListener('click', () => runSimulation(shipping));
      document.getElementById('sim-destination')?.addEventListener('change', () => runSimulation(shipping));
      document.getElementById('sim-priority')?.addEventListener('change', () => runSimulation(shipping));
      document.getElementById('sim-weight')?.addEventListener('input', () => runSimulation(shipping));
      runSimulation(shipping);
    }
  }

  // Warehouse CRUD Modal (Name, Location/Address, Contact Person, Active Status)
  function openWarehouseModal(existing = null) {
    const isEdit = !!existing;

    window.openModal({
      title: isEdit ? `Edit Warehouse Hub: ${existing.name}` : 'Establish New Warehouse Fulfillment Node',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Warehouse Name *</label>
              <input type="text" id="m-wh-name" class="form-control" required placeholder="e.g. Austin Regional Logistics" value="${existing ? existing.name : ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Internal Node Code *</label>
              <input type="text" id="m-wh-code" class="form-control" required placeholder="e.g. US-SOUTH" value="${existing ? existing.code : ''}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Location / Physical Address *</label>
            <input type="text" id="m-wh-loc" class="form-control" required placeholder="e.g. 1000 Logistics Pkwy, Austin, TX 78701" value="${existing ? existing.location : ''}" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Contact Person *</label>
              <input type="text" id="m-wh-contact" class="form-control" required placeholder="e.g. Samantha Hayes" value="${existing ? (existing.contactPerson || existing.manager || '') : ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Active Status *</label>
              <select id="m-wh-status" class="form-control">
                <option value="Active" ${!existing || existing.status === 'Active' ? 'selected' : ''}>Active (Operational)</option>
                <option value="Inactive" ${existing && existing.status === 'Inactive' ? 'selected' : ''}>Inactive (Maintenance / Offline)</option>
              </select>
            </div>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-wh-modal">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ${isEdit ? 'Update Warehouse' : 'Create Warehouse'}
        </button>
      `,
      onOpen: (body, footer) => {
        footer.querySelector('#btn-save-wh-modal').onclick = () => {
          const name = body.querySelector('#m-wh-name').value.trim();
          const code = body.querySelector('#m-wh-code').value.trim();
          const loc = body.querySelector('#m-wh-loc').value.trim();
          const contact = body.querySelector('#m-wh-contact').value.trim();
          const status = body.querySelector('#m-wh-status').value;

          if (!name || !code || !loc || !contact) {
            alert('Please fill in Name, Node Code, Location/Address, and Contact Person.');
            return;
          }

          if (isEdit) {
            store.updateWarehouse(existing.id, {
              name, code, location: loc, contactPerson: contact, status
            });
            window.showToast(`Warehouse "${name}" updated`, 'success');
          } else {
            const newId = `WH-${Math.floor(100 + Math.random() * 900)}`;
            store.addWarehouse({
              id: newId,
              name,
              code,
              location: loc,
              contactPerson: contact,
              status,
              capacity: 40000,
              utilized: 10000
            });
            selectedWarehouseId = newId;
            window.showToast(`Warehouse "${name}" created and ready for stock assignment`, 'success');
          }

          window.closeModal();
          render();
        };
      }
    });
  }

  // Stock Entry Modal: Add/Edit per product, per warehouse
  function openStockModal(warehouse, existingStock = null) {
    const isEdit = !!existingStock;
    const today = new Date().toISOString().split('T')[0];

    window.openModal({
      title: isEdit ? `Edit Stock: ${existingStock.productName} at ${warehouse.name}` : `Add Stock to ${warehouse.name}`,
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          ${isEdit ? `
            <div style="background: var(--bg-card-subtle); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">${existingStock.productName}</div>
              <div class="text-xs text-muted" style="font-family: var(--font-mono); margin-top: 0.2rem;">SKU: ${existingStock.sku}</div>
            </div>
          ` : `
            <div class="form-group">
              <label class="form-label">Select Catalog Product *</label>
              <select id="m-stock-product-select" class="form-control">
                ${allProducts.map(p => `
                  <option value="${p.id}" data-name="${p.name}" data-sku="${p.sku}">
                    ${p.name} (${p.sku}) - ${p.category}
                  </option>
                `).join('')}
              </select>
              <span class="form-hint">Products can exist across multiple warehouses with different stock levels in each.</span>
            </div>
          `}

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Quantity Available *</label>
              <input type="number" id="m-stock-qty" class="form-control" required min="0" placeholder="e.g. 150" value="${existingStock ? existingStock.quantity : 100}" />
            </div>
            <div class="form-group">
              <label class="form-label">Reorder Threshold *</label>
              <input type="number" id="m-stock-threshold" class="form-control" required min="1" placeholder="e.g. 25" value="${existingStock ? existingStock.reorderThreshold : 30}" />
              <span class="form-hint">Falls into Low Stock Warning if quantity ≤ this number.</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Last Restocked Date</label>
            <input type="date" id="m-stock-date" class="form-control" value="${existingStock ? (existingStock.lastRestocked || today) : today}" />
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-stock-modal">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ${isEdit ? 'Update Stock Entry' : 'Add to Warehouse Stock'}
        </button>
      `,
      onOpen: (body, footer) => {
        footer.querySelector('#btn-save-stock-modal').onclick = () => {
          const qty = parseInt(body.querySelector('#m-stock-qty').value, 10);
          const thresh = parseInt(body.querySelector('#m-stock-threshold').value, 10);
          const date = body.querySelector('#m-stock-date').value || today;

          if (isNaN(qty) || isNaN(thresh)) {
            alert('Please enter valid numerical values for Quantity and Threshold.');
            return;
          }

          if (isEdit) {
            store.updateWarehouseStock(warehouse.id, existingStock.productId, {
              quantity: qty,
              reorderThreshold: thresh,
              lastRestocked: date
            });
            window.showToast(`Stock updated for ${existingStock.productName} in ${warehouse.name}`, 'success');
          } else {
            const selectEl = body.querySelector('#m-stock-product-select');
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            const pId = selectEl.value;
            const pName = selectedOpt.getAttribute('data-name');
            const pSku = selectedOpt.getAttribute('data-sku');

            // Check if product already exists in this warehouse
            const existingList = store.getWarehouseStock(warehouse.id);
            const found = existingList.find(s => s.productId === pId);
            if (found) {
              store.updateWarehouseStock(warehouse.id, pId, {
                quantity: found.quantity + qty,
                reorderThreshold: thresh,
                lastRestocked: date
              });
              window.showToast(`Increased stock of ${pName} in ${warehouse.name} by ${qty} units`, 'success');
            } else {
              store.addWarehouseStock(warehouse.id, {
                productId: pId,
                productName: pName,
                sku: pSku,
                quantity: qty,
                reorderThreshold: thresh,
                lastRestocked: date
              });
              window.showToast(`Added ${qty} units of ${pName} to ${warehouse.name}`, 'success');
            }
          }

          window.closeModal();
          render();
        };
      }
    });
  }

  render();
};
