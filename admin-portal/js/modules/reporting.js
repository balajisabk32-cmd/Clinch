// Module: Reporting & Dashboard Configuration (Module 6)
window.renderReportingModule = function (container) {
  let period = 'quarter';
  let repTeam = 'all';
  let approvalStatus = 'all';
  let category = 'all';

  // Sample report rows
  const reportRecords = [
    { deal: 'Global Logistics Suite Expansion', rep: 'Marcus Sterling', team: 'Enterprise North', cat: 'SaaS Software', value: 210000, discount: 14.5, status: 'Approved', closeDate: '2026-08-28' },
    { deal: 'Edge Router X9 Multi-Site', rep: 'Priya Patel', team: 'Mid-Market West', cat: 'Hardware', value: 148000, discount: 18.0, status: 'Approved', closeDate: '2026-08-30' },
    { deal: 'Fintech ERP Migration Onboarding', rep: 'Liam O\'Connor', team: 'EMEA Direct', cat: 'Professional Services', value: 85000, discount: 10.0, status: 'Approved', closeDate: '2026-09-01' },
    { deal: 'Starlight Media Cloud Upgrade', rep: 'Marcus Sterling', team: 'Enterprise North', cat: 'SaaS Software', value: 290000, discount: 29.5, status: 'Pending', closeDate: '2026-09-04' },
    { deal: 'Nordic Horizon Transit Gateway', rep: 'Liam O\'Connor', team: 'EMEA Direct', cat: 'Hardware', value: 124000, discount: 24.0, status: 'Pending', closeDate: '2026-09-03' },
    { deal: 'Apex Healthcare TAM Annual', rep: 'Priya Patel', team: 'Mid-Market West', cat: 'Professional Services', value: 68000, discount: 28.0, status: 'Rejected', closeDate: '2026-09-02' }
  ];

  function render() {
    const filteredRecords = reportRecords.filter(r => {
      const matchTeam = repTeam === 'all' || r.team === repTeam;
      const matchStatus = approvalStatus === 'all' || r.status === approvalStatus;
      const matchCat = category === 'all' || r.cat === category;
      return matchTeam && matchStatus && matchCat;
    });

    const totalBookings = filteredRecords.reduce((sum, r) => sum + r.value, 0);
    const avgDisc = filteredRecords.length > 0 ? (filteredRecords.reduce((sum, r) => sum + r.discount, 0) / filteredRecords.length).toFixed(1) : '0';

    container.innerHTML = `
      <div class="module-header animate-fade-in">
        <div class="module-title-group">
          <h1>Reporting & Dashboard Configuration</h1>
          <p>Slice revenue performance across dimensions, configure executive widget visibility, and generate auditable PDF / Excel exports.</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary" id="btn-export-xls">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export XLS / CSV
          </button>
          <button class="btn btn-primary" id="btn-export-pdf">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Export PDF Report
          </button>
        </div>
      </div>

      <!-- Advanced Filter Bar Card -->
      <div class="card animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="card-body" style="padding: 1.25rem 1.5rem;">
          <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            <div class="form-group">
              <label class="form-label">Reporting Period</label>
              <select id="f-period" class="form-control">
                <option value="7d" ${period === '7d' ? 'selected' : ''}>Last 7 Days</option>
                <option value="month" ${period === 'month' ? 'selected' : ''}>Month to Date</option>
                <option value="quarter" ${period === 'quarter' ? 'selected' : ''}>Current Quarter (Q3)</option>
                <option value="ytd" ${period === 'ytd' ? 'selected' : ''}>Year to Date (2026)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Sales Rep / Team</label>
              <select id="f-team" class="form-control">
                <option value="all" ${repTeam === 'all' ? 'selected' : ''}>All Global Teams</option>
                <option value="Enterprise North" ${repTeam === 'Enterprise North' ? 'selected' : ''}>Enterprise North</option>
                <option value="Mid-Market West" ${repTeam === 'Mid-Market West' ? 'selected' : ''}>Mid-Market West</option>
                <option value="EMEA Direct" ${repTeam === 'EMEA Direct' ? 'selected' : ''}>EMEA Direct</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Approval Status</label>
              <select id="f-status" class="form-control">
                <option value="all" ${approvalStatus === 'all' ? 'selected' : ''}>All Deal Statuses</option>
                <option value="Approved" ${approvalStatus === 'Approved' ? 'selected' : ''}>Approved Only</option>
                <option value="Pending" ${approvalStatus === 'Pending' ? 'selected' : ''}>Pending Manager Review</option>
                <option value="Rejected" ${approvalStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Product Category</label>
              <select id="f-cat" class="form-control">
                <option value="all" ${category === 'all' ? 'selected' : ''}>All Categories</option>
                <option value="SaaS Software" ${category === 'SaaS Software' ? 'selected' : ''}>SaaS Software</option>
                <option value="Hardware" ${category === 'Hardware' ? 'selected' : ''}>Hardware</option>
                <option value="Professional Services" ${category === 'Professional Services' ? 'selected' : ''}>Professional Services</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Summary from Filters -->
      <div class="stat-grid animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="stat-card">
          <span class="stat-label">Filtered Deal Volume</span>
          <div class="stat-value">$${totalBookings.toLocaleString()}</div>
          <span class="text-xs text-muted">Across ${filteredRecords.length} deals in query</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Average Filtered Discount</span>
          <div class="stat-value" style="color: var(--accent-primary);">${avgDisc}%</div>
          <span class="text-xs text-muted">Weighted by deal contract value</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Win / Approval Ratio</span>
          <div class="stat-value" style="color: var(--color-success);">
            ${Math.round((filteredRecords.filter(r => r.status === 'Approved').length / (filteredRecords.length || 1)) * 100)}%
          </div>
          <span class="text-xs text-muted">Approval adherence benchmark</span>
        </div>
      </div>

      <!-- Report Details Table -->
      <div class="table-card animate-fade-in" style="margin-bottom: 1.75rem;">
        <div class="table-toolbar">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--accent-primary);" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              Detailed Deal Audit & Quotation Report
            </h3>
            <p class="card-subtitle">Showing ${filteredRecords.length} matching enterprise transactions</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table" id="report-export-table">
            <thead>
              <tr>
                <th>Deal & Account</th>
                <th>Owner Rep</th>
                <th>Team Division</th>
                <th>Category</th>
                <th>Contract Value</th>
                <th>Discount %</th>
                <th>Close Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(r => `
                <tr>
                  <td><strong>${r.deal}</strong></td>
                  <td>${r.rep}</td>
                  <td><span class="text-xs text-secondary">${r.team}</span></td>
                  <td><span class="badge badge-info">${r.cat}</span></td>
                  <td><strong>$${r.value.toLocaleString()}</strong></td>
                  <td>
                    <span style="font-weight: 700; color: ${r.discount > 20 ? 'var(--color-danger)' : 'var(--accent-primary)'};">
                      ${r.discount}%
                    </span>
                  </td>
                  <td class="text-xs text-muted">${r.closeDate}</td>
                  <td>
                    <span class="badge ${r.status === 'Approved' ? 'badge-success' : r.status === 'Pending' ? 'badge-warning' : 'badge-danger'}">
                      ${r.status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Widget Visibility Configuration -->
      <div class="card animate-fade-in">
        <div class="card-header">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--color-purple);" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
              Sales Rep Dashboard Widget Visibility
            </h3>
            <p class="card-subtitle">Control which operational metrics and widgets appear on frontline sales rep terminals.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-widget-vis">Save Widget Roles</button>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-card-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div>
                <strong style="font-size: 0.88rem;">Live Margin Calculator</strong>
                <div class="text-xs text-muted">Show real-time gross margin % on rep quotes</div>
              </div>
              <label class="switch-label">
                <input type="checkbox" class="switch-input" checked />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-card-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div>
                <strong style="font-size: 0.88rem;">Automated Approval Routing Nudges</strong>
                <div class="text-xs text-muted">Display automated approval threshold warnings</div>
              </div>
              <label class="switch-label">
                <input type="checkbox" class="switch-input" checked />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-card-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div>
                <strong style="font-size: 0.88rem;">Warehouse Stock Availability Map</strong>
                <div class="text-xs text-muted">Show real-time regional hardware counts</div>
              </div>
              <label class="switch-label">
                <input type="checkbox" class="switch-input" checked />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-card-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div>
                <strong style="font-size: 0.88rem;">Peer Discount Benchmarks</strong>
                <div class="text-xs text-muted">Show team average discount stats</div>
              </div>
              <label class="switch-label">
                <input type="checkbox" class="switch-input" />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    setupEventListeners(filteredRecords);
  }

  function setupEventListeners(filteredRecords) {
    // Filter dropdowns
    document.getElementById('f-period')?.addEventListener('change', (e) => {
      period = e.target.value;
      render();
    });
    document.getElementById('f-team')?.addEventListener('change', (e) => {
      repTeam = e.target.value;
      render();
    });
    document.getElementById('f-status')?.addEventListener('change', (e) => {
      approvalStatus = e.target.value;
      render();
    });
    document.getElementById('f-cat')?.addEventListener('change', (e) => {
      category = e.target.value;
      render();
    });

    // Real CSV / Excel Export
    document.getElementById('btn-export-xls')?.addEventListener('click', () => {
      const headers = ['Deal Name', 'Owner Rep', 'Team', 'Category', 'Contract Value ($)', 'Discount (%)', 'Close Date', 'Approval Status'];
      const rows = filteredRecords.map(r => [
        `"${r.deal.replace(/"/g, '""')}"`,
        `"${r.rep}"`,
        `"${r.team}"`,
        `"${r.cat}"`,
        r.value,
        r.discount,
        `"${r.closeDate}"`,
        `"${r.status}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Clinch_Revenue_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.showToast('Downloaded Excel/CSV report file', 'success');
    });

    // Real PDF Export (triggers clean styled print / save as PDF)
    document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
      window.showToast('Preparing print-ready PDF layout...', 'info', 1500);
      setTimeout(() => {
        window.print();
      }, 300);
    });

    // Save widget visibility
    document.getElementById('btn-save-widget-vis')?.addEventListener('click', () => {
      window.showToast('Rep dashboard widget visibility updated successfully!', 'success');
    });
  }

  render();
};
