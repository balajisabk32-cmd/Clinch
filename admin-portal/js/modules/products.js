// Module: Product & Price List Management (Module 1)
window.renderProductsModule = function (container) {
  const store = window.clinchStore;
  let activeTab = 'products'; // 'products' or 'pricelists'
  let searchQuery = '';
  let selectedCategory = 'all';

  function render() {
    const products = store.getProducts();
    const priceLists = store.getPriceLists();

    const filteredProducts = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      return matchSearch && matchCat;
    });

    container.innerHTML = `
      <div class="module-header animate-fade-in">
        <div class="module-title-group">
          <h1>Product & Price List Management</h1>
          <p>Maintain multi-tier product catalogs, configure variant attribute pricing, and define customer tier rate cards.</p>
        </div>
        <div class="module-actions">
          ${activeTab === 'products' ? `
            <button class="btn btn-primary" id="btn-open-add-product">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add New Product
            </button>
          ` : `
            <button class="btn btn-primary" id="btn-save-pricelists">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Save Price Rules
            </button>
          `}
        </div>
      </div>

      <!-- Module Navigation Tabs -->
      <div class="tabs-nav animate-fade-in">
        <button class="tab-btn ${activeTab === 'products' ? 'active' : ''}" data-tab="products">
          Product Catalog (${products.length})
        </button>
        <button class="tab-btn ${activeTab === 'pricelists' ? 'active' : ''}" data-tab="pricelists">
          Tier Pricing Rules & Currencies
        </button>
      </div>

      ${activeTab === 'products' ? renderProductsTab(filteredProducts, products) : renderPriceListsTab(priceLists)}
    `;

    setupEventListeners();
  }

  function renderProductsTab(filteredProducts, products = []) {
    return `
      <div class="table-card animate-fade-in">
        <div class="table-toolbar">
          <div class="table-search-box">
            <svg class="icon icon-sm search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="prod-search-input" placeholder="Search by name, SKU, or description..." value="${searchQuery}" />
          </div>
          <div class="table-filter-group">
            <label class="text-xs text-muted" style="margin-right: 0.25rem;">Category:</label>
            <select class="form-control" id="prod-cat-filter" style="width: auto; height: 36px; padding: 0 0.75rem;">
              <option value="all" ${selectedCategory === 'all' ? 'selected' : ''}>All Categories</option>
              <option value="SaaS Software" ${selectedCategory === 'SaaS Software' ? 'selected' : ''}>SaaS Software</option>
              <option value="Hardware" ${selectedCategory === 'Hardware' ? 'selected' : ''}>Hardware</option>
              <option value="Professional Services" ${selectedCategory === 'Professional Services' ? 'selected' : ''}>Professional Services</option>
            </select>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product Details</th>
                <th>Category</th>
                <th>Base Price</th>
                <th>Unit</th>
                <th>Tax %</th>
                <th>Variants</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 3rem;" class="text-muted">
                    No products matched your search or category filter.
                  </td>
                </tr>
              ` : filteredProducts.map(p => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${p.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 0.15rem;">
                      ${p.sku}
                    </div>
                    <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem; max-width: 320px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                      ${p.description}
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-info">${p.category}</span>
                  </td>
                  <td>
                    <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">$${p.basePrice.toLocaleString()}</span>
                  </td>
                  <td>
                    <span class="text-sm text-secondary">${p.unit}</span>
                  </td>
                  <td>
                    <span class="text-sm font-semibold">${p.taxRate}%</span>
                  </td>
                  <td>
                    ${p.variants && p.variants.length > 0 ? `
                      <span class="badge badge-purple" title="${p.variants.map(v => `${v.attribute}: ${v.values} (+$${v.extraPrice})`).join(', ')}">
                        ${p.variants.length} Variant${p.variants.length > 1 ? 's' : ''}
                      </span>
                    ` : `<span class="text-muted text-xs">Standard</span>`}
                  </td>
                  <td>
                    <span class="badge badge-success">
                      <span class="badge-dot" style="background: var(--color-success);"></span>
                      ${p.status}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 0.4rem;">
                      <button class="btn btn-secondary btn-sm btn-edit-product" data-id="${p.id}" title="Edit product & variants">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                      </button>
                      <button class="btn btn-ghost btn-sm btn-delete-product" data-id="${p.id}" title="Delete product" style="color: var(--color-danger);">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="table-pagination">
          <span>Showing ${filteredProducts.length} of ${products.length} products</span>
          <span class="text-xs text-muted">All SKU changes logged in audit vault</span>
        </div>
      </div>
    `;
  }

  function renderPriceListsTab(priceLists) {
    return `
      <div style="display: flex; flex-direction: column; gap: 1.75rem;" class="animate-fade-in">
        <!-- Customer-Tier-Based Pricing Rules -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                Customer-Tier-Based Pricing Rules
              </h3>
              <p class="card-subtitle">Set rate-card price multipliers applied dynamically to quotes for each customer tier.</p>
            </div>
            <span class="badge badge-info">Auto-Calculated in Quotes</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem;">
              ${Object.entries(priceLists.tiers).map(([tier, data]) => `
                <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <span class="badge-tier badge-${tier.toLowerCase()}">${tier} Tier</span>
                    <span class="text-xs text-muted">${data.discountLabel}</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Price Multiplier</label>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <input type="number" step="0.01" min="0.5" max="1.2" class="form-control tier-multiplier-input" data-tier="${tier}" value="${data.multiplier}" />
                      <span class="text-xs text-secondary" style="white-space: nowrap;">
                        (${Math.round((1 - data.multiplier) * 100)}% off)
                      </span>
                    </div>
                  </div>
                  <div style="margin-top: 0.75rem; font-size: 0.78rem; color: var(--text-muted);">
                    E.g. $1,000 list item resolves to: <strong style="color: var(--text-primary);">$${Math.round(1000 * data.multiplier)}</strong>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Currency Exchange Settings -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                <svg class="icon" style="color: var(--color-success);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg>
                Supported Platform Currencies & FX Rates
              </h3>
              <p class="card-subtitle">Base settlement currency is USD. Active FX conversion rates for multi-national quotation.</p>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-sync-fx">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              Sync FX Feed
            </button>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem;">
              ${priceLists.currencies.map(curr => `
                <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.2rem; font-weight: 800; color: var(--accent-primary);">${curr.symbol}</span>
                      <strong style="font-size: 0.95rem;">${curr.code}</strong>
                    </div>
                    ${curr.isBase ? `<span class="badge badge-success">Base Currency</span>` : `<span class="text-xs text-muted">Active</span>`}
                  </div>
                  <div class="form-group" style="margin-top: 0.5rem;">
                    <label class="form-label">Exchange Rate (vs 1 USD)</label>
                    <input type="number" step="0.001" class="form-control currency-rate-input" data-code="${curr.code}" value="${curr.rate}" ${curr.isBase ? 'disabled' : ''} />
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function setupEventListeners() {
    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });

    // Search and filter
    const searchInput = document.getElementById('prod-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        render();
        const input = document.getElementById('prod-search-input');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    }

    const catFilter = document.getElementById('prod-cat-filter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        selectedCategory = e.target.value;
        render();
      });
    }

    // Add Product button
    document.getElementById('btn-open-add-product')?.addEventListener('click', () => {
      openProductModal();
    });

    // Edit Product buttons
    container.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const prod = store.getProducts().find(p => p.id === id);
        if (prod) {
          openProductModal(prod);
        }
      });
    });

    // Delete Product buttons
    container.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm(`Are you sure you want to remove product ${id}?`)) {
          store.deleteProduct(id);
          window.showToast(`Product ${id} deleted successfully`, 'info');
          render();
        }
      });
    });

    // Save Price List button
    document.getElementById('btn-save-pricelists')?.addEventListener('click', () => {
      const pl = store.getPriceLists();
      container.querySelectorAll('.tier-multiplier-input').forEach(input => {
        const tier = input.getAttribute('data-tier');
        const val = parseFloat(input.value) || 1.0;
        if (pl.tiers[tier]) {
          pl.tiers[tier].multiplier = val;
          const pct = Math.round((1 - val) * 100);
          pl.tiers[tier].discountLabel = pct > 0 ? `${pct}% Tier Discount` : 'Standard List Price';
        }
      });

      container.querySelectorAll('.currency-rate-input').forEach(input => {
        const code = input.getAttribute('data-code');
        const rate = parseFloat(input.value) || 1.0;
        const cur = pl.currencies.find(c => c.code === code);
        if (cur && !cur.isBase) {
          cur.rate = rate;
        }
      });

      store.savePriceLists(pl);
      window.showToast('Price list rules & exchange rates saved successfully!', 'success');
      render();
    });

    // Sync FX button
    document.getElementById('btn-sync-fx')?.addEventListener('click', () => {
      window.showToast('Synchronized live FX market rates from European Central Bank & RBI', 'success');
    });
  }

  // Add / Edit Product Modal with Dynamic Variant Support
  function openProductModal(existing = null) {
    const isEdit = !!existing;
    const variants = existing && existing.variants ? JSON.parse(JSON.stringify(existing.variants)) : [];

    function renderVariantRowsHtml() {
      if (variants.length === 0) {
        return `<div class="text-muted text-xs" id="no-variants-label">No variants configured. Click "Add Variant Attribute" to add dimensions (e.g. Storage, Seats, SLA).</div>`;
      }
      return variants.map((v, i) => `
        <div class="variant-row" data-index="${i}">
          <input type="text" class="form-control var-attr" placeholder="Attribute (e.g. RAM)" value="${v.attribute}" />
          <input type="text" class="form-control var-val" placeholder="Value (e.g. 64GB DDR5)" value="${v.values}" />
          <input type="number" class="form-control var-price" placeholder="Extra $ (e.g. 150)" value="${v.extraPrice}" />
          <button type="button" class="btn btn-ghost btn-icon-only var-del" data-index="${i}" style="color: var(--color-danger);" title="Remove">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `).join('');
    }

    const contentHtml = `
      <form id="product-modal-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Product Name *</label>
            <input type="text" id="modal-p-name" class="form-control" required placeholder="e.g. HyperScale Storage Node" value="${existing ? existing.name : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">SKU Code *</label>
            <input type="text" id="modal-p-sku" class="form-control" required placeholder="e.g. HW-STOR-001" value="${existing ? existing.sku : ''}" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select id="modal-p-cat" class="form-control">
              <option value="SaaS Software" ${existing && existing.category === 'SaaS Software' ? 'selected' : ''}>SaaS Software</option>
              <option value="Hardware" ${existing && existing.category === 'Hardware' ? 'selected' : ''}>Hardware</option>
              <option value="Professional Services" ${existing && existing.category === 'Professional Services' ? 'selected' : ''}>Professional Services</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Base Price (USD) *</label>
            <input type="number" step="0.01" id="modal-p-price" class="form-control" required placeholder="1250" value="${existing ? existing.basePrice : ''}" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Unit of Measure</label>
            <input type="text" id="modal-p-unit" class="form-control" placeholder="per user / yr, per unit, etc." value="${existing ? existing.unit : 'per unit'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tax Rate (%)</label>
            <input type="number" id="modal-p-tax" class="form-control" placeholder="18" value="${existing ? existing.taxRate : 18}" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="modal-p-desc" class="form-control" rows="2" placeholder="Brief technical or commercial description">${existing ? existing.description : ''}</textarea>
        </div>

        <!-- Variant Support -->
        <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
            <div>
              <h4 style="font-size: 0.95rem; font-weight: 700;">Product Variants & Price Modifiers</h4>
              <p class="text-xs text-muted">Configure attributes (e.g. License Seats, Storage, SLA) and price surcharges.</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-variant-row">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Variant Attribute
            </button>
          </div>
          <div id="modal-variants-list" class="variant-list-container">
            ${renderVariantRowsHtml()}
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button type="button" class="btn btn-primary" id="btn-modal-save-product">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${isEdit ? 'Update Product' : 'Create Product'}
      </button>
    `;

    window.openModal({
      title: isEdit ? `Edit Product: ${existing.name}` : 'Add New Product to Catalog',
      contentHtml,
      footerHtml,
      width: '680px',
      onOpen: (body, footer) => {
        const variantsContainer = body.querySelector('#modal-variants-list');

        function bindVariantDeleteButtons() {
          variantsContainer.querySelectorAll('.var-del').forEach(delBtn => {
            delBtn.onclick = function () {
              const idx = parseInt(this.getAttribute('data-index'), 10);
              variants.splice(idx, 1);
              variantsContainer.innerHTML = renderVariantRowsHtml();
              bindVariantDeleteButtons();
            };
          });
        }

        bindVariantDeleteButtons();

        body.querySelector('#btn-add-variant-row').onclick = function () {
          // Read any existing entered data first
          updateVariantsFromInputs();
          variants.push({ attribute: '', values: '', extraPrice: 0 });
          variantsContainer.innerHTML = renderVariantRowsHtml();
          bindVariantDeleteButtons();
        };

        function updateVariantsFromInputs() {
          const rows = variantsContainer.querySelectorAll('.variant-row');
          rows.forEach((row, i) => {
            if (variants[i]) {
              variants[i].attribute = row.querySelector('.var-attr')?.value || '';
              variants[i].values = row.querySelector('.var-val')?.value || '';
              variants[i].extraPrice = parseFloat(row.querySelector('.var-price')?.value) || 0;
            }
          });
        }

        footer.querySelector('#btn-modal-save-product').onclick = function () {
          const name = body.querySelector('#modal-p-name').value.trim();
          const sku = body.querySelector('#modal-p-sku').value.trim();
          const cat = body.querySelector('#modal-p-cat').value;
          const price = parseFloat(body.querySelector('#modal-p-price').value);
          const unit = body.querySelector('#modal-p-unit').value.trim() || 'per unit';
          const tax = parseFloat(body.querySelector('#modal-p-tax').value) || 0;
          const desc = body.querySelector('#modal-p-desc').value.trim();

          if (!name || !sku || isNaN(price)) {
            alert('Please fill in Product Name, SKU Code, and Base Price.');
            return;
          }

          updateVariantsFromInputs();
          const cleanVariants = variants.filter(v => v.attribute && v.values);

          if (isEdit) {
            store.updateProduct(existing.id, {
              name, sku, category: cat, basePrice: price, unit, taxRate: tax, description: desc, variants: cleanVariants
            });
            window.showToast(`Product "${name}" updated successfully`, 'success');
          } else {
            const newId = `PRD-${Math.floor(100 + Math.random() * 900)}`;
            store.addProduct({
              id: newId,
              name,
              sku,
              category: cat,
              basePrice: price,
              unit,
              taxRate: tax,
              status: 'Active',
              description: desc,
              variants: cleanVariants
            });
            window.showToast(`Product "${name}" added to catalog`, 'success');
          }

          window.closeModal();
          render();
        };
      }
    });
  }

  // Expose helper globally so dashboard quick actions can trigger it
  window.openAddProductModal = () => openProductModal(null);

  render();
};
