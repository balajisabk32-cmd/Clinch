// Module: Recurring Product & Subscription Plans (Module 4)
window.renderSubscriptionsModule = function (container) {
  const store = window.clinchStore;
  let activeTab = 'plans'; // 'plans' | 'customer_subs'

  function render() {
    const plans = store.getRecurringPlans();
    const customerSubs = store.getCustomerSubscriptions();
    const allProducts = store.getProducts();

    // Compute normalized monthly recurring revenue (MRR)
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

    container.innerHTML = `
      <div class="module-header animate-fade-in">
        <div class="module-title-group">
          <h1>Recurring Product & Subscription Plans</h1>
          <p>Configure recurring products and services that can be added to customer quotations.</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary" id="btn-simulate-quote-sub">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            Simulate Quote to Subscription
          </button>
          <button class="btn btn-primary" id="btn-add-recurring-plan">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Recurring Plan
          </button>
        </div>
      </div>

      <!-- Quick Metrics Summary -->
      <div class="stat-grid animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Active Recurring Plans</span>
            <div class="stat-icon" style="background: var(--accent-light); color: var(--accent-primary);">
              <svg class="icon" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path></svg>
            </div>
          </div>
          <div class="stat-value">${activePlansCount} <span style="font-size: 0.95rem; font-weight: 500; color: var(--text-muted);">of ${plans.length}</span></div>
          <div class="stat-bottom">
            <span class="stat-delta positive">Available in Quotation Builder</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Active Subscriptions</span>
            <div class="stat-icon" style="background: var(--color-success-bg); color: var(--color-success);">
              <svg class="icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
          </div>
          <div class="stat-value">${activeSubsCount}</div>
          <div class="stat-bottom">
            <span class="stat-delta positive">Confirmed Customer Contracts</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Monthly Run-Rate (MRR)</span>
            <div class="stat-icon" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">
              <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
          </div>
          <div class="stat-value">$${totalMRR.toLocaleString()}</div>
          <div class="stat-bottom">
            <span class="stat-delta positive">Normalized Recurring Inflow</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Backend Business Logic</span>
            <div class="stat-icon" style="background: var(--color-warning-bg); color: var(--color-warning);">
              <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
          </div>
          <div class="stat-value" style="font-size: 1.25rem; font-weight: 700; color: var(--color-success); display: flex; align-items: center; gap: 0.4rem;">
            <span class="badge-dot" style="background: var(--color-success);"></span>
            Automated
          </div>
          <div class="stat-bottom">
            <span class="stat-delta positive">Auto-Proration & Renewal Engine</span>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav animate-fade-in">
        <button class="tab-btn ${activeTab === 'plans' ? 'active' : ''}" data-tab="plans">
          Recurring Plans Catalog (${plans.length} Plans)
        </button>
        <button class="tab-btn ${activeTab === 'customer_subs' ? 'active' : ''}" data-tab="customer_subs">
          Active Customer Subscriptions (${customerSubs.length} Contracts)
        </button>
      </div>

      <!-- Tab Content Area -->
      ${activeTab === 'plans' ? renderPlansCatalogTab(plans) : renderCustomerSubscriptionsTab(customerSubs)}
    `;

    setupEventListeners(plans, customerSubs, allProducts);
  }

  // TAB 1: Recurring Plans Catalog
  function renderPlansCatalogTab(plans) {
    if (plans.length === 0) {
      return `
        <div class="card animate-fade-in" style="text-align: center; padding: 3rem 1.5rem;">
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">No Recurring Plans Configured Yet</div>
          <p class="text-sm text-muted" style="margin: 0.5rem auto 1.5rem; max-width: 440px;">
            Create recurring plans for existing products to offer recurring services, maintenance, or SaaS software on quotations.
          </p>
          <button class="btn btn-primary" id="btn-empty-add-plan">+ New Recurring Plan</button>
        </div>
      `;
    }

    return `
      <div class="plan-cards-grid animate-fade-in">
        ${plans.map(plan => {
          const discountRules = plan.discountRules || { Bronze: 5, Silver: 10, Gold: 15 };
          const bronzePrice = Math.round(plan.recurringPrice * (1 - (discountRules.Bronze || 5) / 100));
          const silverPrice = Math.round(plan.recurringPrice * (1 - (discountRules.Silver || 10) / 100));
          const goldPrice = Math.round(plan.recurringPrice * (1 - (discountRules.Gold || 15) / 100));

          return `
            <div class="plan-card" style="border-top: 4px solid var(--accent-primary);">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
                <div>
                  <span class="badge badge-info" style="font-size: 0.7rem; margin-bottom: 0.35rem;">${plan.category}</span>
                  <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); line-height: 1.3;">${plan.productName}</h3>
                  <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 0.2rem;">
                    SKU: ${plan.sku}
                  </div>
                </div>
                <span class="badge ${plan.status === 'Active' ? 'badge-success' : 'badge-warning'}">
                  <span class="badge-dot" style="background: ${plan.status === 'Active' ? 'var(--color-success)' : 'var(--color-warning)'};"></span>
                  ${plan.status}
                </span>
              </div>

              <!-- Recurring Price & Billing Cycle -->
              <div class="plan-price" style="margin: 0.5rem 0;">
                $${plan.recurringPrice.toLocaleString()}
                <span class="plan-period">/ ${plan.billingCycle.toLowerCase()}</span>
              </div>

              <p class="text-sm text-secondary" style="line-height: 1.5; min-height: 48px;">
                ${plan.description || 'Configured recurring billing service for customer contract agreements.'}
              </p>

              <!-- DealFlow360 Discount Engine Integration Details -->
              <div style="background: var(--bg-card-subtle); border-radius: var(--radius-md); padding: 0.85rem; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.45rem;">
                <div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: var(--accent-primary); letter-spacing: 0.04em;">
                  DealFlow360 Discount Inheritance
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; font-size: 0.78rem;">
                  <div>
                    <span style="color: var(--text-muted);">List Price:</span>
                    <strong style="color: var(--text-primary); margin-left: 0.2rem;">$${plan.recurringPrice.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style="color: var(--tier-bronze);">Bronze (5%):</span>
                    <strong style="color: var(--text-primary); margin-left: 0.2rem;">$${bronzePrice.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style="color: var(--tier-silver);">Silver (10%):</span>
                    <strong style="color: var(--text-primary); margin-left: 0.2rem;">$${silverPrice.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style="color: var(--tier-gold);">Gold (15%):</span>
                    <strong style="color: var(--text-primary); margin-left: 0.2rem;">$${goldPrice.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <!-- Plan Actions Footer -->
              <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
                <button class="btn btn-ghost btn-sm btn-toggle-plan-status" data-id="${plan.id}">
                  ${plan.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <button class="btn btn-secondary btn-sm btn-edit-rec-plan" data-id="${plan.id}">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Edit
                  </button>
                  <button class="btn btn-ghost btn-sm btn-del-rec-plan" data-id="${plan.id}" title="Remove Recurring Plan" style="color: var(--color-danger);">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // TAB 2: Active Customer Subscriptions ("My Subscriptions" Registry)
  function renderCustomerSubscriptionsTab(customerSubs) {
    return `
      <div class="table-card animate-fade-in">
        <div class="table-toolbar">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--color-success);" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Customer Subscriptions Registry
            </h3>
            <p class="card-subtitle">Active subscriptions created automatically upon quotation confirmation. Backend calculates billing intervals and proration seamlessly.</p>
          </div>
          <span class="badge badge-purple">${customerSubs.length} Total Subscriptions</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer Account</th>
                <th>Subscribed Product & Plan</th>
                <th>Billing Frequency</th>
                <th>Contract Price</th>
                <th>Start Date</th>
                <th>Next Billing Date</th>
                <th>Status</th>
                <th style="text-align: right;">Automated Actions</th>
              </tr>
            </thead>
            <tbody>
              ${customerSubs.map(sub => {
                const tierClass = sub.customerTier ? sub.customerTier.toLowerCase() : 'gold';
                const hasDiscount = sub.discountPct && sub.discountPct > 0;

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${sub.customerName}</div>
                      <span class="badge-tier badge-${tierClass}" style="margin-top: 0.25rem; font-size: 0.68rem; padding: 0.15rem 0.5rem;">
                        ${sub.customerTier || 'Gold'} Tier
                      </span>
                    </td>
                    <td>
                      <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${sub.productName}</div>
                      <div class="text-xs text-muted" style="margin-top: 0.15rem;">Inv: ${sub.lastInvoiceNumber || 'INV-2026-9081'}</div>
                    </td>
                    <td>
                      <span class="badge badge-info">${sub.billingCycle}</span>
                    </td>
                    <td>
                      <div style="display: flex; flex-direction: column;">
                        <strong style="font-size: 1rem; color: var(--text-primary);">
                          $${sub.finalPrice.toLocaleString()}<span style="font-size: 0.78rem; font-weight: 400; color: var(--text-muted);">/${sub.billingCycle === 'Monthly' ? 'mo' : sub.billingCycle === 'Quarterly' ? 'qtr' : 'yr'}</span>
                        </strong>
                        ${hasDiscount ? `
                          <div class="text-xs" style="color: var(--color-success); margin-top: 0.1rem;">
                            ${sub.discountPct}% ${sub.customerTier} tier applied <span style="text-decoration: line-line-through; color: var(--text-muted);">($${sub.recurringPrice.toLocaleString()})</span>
                          </div>
                        ` : ''}
                      </div>
                    </td>
                    <td class="text-xs text-muted">${sub.startDate}</td>
                    <td>
                      <div class="text-xs" style="font-weight: 600; color: var(--accent-primary);">${sub.nextBillingDate}</div>
                      <span class="text-xs text-muted">Auto-Renews</span>
                    </td>
                    <td>
                      <span class="badge ${sub.status === 'Active' ? 'badge-success' : 'badge-warning'}">
                        <span class="badge-dot" style="background: ${sub.status === 'Active' ? 'var(--color-success)' : 'var(--color-warning)'};"></span>
                        ${sub.status}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                        <button class="btn btn-secondary btn-sm btn-prorate-sub" data-id="${sub.id}" title="Mid-cycle upgrade or downgrade with automatic proration">
                          Prorate / Change Plan
                        </button>
                        ${sub.status === 'Active' ? `
                          <button class="btn btn-ghost btn-sm btn-cancel-sub" data-id="${sub.id}" title="Process cancellation via backend business rules" style="color: var(--color-danger);">
                            Cancel
                          </button>
                        ` : ''}
                        <button class="btn btn-ghost btn-sm btn-invoice-sub" data-id="${sub.id}" title="View generated invoice">
                          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function setupEventListeners(plans, customerSubs, allProducts) {
    // Tab switching
    container.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });

    // New Recurring Plan button
    document.getElementById('btn-add-recurring-plan')?.addEventListener('click', () => {
      openRecurringPlanModal(null, allProducts);
    });
    document.getElementById('btn-empty-add-plan')?.addEventListener('click', () => {
      openRecurringPlanModal(null, allProducts);
    });

    // Edit Recurring Plan
    container.querySelectorAll('.btn-edit-rec-plan').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const plan = store.getRecurringPlan(id);
        if (plan) openRecurringPlanModal(plan, allProducts);
      });
    });

    // Delete Recurring Plan
    container.querySelectorAll('.btn-del-rec-plan').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const plan = store.getRecurringPlan(id);
        if (confirm(`Remove recurring plan for ${plan ? plan.productName : id}? This will not affect existing active subscriptions.`)) {
          store.deleteRecurringPlan(id);
          window.showToast('Recurring plan removed successfully', 'info');
          render();
        }
      });
    });

    // Toggle Plan Status
    container.querySelectorAll('.btn-toggle-plan-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const updated = store.toggleRecurringPlanStatus(id);
        if (updated) {
          window.showToast(`Plan status updated to ${updated.status}`, 'success');
          render();
        }
      });
    });

    // Simulate Quote to Subscription button
    document.getElementById('btn-simulate-quote-sub')?.addEventListener('click', () => {
      openSimulateQuoteModal(plans);
    });

    // Prorate / Change Plan button (Mid-cycle change)
    container.querySelectorAll('.btn-prorate-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-id');
        openProrationModal(subId, plans);
      });
    });

    // Cancel Subscription button
    container.querySelectorAll('.btn-cancel-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-id');
        const sub = store.getCustomerSubscription(subId);
        if (!sub) return;

        if (confirm(`Cancel ${sub.customerName}'s subscription for ${sub.productName}?\n\nPer standard fair B2B business rules, service access remains valid until end of current billing cycle (${sub.nextBillingDate}).`)) {
          const res = store.cancelSubscription({ subscriptionId: subId, reason: 'RevOps Admin request' });
          if (res.success) {
            window.showToast(`Subscription cancelled. Access remains valid until ${res.accessValidUntil}.`, 'info', 4500);
            render();
          }
        }
      });
    });

    // View Invoice button
    container.querySelectorAll('.btn-invoice-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-id');
        const sub = store.getCustomerSubscription(subId);
        if (!sub) return;
        openInvoiceModal(sub);
      });
    });
  }

  // MODAL: Create / Edit Recurring Plan (Section 5)
  function openRecurringPlanModal(planToEdit, allProducts) {
    const isEdit = !!planToEdit;
    const selectedProdId = planToEdit ? planToEdit.productId : (allProducts[0] ? allProducts[0].id : '');
    const currentPrice = planToEdit ? planToEdit.recurringPrice : (allProducts[0] ? allProducts[0].basePrice : 2000);
    const currentCycle = planToEdit ? planToEdit.billingCycle : 'Monthly';
    const currentStatus = planToEdit ? planToEdit.status : 'Active';
    const currentDesc = planToEdit ? planToEdit.description : '';

    window.openModal({
      title: isEdit ? `Edit Recurring Plan: ${planToEdit.productName}` : 'Configure New Recurring Plan',
      width: '560px',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div class="form-group">
            <label class="form-label">Plan / Product Name *</label>
            <select id="m-plan-product" class="form-control">
              ${allProducts.map(p => `
                <option value="${p.id}" ${p.id === selectedProdId ? 'selected' : ''} data-price="${p.basePrice}" data-category="${p.category}">
                  ${p.name} ($${p.basePrice.toLocaleString()}) — ${p.category}
                </option>
              `).join('')}
            </select>
            <span class="form-hint">Select an existing catalog product from Products & Price Lists. No duplicate products will be created.</span>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Billing Cycle *</label>
              <select id="m-plan-cycle" class="form-control">
                <option value="Monthly" ${currentCycle === 'Monthly' ? 'selected' : ''}>Monthly</option>
                <option value="Quarterly" ${currentCycle === 'Quarterly' ? 'selected' : ''}>Quarterly</option>
                <option value="Yearly" ${currentCycle === 'Yearly' ? 'selected' : ''}>Yearly</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Recurring Price ($) *</label>
              <input type="number" id="m-plan-price" class="form-control" min="1" step="1" value="${currentPrice}" placeholder="e.g. 2000" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Status *</label>
            <select id="m-plan-status" class="form-control">
              <option value="Active" ${currentStatus === 'Active' ? 'selected' : ''}>Active (Available on Quotations)</option>
              <option value="Inactive" ${currentStatus === 'Inactive' ? 'selected' : ''}>Inactive (Hidden from Quotes)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Plan Description & Service Scope</label>
            <textarea id="m-plan-desc" class="form-control" rows="3" placeholder="Describe the recurring deliverables, uptime commitment, or service deliverables...">${currentDesc}</textarea>
          </div>

          <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem; font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: flex-start; gap: 0.5rem;">
            <svg class="icon icon-sm" style="color: var(--accent-primary); flex-shrink: 0; margin-top: 2px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <div>
              <strong>Discount Integration:</strong> Discount eligibility inherits the DealFlow360 discount ceiling and approval chain rules defined for this product. Customers receive their tier discounts automatically.
            </div>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-plan-submit">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Save Plan
        </button>
      `,
      onOpen: (body, footer) => {
        // Auto-update price suggestion when product changes if creating new
        if (!isEdit) {
          body.querySelector('#m-plan-product').addEventListener('change', (e) => {
            const opt = e.target.selectedOptions[0];
            const pPrice = opt.getAttribute('data-price');
            if (pPrice) body.querySelector('#m-plan-price').value = pPrice;
          });
        }

        footer.querySelector('#btn-save-plan-submit').onclick = () => {
          const prodId = body.querySelector('#m-plan-product').value;
          const cycle = body.querySelector('#m-plan-cycle').value;
          const price = parseFloat(body.querySelector('#m-plan-price').value);
          const status = body.querySelector('#m-plan-status').value;
          const desc = body.querySelector('#m-plan-desc').value.trim();

          if (isNaN(price) || price <= 0) {
            alert('Please specify a valid recurring price.');
            return;
          }

          store.saveRecurringPlan({
            id: isEdit ? planToEdit.id : undefined,
            productId: prodId,
            billingCycle: cycle,
            recurringPrice: price,
            status: status,
            description: desc
          });

          window.closeModal();
          render();
          window.showToast(isEdit ? 'Recurring plan updated successfully' : 'New recurring plan created successfully', 'success');
        };
      }
    });
  }

  // MODAL: Simulate Quotation to Subscription Conversion (Section 10)
  function openSimulateQuoteModal(plans) {
    const customers = store.getCustomerTiers().customers;

    window.openModal({
      title: 'Simulate Quotation Confirmation to Subscription',
      width: '540px',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <p class="text-xs text-muted">
            When a customer accepts a quotation containing recurring line items, DealFlow360 automatically provisions their subscription and schedules billing cycles.
          </p>

          <div class="form-group">
            <label class="form-label">Select Customer Account *</label>
            <select id="m-sim-customer" class="form-control">
              <option value="Acme Corp|Gold">Acme Corp (Gold Tier - 15% Standard Discount)</option>
              ${customers.map(c => `
                <option value="${c.name}|${c.currentTier}">
                  ${c.name} (${c.currentTier} Tier)
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Select Recurring Product Plan *</label>
            <select id="m-sim-plan" class="form-control">
              ${plans.filter(p => p.status === 'Active').map(p => `
                <option value="${p.id}" data-price="${p.recurringPrice}" data-cycle="${p.billingCycle}" data-prod="${p.productId}">
                  ${p.productName} — $${p.recurringPrice.toLocaleString()}/${p.billingCycle.toLowerCase()}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Live Automatic Price & Discount Calculation Box -->
          <div id="sim-price-preview" style="background: var(--bg-card-subtle); border-radius: var(--radius-md); padding: 1rem; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.5rem;">
            <!-- Populated dynamically by script -->
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-confirm-quote-sub">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Confirm Quote & Create Subscription
        </button>
      `,
      onOpen: (body, footer) => {
        const custSelect = body.querySelector('#m-sim-customer');
        const planSelect = body.querySelector('#m-sim-plan');
        const previewBox = body.querySelector('#sim-price-preview');

        function updatePreview() {
          const [custName, custTier] = custSelect.value.split('|');
          const planId = planSelect.value;
          const plan = plans.find(p => p.id === planId);
          if (!plan) return;

          const effCalc = store.calculateEffectiveDiscount(plan.productId, custTier);
          const finalPrice = Math.round(plan.recurringPrice * (1 - effCalc.effectiveMax / 100));

          previewBox.innerHTML = `
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <div>
                <span class="text-xs text-muted">Customer Pricing for ${custName} (${custTier} Tier)</span>
                <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin-top: 0.2rem;">
                  $${finalPrice.toLocaleString()} <span style="font-size: 0.85rem; font-weight: 400; color: var(--text-muted);">/ ${plan.billingCycle.toLowerCase()}</span>
                </div>
              </div>
              <span class="badge badge-success">${effCalc.effectiveMax}% Discount Applied</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.25rem;">
              Base Price: <strong>$${plan.recurringPrice.toLocaleString()}</strong> | First Billing Date: <strong>Today (05 Sep 2026)</strong> | Next Renewal: <strong>05 Oct 2026</strong>
            </div>
          `;
        }

        custSelect.addEventListener('change', updatePreview);
        planSelect.addEventListener('change', updatePreview);
        updatePreview();

        footer.querySelector('#btn-confirm-quote-sub').onclick = () => {
          const [custName, custTier] = custSelect.value.split('|');
          const planId = planSelect.value;

          const res = store.createCustomerSubscription({
            customerName: custName,
            customerTier: custTier,
            planId: planId
          });

          if (res.success) {
            window.closeModal();
            activeTab = 'customer_subs';
            render();
            window.showToast(`Quotation confirmed! Created active subscription for ${custName}`, 'success', 4000);
          }
        };
      }
    });
  }

  // MODAL: Automated Mid-Cycle Plan Change & Proration (Section 9)
  function openProrationModal(subscriptionId, plans) {
    const sub = store.getCustomerSubscription(subscriptionId);
    if (!sub) return;

    window.openModal({
      title: `Mid-Cycle Plan Change: ${sub.customerName}`,
      width: '560px',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- Current Plan Status Card -->
          <div style="background: var(--bg-card-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${sub.productName}</div>
              <div class="text-xs text-muted" style="margin-top: 0.15rem;">
                Current Rate: <strong>$${sub.finalPrice.toLocaleString()} / ${sub.billingCycle.toLowerCase()}</strong> | Cycle Ends: <strong>${sub.nextBillingDate}</strong>
              </div>
            </div>
            <span class="badge badge-info">${sub.billingCycle}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Select New Recurring Plan *</label>
            <select id="m-switch-new-plan" class="form-control">
              ${plans.filter(p => p.id !== sub.planId && p.status === 'Active').map(p => `
                <option value="${p.id}">
                  ${p.productName} — $${p.recurringPrice.toLocaleString()} / ${p.billingCycle.toLowerCase()}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Automated Backend Proration Calculation Live Box -->
          <div id="proration-calc-preview" style="background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--accent-primary); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Rendered by live script -->
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-apply-proration-submit">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Apply Mid-Cycle Change
        </button>
      `,
      onOpen: (body, footer) => {
        const planSelect = body.querySelector('#m-switch-new-plan');
        const calcBox = body.querySelector('#proration-calc-preview');

        function updateProrationPreview() {
          const newPlanId = planSelect.value;
          const proration = store.calculateProration({ subscriptionId, newPlanId });
          if (!proration) return;

          calcBox.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-primary); text-transform: uppercase;">
                Automated Proration Calculation
              </span>
              <span class="badge badge-purple">Automatic GAAP Engine</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.82rem; margin-top: 0.35rem;">
              <div>• Cycle Elapsed: <strong>${proration.elapsedDays} of ${proration.totalDays} days</strong></div>
              <div>• Days Remaining: <strong>${proration.remainingDays} days</strong></div>
              <div>• Unused Credit: <strong style="color: var(--color-success);">$${proration.unusedCredit.toLocaleString()}</strong></div>
              <div>• New Plan Prorated: <strong style="color: var(--text-primary);">$${proration.newChargeProrated.toLocaleString()}</strong></div>
            </div>

            <div style="margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
              <div>
                <span class="text-xs text-muted">Net Mid-Cycle Adjustment:</span>
                <div style="font-size: 1.15rem; font-weight: 800; color: ${proration.isCredit ? 'var(--color-success)' : 'var(--accent-primary)'};">
                  ${proration.isCredit ? `-$${proration.adjustmentAbs.toLocaleString()} (Customer Credit)` : `+$${proration.adjustmentAbs.toLocaleString()} (Due on Next Invoice)`}
                </div>
              </div>
              <span class="badge ${proration.isCredit ? 'badge-success' : 'badge-warning'}">
                ${proration.isCredit ? 'Credit Memo Generated' : 'Automated Debit Adjustment'}
              </span>
            </div>
          `;
        }

        planSelect.addEventListener('change', updateProrationPreview);
        updateProrationPreview();

        footer.querySelector('#btn-apply-proration-submit').onclick = () => {
          const newPlanId = planSelect.value;
          const res = store.applyMidCycleChange({ subscriptionId, newPlanId });
          if (res.success) {
            window.closeModal();
            render();
            window.showToast(`Plan successfully switched! Proration calculated and applied.`, 'success', 4000);
          }
        };
      }
    });
  }

  // MODAL: View Generated Renewal Invoice
  function openInvoiceModal(sub) {
    window.openModal({
      title: `Invoice: ${sub.lastInvoiceNumber || 'INV-2026-9081'}`,
      width: '520px',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
            <div>
              <span class="text-xs text-muted">Billed To:</span>
              <div style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary);">${sub.customerName}</div>
              <div class="text-xs text-muted">${sub.customerTier} Customer Account</div>
            </div>
            <div style="text-align: right;">
              <span class="badge badge-success">Paid / Recurring</span>
              <div class="text-xs text-muted" style="margin-top: 0.25rem;">Date: ${sub.startDate}</div>
            </div>
          </div>

          <div style="background: var(--bg-card-subtle); border-radius: var(--radius-md); padding: 1rem; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
              <span>${sub.productName} (${sub.billingCycle})</span>
              <strong>$${sub.recurringPrice.toLocaleString()}</strong>
            </div>
            ${sub.discountPct ? `
              <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--color-success);">
                <span>${sub.customerTier} Tier Discount (${sub.discountPct}%)</span>
                <span>-$${(sub.recurringPrice - sub.finalPrice).toLocaleString()}</span>
              </div>
            ` : ''}
            <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.25rem; display: flex; justify-content: space-between; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">
              <span>Total Contract Amount:</span>
              <span style="color: var(--accent-primary);">$${sub.finalPrice.toLocaleString()}</span>
            </div>
          </div>

          <div class="text-xs text-muted" style="text-align: center;">
            Next automated billing cycle scheduled for <strong>${sub.nextBillingDate}</strong>.
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-primary w-full" onclick="window.closeModal()">Close Invoice</button>
      `
    });
  }

  render();
};
