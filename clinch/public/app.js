// Clinch Deal Health Dashboard Client Logic
let dashboardData = null;
let allDeals = [];
let activeHealthFilter = 'ALL';
let activeStageFilter = 'ALL';
let searchQuery = '';

// Currency formatter for INR
function formatINR(amount) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

// Show Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Fetch Main Dashboard & Deals
async function loadData() {
  const refreshIcon = document.getElementById('refresh-icon');
  if (refreshIcon) refreshIcon.style.animation = 'pulse 0.8s infinite';

  try {
    const [dashRes, dealsRes] = await Promise.all([
      fetch('/api/reports/dashboard'),
      fetch('/api/deals'),
    ]);

    if (!dashRes.ok || !dealsRes.ok) {
      throw new Error('Failed to fetch data from backend');
    }

    dashboardData = await dashRes.json();
    allDeals = await dealsRes.json();

    updateConnectionStatus(true);
    renderOverview();
    renderDealsTable();
    renderReps();
    updateTimestamp(dashboardData.generatedAt);
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    updateConnectionStatus(false);
    showToast('Failed to connect to reporting backend', 'error');
  } finally {
    if (refreshIcon) refreshIcon.style.animation = 'none';
  }
}

function updateConnectionStatus(isOnline) {
  const statusEl = document.getElementById('server-status');
  if (!statusEl) return;
  if (isOnline) {
    statusEl.innerHTML = `
      <span class="status-indicator live"></span>
      <span class="status-label">Backend Live :4000</span>
    `;
    statusEl.style.borderColor = 'rgba(16, 185, 129, 0.25)';
    statusEl.style.background = 'rgba(16, 185, 129, 0.1)';
  } else {
    statusEl.innerHTML = `
      <span class="status-indicator" style="background:#ef4444;box-shadow:0 0 10px #ef4444;"></span>
      <span class="status-label" style="color:#fca5a5;">Offline</span>
    `;
    statusEl.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
  }
}

function updateTimestamp(isoString) {
  const el = document.getElementById('last-updated-text');
  if (!el) return;
  const d = isoString ? new Date(isoString) : new Date();
  el.textContent = `Sync: ${d.toLocaleTimeString()}`;
}

// Render Overview Tab
function renderOverview() {
  if (!dashboardData) return;
  const { summary, statusDistribution, atRiskDeals, stalledDeals } = dashboardData;

  // KPI 1: Pipeline Value
  document.getElementById('kpi-pipeline-val').textContent = formatINR(summary.openPipelineValue);
  document.getElementById('kpi-total-deals-sub').textContent = `${summary.totalDeals} total portfolio deals`;

  // KPI 2: Healthy Deals
  document.getElementById('kpi-healthy-count').textContent = summary.healthyDeals;
  const healthyPct = Math.round((summary.healthyDeals / summary.totalDeals) * 100);
  document.getElementById('kpi-healthy-pct').textContent = `${healthyPct}% of total`;

  // KPI 3: At Risk
  document.getElementById('kpi-atrisk-count').textContent = summary.atRiskDeals;

  // KPI 4: Stalled
  document.getElementById('kpi-stalled-count').textContent = summary.stalledDeals;

  // KPI 5: Avg Discount
  document.getElementById('kpi-avg-discount').textContent = `${summary.averageDiscount.toFixed(1)}%`;

  // Nav counter
  const navCount = document.getElementById('nav-deal-count');
  if (navCount) navCount.textContent = summary.totalDeals;

  // Distribution Bars
  renderDistributionBars(statusDistribution.byHealthCategory, summary.totalDeals);

  // Pipeline Stage Funnel
  renderStagePipeline(statusDistribution.byStage, summary.totalDeals);

  // At-Risk Deals Cards
  renderAtRiskList(atRiskDeals);

  // Stalled Deals Cards
  renderStalledList(stalledDeals);

  // Update Deal tab filter count badges
  document.getElementById('count-all').textContent = summary.totalDeals;
  document.getElementById('count-healthy').textContent = summary.healthyDeals;
  document.getElementById('count-atrisk').textContent = summary.atRiskDeals;
  document.getElementById('count-stalled').textContent = summary.stalledDeals;
  document.getElementById('count-closedlost').textContent = summary.closedLostDeals;
}

// Health Distribution Segments
function renderDistributionBars(byHealth, total) {
  const container = document.getElementById('health-distribution-bars');
  if (!container) return;
  container.innerHTML = '';

  const classMap = {
    HEALTHY: 'healthy',
    AT_RISK: 'at-risk',
    STALLED: 'stalled',
    CLOSED_LOST: 'closed-lost',
  };

  byHealth.forEach(item => {
    if (item.count <= 0) return;
    const pct = ((item.count / total) * 100).toFixed(1);
    const seg = document.createElement('div');
    seg.className = `dist-segment ${classMap[item.healthCategory] || 'healthy'}`;
    seg.style.width = `${pct}%`;
    seg.title = `${item.healthCategory}: ${item.count} (${pct}%)`;
    seg.onclick = () => showTab('deals', item.healthCategory);
    container.appendChild(seg);
  });
}

// Stage Pipeline List
function renderStagePipeline(stages, total) {
  const container = document.getElementById('stage-pipeline-container');
  if (!container) return;
  container.innerHTML = '';

  stages.forEach(item => {
    const pct = Math.round((item.count / total) * 100);
    const row = document.createElement('div');
    row.className = 'stage-row';
    row.innerHTML = `
      <div class="stage-name">${item.stage.replace('_', ' ')}</div>
      <div class="stage-bar-wrap">
        <div class="stage-bar-fill" style="width: ${pct}%"></div>
      </div>
      <div class="stage-count">${item.count}</div>
    `;
    container.appendChild(row);
  });
}

// At-Risk Cards in Overview
function renderAtRiskList(deals) {
  const container = document.getElementById('at-risk-deals-list');
  if (!container) return;
  container.innerHTML = '';

  if (!deals || deals.length === 0) {
    container.innerHTML = '<div class="meta-sub">No deals currently flagged at risk.</div>';
    return;
  }

  deals.forEach(d => {
    const card = document.createElement('div');
    card.className = 'alert-deal-card';
    card.onclick = () => openDealModal(d.dealId);
    card.innerHTML = `
      <div class="alert-card-top">
        <span class="alert-deal-id">${d.dealId}</span>
        <span class="alert-deal-score score-high">Risk Score: ${d.riskScore || 0} (${d.riskLevel})</span>
      </div>
      <div class="alert-card-customer">${d.customerName}</div>
      <div class="alert-card-meta">
        <span>Rep: <strong>${d.salesRep}</strong></span>
        <span>Discount: <strong>${d.discount}%</strong></span>
        <span>Approval: <strong>${d.approvalStage || 'NONE'}</strong></span>
      </div>
      <div class="alert-card-explanation">
        ${d.riskExplanation || 'Discount significantly deviates from historical baseline.'}
      </div>
    `;
    container.appendChild(card);
  });
}

// Stalled Cards in Overview
function renderStalledList(deals) {
  const container = document.getElementById('stalled-deals-list');
  if (!container) return;
  container.innerHTML = '';

  if (!deals || deals.length === 0) {
    container.innerHTML = '<div class="meta-sub">No stalled deals currently detected.</div>';
    return;
  }

  deals.forEach(d => {
    const card = document.createElement('div');
    card.className = 'alert-deal-card';
    card.onclick = () => openDealModal(d.dealId);
    card.innerHTML = `
      <div class="alert-card-top">
        <span class="alert-deal-id">${d.dealId}</span>
        <span class="alert-deal-score score-stalled">${d.daysStalled} Days Inactive</span>
      </div>
      <div class="alert-card-customer">${d.customerName}</div>
      <div class="alert-card-meta">
        <span>Rep: <strong>${d.salesRep}</strong></span>
        <span>Contract Value: <strong>${formatINR(d.value)}</strong></span>
      </div>
      <div class="alert-card-explanation" style="border-left-color: var(--color-warning);">
        Velocity alert: No customer updates or stage transitions in the last ${d.daysStalled} days.
      </div>
    `;
    container.appendChild(card);
  });
}

// Deals Pipeline Table
function renderDealsTable() {
  const tbody = document.getElementById('deals-table-body');
  if (!tbody) return;

  const filtered = allDeals.filter(deal => {
    // Health filter
    if (activeHealthFilter !== 'ALL' && deal.healthCategory !== activeHealthFilter) {
      return false;
    }
    // Stage filter
    if (activeStageFilter !== 'ALL' && deal.stage !== activeStageFilter) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = deal.id.toLowerCase().includes(q);
      const matchCust = (deal.customerName || '').toLowerCase().includes(q);
      const matchRep = (deal.salesRepName || '').toLowerCase().includes(q);
      const matchTags = (deal.scenarioTags || []).some(t => t.toLowerCase().includes(q));
      const matchProd = (deal.products || []).some(p => p.name.toLowerCase().includes(q));
      if (!matchId && !matchCust && !matchRep && !matchTags && !matchProd) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No deals match the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(d => {
    const healthClass = (d.healthCategory || 'HEALTHY').toLowerCase();
    const riskLevel = d.riskLevel || 'NONE';
    const riskClass = riskLevel.toLowerCase();

    return `
      <tr onclick="openDealModal('${d.id}')">
        <td class="deal-id-cell">${d.id}</td>
        <td><strong>${d.customerName}</strong></td>
        <td>${d.salesRepName}</td>
        <td><strong>${formatINR(d.value)}</strong></td>
        <td>${d.discountPercent}%</td>
        <td>
          <span class="status-pill ${healthClass}">
            ${d.healthCategory.replace('_', ' ')}
          </span>
        </td>
        <td>
          <div>${d.stage}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">${d.approvalStage ? 'Stage: ' + d.approvalStage : ''}</div>
        </td>
        <td>
          <span class="risk-badge ${riskClass}">
            ${d.riskScore ? `${d.riskScore} (${d.riskLevel})` : '—'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openDealModal('${d.id}')">
            View
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Sales Rep Benchmarks Tab
function renderReps() {
  if (!dashboardData || !dashboardData.salesRepDiscountHistory) return;
  const container = document.getElementById('reps-container');
  if (!container) return;
  container.innerHTML = '';

  dashboardData.salesRepDiscountHistory.forEach(rep => {
    const card = document.createElement('div');
    card.className = 'glass-card rep-card';

    // Build sparkline bars
    const maxVal = Math.max(...rep.discountHistory, 25);
    const barsHtml = rep.discountHistory.map(val => {
      const heightPct = Math.max(10, Math.round((val / maxVal) * 100));
      const isAnomaly = val >= 20;
      return `
        <div class="spark-bar ${isAnomaly ? 'anomaly' : ''}" 
             style="height: ${heightPct}%" 
             title="Deal Discount: ${val}%">
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="rep-card-top">
        <div class="rep-avatar">${rep.salesRepName.charAt(0)}</div>
        <div>
          <div class="rep-name">${rep.salesRepName}</div>
          <div class="rep-id">${rep.salesRepId}</div>
        </div>
      </div>
      <div class="rep-stats-row">
        <div>
          <div class="rep-stat-label">Deals</div>
          <div class="rep-stat-val">${rep.totalDeals}</div>
        </div>
        <div>
          <div class="rep-stat-label">Avg Discount</div>
          <div class="rep-stat-val">${rep.averageDiscount.toFixed(1)}%</div>
        </div>
        <div>
          <div class="rep-stat-label">Peak Discount</div>
          <div class="rep-stat-val ${rep.highestDiscount >= 20 ? 'text-danger' : ''}">${rep.highestDiscount}%</div>
        </div>
      </div>
      <div class="rep-history-label">
        <span>Discount Variance History</span>
        <span>${rep.discountHistory.length} deals</span>
      </div>
      <div class="sparkline-bars">
        ${barsHtml}
      </div>
    `;
    container.appendChild(card);
  });
}

// Deal Modal Details
async function openDealModal(dealId) {
  const modal = document.getElementById('deal-modal');
  const modalId = document.getElementById('modal-deal-id');
  const modalTitle = document.getElementById('modal-customer-name');
  const modalContent = document.getElementById('modal-content');

  modalId.textContent = dealId;
  modalTitle.textContent = 'Loading deal...';
  modalContent.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Fetching deal details...</div>';
  modal.classList.add('open');

  try {
    const res = await fetch(`/api/deals/${dealId}`);
    if (!res.ok) throw new Error('Deal not found');
    const d = await res.json();

    modalTitle.textContent = d.customerName;

    // Products table
    const productsHtml = (d.products || []).map(p => `
      <tr>
        <td style="padding:8px 0;"><strong>${p.name}</strong> (${p.productId})</td>
        <td style="text-align:center;">${p.qty}</td>
        <td style="text-align:right;">${formatINR(p.unitPrice)}</td>
        <td style="text-align:right;"><strong>${formatINR(p.qty * p.unitPrice)}</strong></td>
      </tr>
    `).join('');

    // Warehouse Split if available
    let whHtml = '';
    if (d.warehouseSplit && d.warehouseSplit.length > 0) {
      whHtml = `
        <div class="modal-section">
          <div class="modal-section-title">Warehouse Allocation Split</div>
          <div style="background:var(--bg-surface-elevated);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
            ${d.warehouseSplit.map(wh => `
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem;">
                <span>${wh.name} (${wh.warehouseId})</span>
                <strong>${wh.unitsAllocated} units</strong>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Subscription details if available
    let subHtml = '';
    if (d.subscription) {
      subHtml = `
        <div class="modal-section">
          <div class="modal-section-title">Subscription Details</div>
          <div class="modal-grid-2">
            <div class="detail-box">
              <div class="detail-box-label">Plan</div>
              <div class="detail-box-value">${d.subscription.planName}</div>
            </div>
            <div class="detail-box">
              <div class="detail-box-label">Billing Cycle</div>
              <div class="detail-box-value">${d.subscription.billingCycle}</div>
            </div>
          </div>
        </div>
      `;
    }

    // Scenario Tags
    const tagsHtml = (d.scenarioTags || []).map(t => `
      <span style="display:inline-block;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:600;margin-right:6px;margin-bottom:6px;">
        #${t}
      </span>
    `).join('');

    modalContent.innerHTML = `
      <!-- Financial Metrics -->
      <div class="modal-section">
        <div class="modal-section-title">Quotation Summary</div>
        <div class="modal-grid-2" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 12px;">
          <div class="detail-box">
            <div class="detail-box-label">Gross Value</div>
            <div class="detail-box-value">${formatINR(d.grossValue)}</div>
          </div>
          <div class="detail-box">
            <div class="detail-box-label">Discount Applied</div>
            <div class="detail-box-value text-purple">${d.discountPercent}%</div>
          </div>
          <div class="detail-box">
            <div class="detail-box-label">Net Contract Value</div>
            <div class="detail-box-value text-success">${formatINR(d.value)}</div>
          </div>
        </div>
        <div class="modal-grid-2">
          <div class="detail-box">
            <div class="detail-box-label">Sales Representative</div>
            <div class="detail-box-value">${d.salesRepName} (${d.salesRepId})</div>
          </div>
          <div class="detail-box">
            <div class="detail-box-label">Lifecycle Stage & Approval</div>
            <div class="detail-box-value">${d.stage} • ${d.approvalStage || 'NONE'}</div>
          </div>
        </div>
      </div>

      <!-- Risk Evaluation -->
      <div class="modal-section">
        <div class="modal-section-title">Health & Risk Analysis</div>
        <div class="risk-alert-box ${d.riskLevel ? d.riskLevel.toLowerCase() : 'healthy'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong style="font-size:0.88rem;color:#ffffff;">
              Status: ${d.healthCategory.replace('_', ' ')}
            </strong>
            <span class="risk-badge ${(d.riskLevel || 'healthy').toLowerCase()}">
              ${d.riskScore ? `Risk Score: ${d.riskScore} (${d.riskLevel})` : 'Normal Risk Exposure'}
            </span>
          </div>
          <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.4;">
            ${d.riskExplanation || (d.daysSinceLastActivity >= 5 ? `Deal has stalled with ${d.daysSinceLastActivity} days of zero activity.` : 'Quotation parameters and discount levels align with standard healthy thresholds.')}
          </div>
        </div>
      </div>

      <!-- Line Items Table -->
      <div class="modal-section">
        <div class="modal-section-title">Quoted Line Items</div>
        <table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-subtle);color:var(--text-muted);text-transform:uppercase;font-size:0.7rem;">
              <th style="text-align:left;padding-bottom:8px;">Product</th>
              <th style="text-align:center;padding-bottom:8px;">Qty</th>
              <th style="text-align:right;padding-bottom:8px;">Unit Price</th>
              <th style="text-align:right;padding-bottom:8px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${productsHtml}
          </tbody>
        </table>
      </div>

      ${whHtml}
      ${subHtml}

      <!-- Tags -->
      <div class="modal-section">
        <div class="modal-section-title">Scenario Tags</div>
        <div>${tagsHtml || '<span class="meta-sub">None</span>'}</div>
      </div>
    `;
  } catch (err) {
    modalContent.innerHTML = `<div style="color:var(--color-danger);padding:20px;">Failed to load deal details: ${err.message}</div>`;
  }
}

// Close Modal
function closeModal() {
  const modal = document.getElementById('deal-modal');
  modal.classList.remove('open');
}

// Tab Switching
function showTab(tabId, subFilter = null) {
  // Update Tab buttons
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update Panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `view-${tabId}`);
  });

  if (tabId === 'deals' && subFilter) {
    activeHealthFilter = subFilter;
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.category === subFilter);
    });
    renderDealsTable();
  }
}

// Reset Seed Data Admin API
async function resetSeedData() {
  const btn = document.getElementById('btn-reset-seed');
  btn.disabled = true;
  btn.style.opacity = '0.6';

  try {
    const res = await fetch('/api/admin/reset-seed', { method: 'POST' });
    if (!res.ok) throw new Error('Reset failed');
    const result = await res.json();
    const dealCount = (result.counts && result.counts.deals) || result.dealsCount || 50;
    showToast(`Seed data reset successfully (${dealCount} deals reloaded)`, 'success');
    await loadData();
  } catch (err) {
    showToast(`Error resetting seed data: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// API Explorer
async function loadApiExplorer(endpoint) {
  const display = document.getElementById('api-json-display');
  const title = document.getElementById('active-api-endpoint');
  title.textContent = `GET ${endpoint}`;
  display.textContent = 'Fetching JSON payload...';

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    display.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    display.textContent = `Error: ${err.message}`;
  }
}

// Copy JSON
function copyApiJson() {
  const code = document.getElementById('api-json-display').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast('JSON copied to clipboard!', 'info');
  });
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // Refresh & Reset buttons
  document.getElementById('btn-refresh').addEventListener('click', () => {
    loadData();
    showToast('Dashboard data refreshed', 'info');
  });

  document.getElementById('btn-reset-seed').addEventListener('click', resetSeedData);

  // Health Filter Pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeHealthFilter = pill.dataset.category;
      renderDealsTable();
    });
  });

  // Search input
  const searchInput = document.getElementById('deal-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderDealsTable();
    });
  }

  // Stage select
  const stageSelect = document.getElementById('stage-filter-select');
  if (stageSelect) {
    stageSelect.addEventListener('change', (e) => {
      activeStageFilter = e.target.value;
      renderDealsTable();
    });
  }

  // Modal close
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('deal-modal').addEventListener('click', (e) => {
    if (e.target.id === 'deal-modal') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // API explorer buttons
  document.querySelectorAll('.api-endpoint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.api-endpoint-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadApiExplorer(btn.dataset.endpoint);
    });
  });

  document.getElementById('btn-copy-json').addEventListener('click', copyApiJson);

  // Initial load
  loadData();
  loadApiExplorer('/api/reports/dashboard');

  // Auto-refresh every 30 seconds
  setInterval(loadData, 30000);
});
