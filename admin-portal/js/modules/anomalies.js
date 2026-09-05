// Module: Discount Anomaly Detection Settings (Novelty Feature 9)
window.renderAnomaliesModule = function (container) {
  const store = window.clinchStore;
  let anomaliesData = JSON.parse(JSON.stringify(store.getAnomalies()));

  function render() {
    container.innerHTML = `
      <div class="module-header animate-fade-in">
        <div class="module-title-group">
          <h1>Discount Anomaly Detection Settings</h1>
          <p>Statistical outlier detection flagging unusual discounting behavior, rep variance anomalies, and margin leakage risks.</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary" id="btn-scan-anomalies">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Re-Scan Pipeline (184 Deals)
          </button>
          <button class="btn btn-primary" id="btn-save-anomaly-settings">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Changes
          </button>
        </div>
      </div>

      <!-- Sensitivity & Detection Parameters -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.75rem;" class="animate-fade-in">
        <!-- Sensitivity Slider Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                <svg class="icon" style="color: var(--color-danger);" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Anomaly Trigger Sensitivity (Z-Score Deviation)
              </h3>
              <p class="card-subtitle">Flag quotes exceeding a rep's 90-day moving average discount threshold.</p>
            </div>
          </div>
          <div class="card-body">
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div class="slider-container">
                <input type="range" class="range-slider" id="anomaly-sensitivity-slider" min="5" max="30" value="${anomaliesData.settings.sensitivityPct}" />
                <span class="range-bubble" id="sensitivity-bubble">+${anomaliesData.settings.sensitivityPct}%</span>
              </div>
              <div style="background: var(--bg-card-subtle); border-radius: var(--radius-md); padding: 0.85rem 1rem; border: 1px solid var(--border-color); font-size: 0.82rem; color: var(--text-secondary);">
                Active Rule: Flag deal if proposed discount is <strong style="color: var(--color-danger);">≥ ${anomaliesData.settings.sensitivityPct}% higher</strong> than that specific sales rep's historical 90-day win average.
              </div>
            </div>
          </div>
        </div>

        <!-- Margin Floor & Exceptions -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                <svg class="icon" style="color: var(--color-warning);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                Margin Erosion & Exceptions Policy
              </h3>
              <p class="card-subtitle">Define automatic escalation limits and quarter-end volume exceptions</p>
            </div>
          </div>
          <div class="card-body">
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div class="form-group">
                <label class="form-label">Absolute Margin Erosion Floor Drop (%)</label>
                <input type="number" id="anom-margin-drop" class="form-control" value="${anomaliesData.settings.marginFloorErosionPct}" />
                <span class="form-hint">Immediately flag any quote where deal margin drops by more than this percentage.</span>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                <div>
                  <div style="font-weight: 600; font-size: 0.88rem;">Quarter-End Accelerated Grace Buffer</div>
                  <div class="text-xs text-muted">Automatically loosen anomaly sensitivity by +3% during final 5 days of quarter</div>
                </div>
                <label class="switch-label">
                  <input type="checkbox" class="switch-input" id="anom-grace-period" ${anomaliesData.settings.quarterEndGraceAllowed ? 'checked' : ''} />
                  <span class="switch-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Flagged Anomalies Queue -->
      <div class="table-card animate-fade-in">
        <div class="table-toolbar">
          <div>
            <h3 class="card-title">
              <svg class="icon" style="color: var(--color-danger);" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
              Flagged Outlier Discounts Live Queue (${anomaliesData.flagged.filter(a => a.status === 'Pending Review').length} Pending)
            </h3>
            <p class="card-subtitle">AI-detected quotes exceeding statistical benchmarks requiring RevOps or VP investigation</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Deal & Account</th>
                <th>Sales Rep</th>
                <th>Proposed Discount</th>
                <th>Rep 90d Average</th>
                <th>Anomaly Score</th>
                <th>Risk Level</th>
                <th>Flagged Time</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${anomaliesData.flagged.map(anom => {
                const isCritical = anom.risk === 'Critical';
                const isHigh = anom.risk === 'High';
                const scoreClass = isCritical ? 'anomaly-score-critical' : isHigh ? 'anomaly-score-warning' : 'badge-info';
                return `
                  <tr>
                    <td><strong>${anom.account}</strong></td>
                    <td>${anom.rep}</td>
                    <td>
                      <span style="font-weight: 800; color: ${isCritical ? 'var(--color-danger)' : 'var(--color-warning)'};">
                        ${anom.proposedDiscount}%
                      </span>
                    </td>
                    <td class="text-secondary">${anom.repAverage}%</td>
                    <td>
                      <span class="anomaly-score-badge ${scoreClass}">
                        ${anom.anomalyScore}% Outlier
                      </span>
                    </td>
                    <td>
                      <span class="badge ${isCritical ? 'badge-danger' : isHigh ? 'badge-warning' : 'badge-info'}">
                        ${anom.risk}
                      </span>
                    </td>
                    <td class="text-xs text-muted">${anom.flaggedAt}</td>
                    <td>
                      <span class="badge ${anom.status === 'Pending Review' ? 'badge-warning' : anom.status === 'Approved' ? 'badge-success' : 'badge-purple'}">
                        ${anom.status}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 0.4rem;">
                        <button class="btn btn-secondary btn-sm btn-review-anom" data-id="${anom.id}">
                          Review
                        </button>
                        <button class="btn btn-ghost btn-sm btn-dismiss-anom" data-id="${anom.id}" title="Dismiss" style="color: var(--text-muted);">
                          Dismiss
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

    setupEventListeners();
  }

  function setupEventListeners() {
    // Slider
    const slider = document.getElementById('anomaly-sensitivity-slider');
    const bubble = document.getElementById('sensitivity-bubble');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        anomaliesData.settings.sensitivityPct = val;
        if (bubble) bubble.textContent = `+${val}%`;
      });
    }

    // Re-scan
    document.getElementById('btn-scan-anomalies')?.addEventListener('click', () => {
      window.showToast('Re-scanned all 184 active deals. 3 statistical outliers confirmed.', 'info');
    });

    // Review modal
    container.querySelectorAll('.btn-review-anom').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const anom = anomaliesData.flagged.find(a => a.id === id);
        if (!anom) return;

        window.openModal({
          title: `Investigate Anomaly: ${anom.account}`,
          contentHtml: `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="background: var(--color-danger-bg); border: 1px solid var(--color-danger-border); border-radius: var(--radius-md); padding: 1rem; color: var(--color-danger);">
                <strong>Anomaly Flag:</strong> ${anom.rep} proposed a <strong>${anom.proposedDiscount}%</strong> discount on ${anom.account}.
                Historical baseline for ${anom.rep} is <strong>${anom.repAverage}%</strong> (+${(anom.proposedDiscount - anom.repAverage).toFixed(1)}% variance).
              </div>

              <div class="form-group">
                <label class="form-label">Reviewer Resolution Notes / Justification</label>
                <textarea id="m-anom-notes" class="form-control" rows="3" placeholder="Enter reason for approving exception or requiring deal restructure..."></textarea>
              </div>
            </div>
          `,
          footerHtml: `
            <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
            <button class="btn btn-danger" id="btn-escalate-modal">Escalate to VP</button>
            <button class="btn btn-primary" id="btn-approve-override-modal">Approve Exception</button>
          `,
          onOpen: (body, footer) => {
            footer.querySelector('#btn-approve-override-modal').onclick = () => {
              const note = body.querySelector('#m-anom-notes').value.trim() || 'Approved by RevOps Director with executive exception';
              store.updateAnomalyStatus(anom.id, 'Approved Exception', note);
              window.closeModal();
              render();
              window.showToast(`Exception approved for ${anom.account}`, 'success');
            };

            footer.querySelector('#btn-escalate-modal').onclick = () => {
              const note = body.querySelector('#m-anom-notes').value.trim() || 'Escalated to Executive Revenue Board';
              store.updateAnomalyStatus(anom.id, 'Escalated to VP', note);
              window.closeModal();
              render();
              window.showToast(`Deal escalated to VP Revenue Board`, 'info');
            };
          }
        });
      });
    });

    // Dismiss
    container.querySelectorAll('.btn-dismiss-anom').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        store.updateAnomalyStatus(id, 'Dismissed', 'Dismissed by admin');
        render();
        window.showToast('Anomaly dismissed from active alert queue', 'info');
      });
    });

    // Save Settings
    document.getElementById('btn-save-anomaly-settings')?.addEventListener('click', () => {
      anomaliesData.settings.marginFloorErosionPct = parseFloat(document.getElementById('anom-margin-drop').value) || 18;
      anomaliesData.settings.quarterEndGraceAllowed = document.getElementById('anom-grace-period').checked;

      store.saveAnomalySettings(anomaliesData.settings);
      window.showToast('Discount anomaly detection sensitivity saved!', 'success');
      render();
    });
  }

  render();
};
