// Module: System-Wide Analytics Dashboard (Home)
window.renderDashboardModule = function (container) {
  const store = window.clinchStore;
  const analytics = store.getAnalytics();
  const kpis = analytics.kpis;

  container.innerHTML = `
    <div class="module-header animate-fade-in">
      <div class="module-title-group">
        <h1>Revenue & Operations Cockpit</h1>
        <p>Real-time executive visibility across B2B deal velocity, discount governance, and fulfillment pipelines.</p>
      </div>
      <div class="module-actions">
        <button class="btn btn-secondary" id="dash-quick-refresh">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          Live Refresh
        </button>
        <button class="btn btn-primary" id="dash-quick-new-product">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Product
        </button>
      </div>
    </div>

    <!-- 4 Key Performance Indicator Cards -->
    <div class="stat-grid animate-fade-in">
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Total Revenue</span>
          <div class="stat-icon" style="background: var(--color-success-bg); color: var(--color-success);">
            <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
        </div>
        <div class="stat-value">${kpis.totalRevenue}</div>
        <div class="stat-bottom">
          <span class="stat-delta positive">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>
            ${kpis.revenueDelta}
          </span>
          <span class="text-muted">vs previous quarter</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Active Deals in Flight</span>
          <div class="stat-icon" style="background: var(--color-info-bg); color: var(--color-info);">
            <svg class="icon" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
          </div>
        </div>
        <div class="stat-value">${kpis.activeDeals}</div>
        <div class="stat-bottom">
          <span class="stat-delta neutral">${kpis.dealsPipeline}</span>
          <span class="text-muted">weighted pipeline value</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Pending Approvals</span>
          <div class="stat-icon" style="background: var(--color-warning-bg); color: var(--color-warning);">
            <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
        </div>
        <div class="stat-value">${kpis.pendingApprovals}</div>
        <div class="stat-bottom">
          <span class="stat-delta positive">${kpis.approvalsDelta}</span>
          <span class="text-muted">under management review</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Avg Discount Given</span>
          <div class="stat-icon" style="background: var(--color-purple-bg); color: var(--color-purple);">
            <svg class="icon" viewBox="0 0 24 24"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
          </div>
        </div>
        <div class="stat-value">${kpis.avgDiscount}</div>
        <div class="stat-bottom">
          <span class="stat-delta positive">${kpis.discountDelta}</span>
          <span class="text-muted">margin protection active</span>
        </div>
      </div>
    </div>

    <!-- Charts Section Grid -->
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; margin-bottom: 1.75rem;" class="animate-fade-in">
      <!-- Bar Chart: Revenue by Product Category -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              Revenue by Product Category
            </h3>
            <p class="card-subtitle">Quarter-to-date bookings split across portfolio product categories</p>
          </div>
          <span class="badge badge-info">Current Q3</span>
        </div>
        <div class="card-body" style="padding-top: 0.5rem;">
          <div id="chart-cat-revenue" class="chart-container"></div>
        </div>
      </div>

      <!-- Line Chart: Approval Turnaround Time -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--color-info);" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              Approval Turnaround Time (Hours)
            </h3>
            <p class="card-subtitle">7-day moving average resolution time for sales discount requests</p>
          </div>
          <span class="badge badge-success">Target < 4.0h</span>
        </div>
        <div class="card-body" style="padding-top: 0.5rem;">
          <div id="chart-turnaround-trend" class="chart-container"></div>
        </div>
      </div>
    </div>

    <!-- Bottom Row: Recent Activity & Fast Nav Actions -->
    <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 1.5rem;" class="animate-fade-in">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            Recent System Activity Feed
          </h3>
          <span class="badge badge-purple">Realtime</span>
        </div>
        <div class="card-body">
          <div class="activity-feed">
            ${analytics.recentActivity.map(act => `
              <div class="activity-item">
                <div class="activity-avatar" style="background: ${act.color};">
                  <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                </div>
                <div class="activity-content">
                  <div class="activity-title">${act.title}</div>
                  <div class="activity-time">${act.time}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <svg class="icon" style="color: var(--color-warning);" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Admin Quick Actions
          </h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: 1rem;">
          <a href="#discounts" class="btn btn-secondary" style="justify-content: flex-start; padding: 0.9rem 1rem;">
            <svg class="icon" style="color: var(--color-warning);" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <div style="text-align: left; margin-left: 0.5rem;">
              <div style="font-weight: 700; font-size: 0.9rem;">Review Pending Approval Chains</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Inspect 12 discount sign-offs pending manager review</div>
            </div>
          </a>

          <a href="#anomalies" class="btn btn-secondary" style="justify-content: flex-start; padding: 0.9rem 1rem;">
            <svg class="icon" style="color: var(--color-danger);" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <div style="text-align: left; margin-left: 0.5rem;">
              <div style="font-weight: 700; font-size: 0.9rem;">Discount Anomaly Queue (3 High)</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Deals with discounts significantly above historical average</div>
            </div>
          </a>

          <a href="#subscriptions" class="btn btn-secondary" style="justify-content: flex-start; padding: 0.9rem 1rem;">
            <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            <div style="text-align: left; margin-left: 0.5rem;">
              <div style="font-weight: 700; font-size: 0.9rem;">Recurring Subscriptions</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Manage recurring product plans and customer contracts</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  `;

  // Draw SVG Charts
  function drawCharts() {
    window.ClinchCharts.renderBarChart('chart-cat-revenue', analytics.categoryRevenue, {
      prefix: '$',
      height: 230
    });

    window.ClinchCharts.renderLineChart('chart-turnaround-trend', analytics.turnaroundTrend, {
      suffix: 'h',
      height: 230,
      color: '#38bdf8'
    });
  }

  drawCharts();

  // Listen for redraw trigger
  window.removeEventListener('clinch-redraw-charts', drawCharts);
  window.addEventListener('clinch-redraw-charts', drawCharts);

  // Quick action listeners
  document.getElementById('dash-quick-refresh')?.addEventListener('click', () => {
    drawCharts();
    window.showToast('Dashboard metrics refreshed live', 'info', 1800);
  });

  document.getElementById('dash-quick-new-product')?.addEventListener('click', () => {
    if (window.openAddProductModal) {
      window.openAddProductModal();
    } else {
      window.location.hash = '#products';
    }
  });
};
