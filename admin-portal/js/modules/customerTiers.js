// Module: Customer Tier Auto-Upgrade Settings (Novelty Feature 7)
window.renderCustomerTiersModule = function (container) {
  const store = window.clinchStore;
  let tiersData = JSON.parse(JSON.stringify(store.getCustomerTiers()));

  function render() {
    container.innerHTML = `
      <div class="module-header animate-fade-in">
        <div class="module-title-group">
          <h1>Customer Tier Auto-Upgrade Settings</h1>
          <p>Configure automated account progression thresholds, manage per-customer manual override locks, and audit tier transitions.</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary" id="btn-run-tier-eval">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            Trigger Tier Evaluator
          </button>
          <button class="btn btn-primary" id="btn-save-tier-settings">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Changes
          </button>
        </div>
      </div>

      <!-- Threshold Configurator Cards -->
      <div class="card animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="card-header">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--tier-gold);" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              Automatic Tier Qualification Thresholds
            </h3>
            <p class="card-subtitle">Accounts meeting either Lifetime Spend or Closed Deals count automatically promote during nightly reconciliation.</p>
          </div>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem;">
            <!-- Bronze -->
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
              <span class="badge-tier badge-bronze" style="margin-bottom: 0.75rem; display: inline-block;">Bronze Tier</span>
              <div class="form-group" style="margin-top: 0.5rem;">
                <label class="form-label">Min Spend ($ / ₹)</label>
                <input type="number" class="form-control" value="0" disabled />
                <span class="form-hint">Baseline tier for all newly onboarded B2B accounts.</span>
              </div>
            </div>

            <!-- Silver -->
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
              <span class="badge-tier badge-silver" style="margin-bottom: 0.75rem; display: inline-block;">Silver Tier</span>
              <div class="form-group" style="margin-top: 0.5rem;">
                <label class="form-label">Min Annual Spend ($)</label>
                <input type="number" id="th-silver-spend" class="form-control" value="${tiersData.thresholds.Silver.minSpend}" />
              </div>
              <div class="form-group" style="margin-top: 0.5rem;">
                <label class="form-label">Or Min Closed Deals</label>
                <input type="number" id="th-silver-deals" class="form-control" value="${tiersData.thresholds.Silver.minDeals}" />
              </div>
            </div>

            <!-- Gold -->
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
              <span class="badge-tier badge-gold" style="margin-bottom: 0.75rem; display: inline-block;">Gold Tier</span>
              <div class="form-group" style="margin-top: 0.5rem;">
                <label class="form-label">Min Annual Spend ($)</label>
                <input type="number" id="th-gold-spend" class="form-control" value="${tiersData.thresholds.Gold.minSpend}" />
              </div>
              <div class="form-group" style="margin-top: 0.5rem;">
                <label class="form-label">Or Min Closed Deals</label>
                <input type="number" id="th-gold-deals" class="form-control" value="${tiersData.thresholds.Gold.minDeals}" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Customer Overrides & Status Table -->
      <div class="table-card animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="table-toolbar">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              Customer Account Tier Status & Mode Override
            </h3>
            <p class="card-subtitle">Toggle between automatic criteria evaluation and executive manual lock per customer account</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer Account</th>
                <th>Lifetime Spend</th>
                <th>Closed Deals</th>
                <th>Current Tier</th>
                <th>Evaluation Mode</th>
                <th>Last Evaluated</th>
                <th style="text-align: right;">Mode Action</th>
              </tr>
            </thead>
            <tbody>
              ${tiersData.customers.map(c => `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td><span style="font-weight: 700; color: var(--text-primary);">$${c.spend.toLocaleString()}</span></td>
                  <td>${c.deals} deals</td>
                  <td><span class="badge-tier badge-${c.currentTier.toLowerCase()}">${c.currentTier}</span></td>
                  <td>
                    <span class="badge ${c.mode === 'Auto' ? 'badge-success' : 'badge-warning'}">
                      ${c.mode === 'Auto' ? 'Automatic Engine' : 'Manual Override Locked'}
                    </span>
                  </td>
                  <td class="text-xs text-muted">${c.lastEvaluated}</td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm btn-toggle-mode" data-id="${c.id}">
                      Switch to ${c.mode === 'Auto' ? 'Manual Lock' : 'Auto Mode'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tier Change Audit Trail Table -->
      <div class="table-card animate-fade-in">
        <div class="table-toolbar">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--text-muted);" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Recent Tier Progression Audit Trail
            </h3>
            <p class="card-subtitle">Complete ledger of automatic threshold upgrades and manual executive tier adjustments</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Previous Tier</th>
                <th>New Promoted Tier</th>
                <th>Effective Date</th>
                <th>Trigger Rationale</th>
                <th>Adjustment Type</th>
                <th>Authorized By</th>
              </tr>
            </thead>
            <tbody>
              ${tiersData.auditTrail.map(t => `
                <tr>
                  <td><strong>${t.customer}</strong></td>
                  <td><span class="badge-tier badge-${t.oldTier.toLowerCase()}">${t.oldTier}</span></td>
                  <td><span class="badge-tier badge-${t.newTier.toLowerCase()}">${t.newTier}</span></td>
                  <td class="text-xs text-muted">${t.date}</td>
                  <td class="text-sm text-secondary">${t.reason}</td>
                  <td>
                    <span class="badge ${t.type === 'Auto' ? 'badge-info' : 'badge-purple'}">${t.type}</span>
                  </td>
                  <td class="text-xs text-muted">${t.admin}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setupEventListeners();
  }

  function setupEventListeners() {
    // Mode toggle
    container.querySelectorAll('.btn-toggle-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const cust = tiersData.customers.find(c => c.id === id);
        if (cust) {
          cust.mode = cust.mode === 'Auto' ? 'Manual' : 'Auto';
          store.toggleCustomerMode(id);
          window.showToast(`${cust.name} mode switched to ${cust.mode}`, 'info');
          render();
        }
      });
    });

    // Run Tier Evaluator
    document.getElementById('btn-run-tier-eval')?.addEventListener('click', () => {
      window.showToast('Tier evaluation complete: 5 accounts audited, 0 changes required', 'success');
    });

    // Save settings
    document.getElementById('btn-save-tier-settings')?.addEventListener('click', () => {
      tiersData.thresholds.Silver.minSpend = parseInt(document.getElementById('th-silver-spend').value, 10) || 25000;
      tiersData.thresholds.Silver.minDeals = parseInt(document.getElementById('th-silver-deals').value, 10) || 3;

      tiersData.thresholds.Gold.minSpend = parseInt(document.getElementById('th-gold-spend').value, 10) || 100000;
      tiersData.thresholds.Gold.minDeals = parseInt(document.getElementById('th-gold-deals').value, 10) || 8;

      store.saveCustomerTiers(tiersData);
      window.showToast('Customer tier thresholds and audit policies saved!', 'success');
      render();
    });
  }

  render();
};
