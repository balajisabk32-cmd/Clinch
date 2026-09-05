// Main Application Coordinator & SPA Router for Clinch
(function () {
  const routes = {
    '#dashboard': { title: 'Revenue Cockpit', render: window.renderDashboardModule },
    '#products': { title: 'Product & Price Lists', render: window.renderProductsModule },
    '#discounts': { title: 'Discount Approvals', render: window.renderDiscountsModule },
    '#warehouses': { title: 'Warehouses & Fulfillment', render: window.renderWarehousesModule },
    '#subscriptions': { title: 'Recurring Subscriptions', render: window.renderSubscriptionsModule },
    '#reporting': { title: 'Reporting & Analytics', render: window.renderReportingModule },
    '#customerTiers': { title: 'Customer Tier Upgrades', render: window.renderCustomerTiersModule },
    '#anomalies': { title: 'Discount Anomalies', render: window.renderAnomaliesModule },
  };

  function navigateToRoute() {
    let rawHash = window.location.hash || '#dashboard';
    const hash = rawHash.split('?')[0].split('&')[0];
    const route = routes[hash] || routes['#dashboard'];
    const contentArea = document.getElementById('main-content-area');
    const breadcrumbEl = document.getElementById('breadcrumb-current');

    if (breadcrumbEl) {
      breadcrumbEl.textContent = route.title;
    }

    // Update active nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('href') === hash) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Close mobile sidebar if open
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    }

    // Render module
    if (contentArea && typeof route.render === 'function') {
      route.render(contentArea);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Omni-Search Feature (Ctrl+K or click)
  function setupOmniSearch() {
    const searchInputs = document.querySelectorAll('.global-search-trigger');
    
    function openSearchModal() {
      const store = window.clinchStore;
      const products = store.getProducts();

      window.openModal({
        title: 'Clinch Command Palette & Omni-Search',
        width: '600px',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="position: relative;">
              <input type="text" id="omni-search-input" class="form-control" placeholder="Search modules, products, deals, or rules..." autofocus />
            </div>
            <div id="omni-results-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 320px; overflow-y: auto;">
              <div class="text-xs text-muted" style="padding: 0.25rem 0.5rem;">QUICK MODULE JUMPS</div>
              <a href="#products" class="omni-item" style="padding: 0.6rem 0.75rem; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-subtle);">
                <div style="font-weight: 600;">Product Catalog & Variants</div>
                <span class="badge badge-info">Catalog</span>
              </a>
              <a href="#discounts" class="omni-item" style="padding: 0.6rem 0.75rem; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-subtle);">
                <div style="font-weight: 600;">Discount Approvals & Chain Builder</div>
                <span class="badge badge-warning">Governance</span>
              </a>
              <a href="#subscriptions" class="omni-item" style="padding: 0.6rem 0.75rem; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-subtle);">
                <div style="font-weight: 600;">Recurring Subscriptions</div>
                <span class="badge badge-purple">Billing</span>
              </a>
              <a href="#anomalies" class="omni-item" style="padding: 0.6rem 0.75rem; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-subtle);">
                <div style="font-weight: 600;">Flagged Discount Outliers</div>
                <span class="badge badge-danger">3 Critical</span>
              </a>

              <div class="text-xs text-muted" style="padding: 0.5rem 0.5rem 0.25rem;">PRODUCTS & CATALOG (${products.length})</div>
              ${products.slice(0, 3).map(p => `
                <a href="#products" class="omni-item" style="padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-subtle);">
                  <div>
                    <div style="font-weight: 600; font-size: 0.85rem;">${p.name}</div>
                    <span class="text-xs text-muted">${p.sku}</span>
                  </div>
                  <strong style="color: var(--accent-primary);">$${p.basePrice}</strong>
                </a>
              `).join('')}
            </div>
          </div>
        `,
        footerHtml: `
          <span class="text-xs text-muted">Press <kbd style="background: var(--bg-hover); padding: 0.1rem 0.3rem; border-radius: 3px;">ESC</kbd> to exit</span>
          <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
        `,
        onOpen: (body) => {
          const input = body.querySelector('#omni-search-input');
          const results = body.querySelector('#omni-results-list');
          if (input) {
            setTimeout(() => input.focus(), 50);
            input.oninput = function () {
              const q = this.value.toLowerCase().trim();
              if (!q) return;
              const matches = products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
              if (matches.length > 0) {
                results.innerHTML = matches.map(p => `
                  <a href="#products" onclick="window.closeModal()" class="omni-item" style="padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-subtle);">
                    <div>
                      <div style="font-weight: 600; font-size: 0.85rem;">${p.name}</div>
                      <span class="text-xs text-muted">${p.sku}</span>
                    </div>
                    <strong style="color: var(--accent-primary);">$${p.basePrice}</strong>
                  </a>
                `).join('');
              }
            };
          }

          body.querySelectorAll('.omni-item').forEach(item => {
            item.addEventListener('click', () => {
              window.closeModal();
            });
          });
        }
      });
    }

    searchInputs.forEach(input => {
      input.addEventListener('click', openSearchModal);
      input.addEventListener('focus', openSearchModal);
    });

    // Keyboard shortcut (Cmd+K / Ctrl+K)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
      }
    });
  }

  // Notifications Popover
  function setupNotifications() {
    const notifBtn = document.getElementById('notifications-bell-btn');
    if (!notifBtn) return;

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.openModal({
        title: 'RevOps System Notifications',
        width: '500px',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="padding: 0.85rem; border-radius: var(--radius-md); background: var(--color-warning-bg); border: 1px solid var(--color-warning-border); display: flex; gap: 0.75rem; align-items: flex-start;">
              <svg class="icon icon-sm" style="color: var(--color-warning); margin-top: 2px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <div>
                <div style="font-weight: 700; font-size: 0.88rem;">Approval Chain Triggered</div>
                <div class="text-xs text-secondary">Marcus Sterling requested 29.5% discount on Starlight Media ($290k deal). Dual manager + finance sign-off required.</div>
                <div class="text-xs text-muted" style="margin-top: 0.25rem;">15 mins ago</div>
              </div>
            </div>

            <div style="padding: 0.85rem; border-radius: var(--radius-md); background: var(--color-danger-bg); border: 1px solid var(--color-danger-border); display: flex; gap: 0.75rem; align-items: flex-start;">
              <svg class="icon icon-sm" style="color: var(--color-danger); margin-top: 2px;" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>
              <div>
                <div style="font-weight: 700; font-size: 0.88rem;">Discount Outlier Flagged (92% Score)</div>
                <div class="text-xs text-secondary">Quote #QT-9921 exceeded Marcus Sterling's 90-day moving average discount by 15.3%.</div>
                <div class="text-xs text-muted" style="margin-top: 0.25rem;">45 mins ago</div>
              </div>
            </div>

            <div style="padding: 0.85rem; border-radius: var(--radius-md); background: var(--color-success-bg); border: 1px solid var(--color-success-border); display: flex; gap: 0.75rem; align-items: flex-start;">
              <svg class="icon icon-sm" style="color: var(--color-success); margin-top: 2px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <div>
                <div style="font-weight: 700; font-size: 0.88rem;">Customer Tier Promoted to Gold</div>
                <div class="text-xs text-secondary">Vertex BioPharma crossed $100k lifetime spend threshold and was auto-promoted.</div>
                <div class="text-xs text-muted" style="margin-top: 0.25rem;">2 hours ago</div>
              </div>
            </div>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
          <button class="btn btn-primary" id="btn-mark-all-read">Mark All As Read</button>
        `,
        onOpen: (body, footer) => {
          footer.querySelector('#btn-mark-all-read').onclick = () => {
            const badge = document.querySelector('.unread-badge');
            if (badge) badge.style.display = 'none';
            window.closeModal();
            window.showToast('All notifications marked as read', 'info');
          };
        }
      });
    });
  }

  // Profile modal
  function setupProfileMenu() {
    const profileBtn = document.getElementById('user-profile-btn');
    if (!profileBtn) return;

    profileBtn.addEventListener('click', () => {
      window.openModal({
        title: 'Administrator Identity & Organization',
        width: '460px',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 1rem; align-items: center; text-align: center;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800;">
              AV
            </div>
            <div>
              <h3 style="font-size: 1.2rem; font-weight: 800;">Alex Vance</h3>
              <p class="text-sm text-secondary">alex.vance@clinchflow.com</p>
              <span class="badge badge-purple" style="margin-top: 0.35rem;">VP of Revenue Operations (Superadmin)</span>
            </div>

            <div style="width: 100%; border-top: 1px solid var(--border-color); padding-top: 1rem; text-align: left;">
              <div class="form-group">
                <label class="form-label">Active Organization Tenant</label>
                <input type="text" class="form-control" value="Clinch Global Enterprise (dealflow360.live)" disabled />
              </div>
            </div>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
          <button class="btn btn-primary" onclick="window.closeModal(); window.showToast('Profile credentials synced', 'success');">Done</button>
        `
      });
    });
  }

  // Mobile sidebar toggle
  function setupMobileSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('app-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }
  }

  // Init
  window.addEventListener('hashchange', navigateToRoute);

  document.addEventListener('DOMContentLoaded', () => {
    setupOmniSearch();
    setupNotifications();
    setupProfileMenu();
    setupMobileSidebar();
    navigateToRoute();
  });
})();
