// Module: Discount Tier & Approval Chain Setup (Module 2)
window.renderDiscountsModule = function (container) {
  const store = window.clinchStore;
  let config = JSON.parse(JSON.stringify(store.getDiscountConfig()));
  const allProducts = store.getProducts();

  // Ensure tierCeilings only contains Bronze, Silver, Gold
  delete config.tierCeilings.Platinum;
  if (config.tierCeilings.Bronze === undefined) config.tierCeilings.Bronze = 10;
  if (config.tierCeilings.Silver === undefined) config.tierCeilings.Silver = 20;
  if (config.tierCeilings.Gold === undefined) config.tierCeilings.Gold = 30;

  let activeAuditTab = 'quotes'; // 'quotes' | 'product_rules'

  function render() {
    const productRules = store.getProductDiscountRules();
    const productAuditLogs = store.getProductRuleAuditLogs();

    container.innerHTML = `
      <div class="module-header animate-fade-in">
        <div class="module-title-group">
          <h1>Discount Tier & Approval Chain Setup</h1>
          <p>Product-specific discount governance, customer tier ceilings, and multi-level approval workflows.</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-primary" id="btn-save-global-ceilings">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Global Ceilings
          </button>
        </div>
      </div>

      <!-- UX Explanatory Architecture Banner -->
      <div class="card animate-fade-in" style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%); border-color: var(--accent-glow); margin-bottom: 1.75rem;">
        <div class="card-body" style="padding: 1.25rem 1.5rem;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-light); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; flex-shrink: 0;">1</div>
              <div>
                <strong style="font-size: 0.9rem; color: var(--text-primary);">Customer Tier Ceiling</strong>
                <p class="text-xs text-muted" style="margin-top: 0.15rem;">Defines the absolute global maximum discount allowed per customer tier (Bronze, Silver, Gold).</p>
              </div>
            </div>

            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--color-success-bg); color: var(--color-success); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; flex-shrink: 0;">2</div>
              <div>
                <strong style="font-size: 0.9rem; color: var(--text-primary);">Product Discount Limit</strong>
                <p class="text-xs text-muted" style="margin-top: 0.15rem;">Each individual product sets its own discount limits. Effective max is <code>MIN(Tier Ceiling, Product Limit)</code>.</p>
              </div>
            </div>

            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--color-warning-bg); color: var(--color-warning); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; flex-shrink: 0;">3</div>
              <div>
                <strong style="font-size: 0.9rem; color: var(--text-primary);">Approval Rules Workflow</strong>
                <p class="text-xs text-muted" style="margin-top: 0.15rem;">Automatically determines who must approve exceptions when a customer requests discounts above the effective limit.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 1: Customer Tier Discount Ceilings (Global) -->
      <div class="card animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="card-header">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--tier-gold);" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              Customer Tier Discount Ceilings (Global Maxima)
            </h3>
            <p class="card-subtitle">Customer tier defines the overall ceiling. No product discount can exceed these global ceilings.</p>
          </div>
          <span class="badge badge-info">Global Boundary Rules</span>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
            ${['Bronze', 'Silver', 'Gold'].map(tier => {
              const maxDiscount = config.tierCeilings[tier] !== undefined ? config.tierCeilings[tier] : (tier === 'Bronze' ? 10 : tier === 'Silver' ? 20 : 30);
              return `
                <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <span class="badge-tier badge-${tier.toLowerCase()}" style="min-width: 90px; text-align: center;">
                      ${tier} Tier
                    </span>
                    <span class="text-xs text-muted">Global Maximum</span>
                  </div>
                  <div class="slider-container">
                    <input type="range" class="range-slider tier-ceiling-slider" data-tier="${tier}" min="5" max="45" value="${maxDiscount}" />
                    <span class="range-bubble" id="bubble-tier-${tier}">${maxDiscount}%</span>
                  </div>
                  <div class="text-xs text-muted" style="margin-top: 0.75rem;">
                    All ${tier} tier customer quotes capped at ≤ <strong style="color: var(--text-primary);">${maxDiscount}%</strong>.
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- SECTION 2: Product Discount Rules Table -->
      <div class="table-card animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="table-toolbar">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
              Product Discount Rules
            </h3>
            <p class="card-subtitle">Set the maximum discount allowed for each individual product. Effective limit is MIN(Customer Tier Ceiling, Product Limit).</p>
          </div>
          <span class="badge badge-purple">${allProducts.length} Configured Products</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product Details</th>
                <th>Category</th>
                <th>Base Price</th>
                <th style="text-align: center;">Bronze Limit</th>
                <th style="text-align: center;">Silver Limit</th>
                <th style="text-align: center;">Gold Limit</th>
                <th>Effective Caps per Tier</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${allProducts.map(p => {
                const rules = store.getProductDiscountRule(p.id);
                const bronzeEff = store.calculateEffectiveDiscount(p.id, 'Bronze');
                const silverEff = store.calculateEffectiveDiscount(p.id, 'Silver');
                const goldEff = store.calculateEffectiveDiscount(p.id, 'Gold');

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${p.name}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 0.15rem;">
                        ${p.sku}
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-info">${p.category}</span>
                    </td>
                    <td>
                      <strong style="font-size: 0.95rem; color: var(--text-primary);">$${p.basePrice.toLocaleString()}</strong>
                      <div class="text-xs text-muted">${p.unit}</div>
                    </td>
                    <td style="text-align: center;">
                      <span style="font-weight: 700; color: var(--tier-bronze); font-size: 0.95rem;">${rules.Bronze || 0}%</span>
                    </td>
                    <td style="text-align: center;">
                      <span style="font-weight: 700; color: var(--tier-silver); font-size: 0.95rem;">${rules.Silver || 0}%</span>
                    </td>
                    <td style="text-align: center;">
                      <span style="font-weight: 700; color: var(--tier-gold); font-size: 0.95rem;">${rules.Gold || 0}%</span>
                    </td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.78rem;">
                        <div>
                          <span style="color: var(--text-muted);">Bronze:</span> 
                          <strong style="color: var(--tier-bronze);">${bronzeEff.effectiveMax}%</strong>
                          ${bronzeEff.isCappedByTier ? `<span class="badge badge-warning text-xs" style="margin-left: 0.25rem;">Capped by ${bronzeEff.tierCeiling}%</span>` : ''}
                        </div>
                        <div>
                          <span style="color: var(--text-muted);">Silver:</span> 
                          <strong style="color: var(--tier-silver);">${silverEff.effectiveMax}%</strong>
                          ${silverEff.isCappedByTier ? `<span class="badge badge-warning text-xs" style="margin-left: 0.25rem;">Capped by ${silverEff.tierCeiling}%</span>` : ''}
                        </div>
                        <div>
                          <span style="color: var(--text-muted);">Gold:</span> 
                          <strong style="color: var(--tier-gold);">${goldEff.effectiveMax}%</strong>
                          ${goldEff.isCappedByTier ? `<span class="badge badge-warning text-xs" style="margin-left: 0.25rem;">Capped by ${goldEff.tierCeiling}%</span>` : ''}
                        </div>
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <button class="btn btn-secondary btn-sm btn-edit-prod-rule" data-id="${p.id}">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit Rules
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 3: Approval Chain Flow Builder -->
      <div class="card animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="card-header">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--color-warning);" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              Approval Chain Flow Builder
            </h3>
            <p class="card-subtitle">Approval rules determine who must approve discount requests when an exception is requested.</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-add-chain-step">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Chain Tier
          </button>
        </div>
        <div class="card-body">
          <div class="chain-flow-builder">
            ${config.approvalChain.map((step, idx) => `
              <div class="chain-step-card">
                <div class="step-indicator">
                  <div class="step-number">${step.id}</div>
                  <div class="step-details">
                    <h4>${step.label}</h4>
                    <p>Trigger Range: <strong>${step.minDiscount}%</strong> to <strong>${step.maxDiscount}%</strong> discount</p>
                  </div>
                </div>

                <div class="step-approvers">
                  <span class="text-xs text-muted" style="margin-right: 0.5rem;">Approvers:</span>
                  ${step.approvers.map(appr => `
                    <span class="approver-pill">
                      <svg class="icon icon-sm" style="color: var(--accent-primary);" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      ${appr}
                    </span>
                  `).join('')}
                  <span class="badge badge-info" style="margin-left: 0.75rem;">SLA: ${step.timeSLA}</span>
                </div>

                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn btn-ghost btn-sm btn-edit-step" data-id="${step.id}" title="Edit threshold">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                </div>
              </div>
              ${idx < config.approvalChain.length - 1 ? `
                <div class="chain-arrow-connector">
                  <svg class="icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              ` : ''}
            `).join('')}
          </div>
        </div>
      </div>

      <!-- SECTION 4: Audit History Tabs -->
      <div class="table-card animate-fade-in">
        <div class="table-toolbar">
          <div class="tabs-nav" style="border-bottom: none; margin-bottom: 0;">
            <button class="tab-btn ${activeAuditTab === 'quotes' ? 'active' : ''}" data-atab="quotes">
              Quote Approval & Request Audit (${config.auditLogs.length})
            </button>
            <button class="tab-btn ${activeAuditTab === 'product_rules' ? 'active' : ''}" data-atab="product_rules">
              Product Rule Change Audit Trail (${productAuditLogs.length})
            </button>
          </div>
        </div>

        ${activeAuditTab === 'quotes' ? renderQuoteAuditTable(config.auditLogs) : renderProductRuleAuditTable(productAuditLogs)}
      </div>
    `;

    setupEventListeners(config, allProducts);
  }

  function renderQuoteAuditTable(logs) {
    return `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Deal & Customer Account</th>
              <th>Origin / Rep</th>
              <th>Requested Discount</th>
              <th>Approver Decision</th>
              <th>Timestamp</th>
              <th>Reason & Rule Trigger Notes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr>
                <td><strong>${log.deal}</strong></td>
                <td>${log.rep}</td>
                <td><span style="font-weight: 700; color: var(--accent-primary);">${log.discount}</span></td>
                <td>${log.approver}</td>
                <td class="text-xs text-muted">${log.timestamp}</td>
                <td class="text-sm text-secondary" style="max-width: 320px;">${log.reason}</td>
                <td>
                  <span class="badge ${log.status === 'Approved' ? 'badge-success' : log.status === 'Pending Review' ? 'badge-warning' : 'badge-danger'}">
                    <span class="badge-dot" style="background: ${log.status === 'Approved' ? 'var(--color-success)' : log.status === 'Pending Review' ? 'var(--color-warning)' : 'var(--color-danger)'};"></span>
                    ${log.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderProductRuleAuditTable(logs) {
    return `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product Name & SKU</th>
              <th>Previous Discount Limits</th>
              <th>Updated Discount Limits</th>
              <th>Modified By Admin</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `
              <tr>
                <td colspan="5" style="text-align: center; padding: 2rem;" class="text-muted">
                  No product rule modifications recorded yet. All initial rules active.
                </td>
              </tr>
            ` : logs.map(log => `
              <tr>
                <td>
                  <strong>${log.productName}</strong>
                  <div class="text-xs text-muted" style="font-family: var(--font-mono);">${log.sku}</div>
                </td>
                <td><span class="text-sm text-muted">${log.oldDiscount}</span></td>
                <td><span class="text-sm font-semibold" style="color: var(--accent-primary);">${log.newDiscount}</span></td>
                <td><span class="badge badge-purple">${log.changedBy}</span></td>
                <td class="text-xs text-muted">${log.timestamp}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function setupEventListeners(config, allProducts) {
    // Slider listeners for Tier Ceilings
    container.querySelectorAll('.tier-ceiling-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const tier = e.target.getAttribute('data-tier');
        const val = parseInt(e.target.value, 10);
        config.tierCeilings[tier] = val;
        const bubble = document.getElementById(`bubble-tier-${tier}`);
        if (bubble) bubble.textContent = `${val}%`;
      });
    });

    // Save Global Ceilings button
    document.getElementById('btn-save-global-ceilings')?.addEventListener('click', () => {
      store.saveDiscountConfig(config);
      window.showToast('Global customer tier ceilings updated successfully!', 'success');
      render();
    });

    // Edit Product Discount Rule Button
    container.querySelectorAll('.btn-edit-prod-rule').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-id');
        const product = allProducts.find(p => p.id === pId);
        if (!product) return;
        openProductRuleModal(product, config.tierCeilings);
      });
    });

    // Edit Step in Approval Chain
    container.querySelectorAll('.btn-edit-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const step = config.approvalChain.find(s => s.id === id);
        if (!step) return;

        window.openModal({
          title: `Edit Approval Step ${step.id}: ${step.label}`,
          contentHtml: `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div class="form-group">
                <label class="form-label">Step Label</label>
                <input type="text" id="modal-step-label" class="form-control" value="${step.label}" />
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Min Discount (%)</label>
                  <input type="number" id="modal-step-min" class="form-control" value="${step.minDiscount}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Max Discount (%)</label>
                  <input type="number" id="modal-step-max" class="form-control" value="${step.maxDiscount}" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">SLA Resolution Time</label>
                <input type="text" id="modal-step-sla" class="form-control" value="${step.timeSLA}" />
              </div>
            </div>
          `,
          footerHtml: `
            <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-step-modal">Save Step</button>
          `,
          onOpen: (body, footer) => {
            footer.querySelector('#btn-save-step-modal').onclick = () => {
              step.label = body.querySelector('#modal-step-label').value.trim();
              step.minDiscount = parseFloat(body.querySelector('#modal-step-min').value) || 0;
              step.maxDiscount = parseFloat(body.querySelector('#modal-step-max').value) || 0;
              step.timeSLA = body.querySelector('#modal-step-sla').value.trim();
              store.saveDiscountConfig(config);
              window.closeModal();
              render();
              window.showToast(`Updated Step ${step.id} threshold`, 'success');
            };
          }
        });
      });
    });

    // Audit Tab Switching
    container.querySelectorAll('.tab-btn[data-atab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeAuditTab = btn.getAttribute('data-atab');
        render();
      });
    });
  }

  // MODAL: Edit Product Discount Rules per product (Bronze, Silver, Gold - No Platinum)
  function openProductRuleModal(product, tierCeilings) {
    const currentRules = store.getProductDiscountRule(product.id);

    window.openModal({
      title: `Edit Product Discount Rules: ${product.name}`,
      width: '560px',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- Product Information Summary -->
          <div style="background: var(--bg-card-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${product.name}</div>
              <div class="text-xs text-muted" style="font-family: var(--font-mono); margin-top: 0.15rem;">SKU: ${product.sku} | Category: ${product.category}</div>
            </div>
            <div style="text-align: right;">
              <span class="text-xs text-muted">Base Price</span>
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">$${product.basePrice.toLocaleString()}</div>
            </div>
          </div>

          <div class="text-xs text-muted">
            Configure the maximum allowable discount limit for each customer tier. Note that the customer tier global ceiling acts as an absolute upper bound.
          </div>

          <!-- Tier Discount Limit Inputs (Bronze, Silver, Gold) -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <!-- Bronze -->
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                <span class="badge-tier badge-bronze">Bronze Tier</span>
                <span class="text-xs text-muted">Global Tier Ceiling: <strong>${tierCeilings.Bronze}%</strong></span>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.78rem;">Bronze Maximum Discount Limit (%)</label>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <input type="number" id="m-rule-bronze" class="form-control" min="0" max="45" step="0.5" value="${currentRules.Bronze || 5}" />
                  <span class="text-xs text-secondary">% max</span>
                </div>
              </div>
            </div>

            <!-- Silver -->
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                <span class="badge-tier badge-silver">Silver Tier</span>
                <span class="text-xs text-muted">Global Tier Ceiling: <strong>${tierCeilings.Silver}%</strong></span>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.78rem;">Silver Maximum Discount Limit (%)</label>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <input type="number" id="m-rule-silver" class="form-control" min="0" max="45" step="0.5" value="${currentRules.Silver || 10}" />
                  <span class="text-xs text-secondary">% max</span>
                </div>
              </div>
            </div>

            <!-- Gold -->
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                <span class="badge-tier badge-gold">Gold Tier</span>
                <span class="text-xs text-muted">Global Tier Ceiling: <strong>${tierCeilings.Gold}%</strong></span>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.78rem;">Gold Maximum Discount Limit (%)</label>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <input type="number" id="m-rule-gold" class="form-control" min="0" max="45" step="0.5" value="${currentRules.Gold || 15}" />
                  <span class="text-xs text-secondary">% max</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-prod-rule-modal">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Save Product Rules
        </button>
      `,
      onOpen: (body, footer) => {
        footer.querySelector('#btn-save-prod-rule-modal').onclick = () => {
          const bronzeVal = parseFloat(body.querySelector('#m-rule-bronze').value) || 0;
          const silverVal = parseFloat(body.querySelector('#m-rule-silver').value) || 0;
          const goldVal = parseFloat(body.querySelector('#m-rule-gold').value) || 0;

          store.saveProductDiscountRule(product.id, {
            Bronze: bronzeVal,
            Silver: silverVal,
            Gold: goldVal
          });

          window.closeModal();
          render();
          window.showToast(`Updated discount rules for ${product.name}`, 'success');
        };
      }
    });
  }

  render();
};
