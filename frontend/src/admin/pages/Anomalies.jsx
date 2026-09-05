import React, { useState } from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { Modal } from '../components/common/Modal';
import { ShieldAlert, RefreshCw, Save, CheckCircle, AlertTriangle, Eye } from 'lucide-react';

export function Anomalies() {
  const { state, updateAnomalyStatus, showToast } = useClinchStore();

  const [sensitivity, setSensitivity] = useState(state.anomalies.settings.sensitivityPct || 12);
  const [marginFloor, setMarginFloor] = useState(state.anomalies.settings.marginFloorErosionPct || 18);
  const [quarterGrace, setQuarterGrace] = useState(state.anomalies.settings.quarterEndGraceAllowed || false);

  const [reviewingAnomaly, setReviewingAnomaly] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  const flagged = state.anomalies.flagged || [];

  const handleScan = () => {
    showToast('Pipeline scanned (184 deals analyzed): 3 anomalies require management sign-off', 'info');
  };

  const handleSaveSettings = () => {
    showToast('Anomaly statistical sensitivity settings saved!', 'success');
  };

  const handleOpenReview = (item) => {
    setReviewingAnomaly(item);
    setReviewNote(item.reviewNote || '');
  };

  const handleAction = (status) => {
    if (!reviewingAnomaly) return;
    updateAnomalyStatus(reviewingAnomaly.id, status, reviewNote);
    setReviewingAnomaly(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div className="module-title-group">
          <h1>Discount Anomaly Detection Settings</h1>
          <p>Statistical outlier detection flagging unusual discounting behavior, rep variance anomalies, and margin leakage risks.</p>
        </div>
        <div className="module-actions">
          <button className="btn btn-secondary" onClick={handleScan}>
            <RefreshCw className="icon icon-sm" size={15} />
            Re-Scan Pipeline (184 Deals)
          </button>
          <button className="btn btn-primary" onClick={handleSaveSettings}>
            <Save className="icon icon-sm" size={15} />
            Save Changes
          </button>
        </div>
      </div>

      {/* Sensitivity & Margin Floor Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert className="icon" size={18} style={{ color: 'var(--color-danger)' }} />
                Anomaly Trigger Sensitivity (Z-Score Deviation)
              </h3>
              <p className="card-subtitle">Flag quotes exceeding a rep's 90-day moving average discount threshold.</p>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="slider-container">
                <input
                  type="range"
                  className="range-slider"
                  min="5"
                  max="30"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value, 10))}
                />
                <span className="range-bubble">+{sensitivity}%</span>
              </div>
              <div style={{ background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Active Rule: Flag deal if proposed discount is <strong style={{ color: 'var(--color-danger)' }}>&ge; {sensitivity}% higher</strong> than that specific sales rep's historical 90-day win average.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle className="icon" size={18} style={{ color: 'var(--color-warning)' }} />
                Margin Erosion & Exceptions Policy
              </h3>
              <p className="card-subtitle">Define automatic escalation limits and quarter-end volume exceptions</p>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Margin Floor Hard Stop (%)</label>
                <input
                  type="number"
                  className="form-control"
                  value={marginFloor}
                  onChange={(e) => setMarginFloor(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="quarterGrace"
                  className="switch-input"
                  checked={quarterGrace}
                  onChange={(e) => setQuarterGrace(e.target.checked)}
                />
                <label htmlFor="quarterGrace" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Allow quarter-end grace period exceptions (last 5 business days)
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flagged Anomalies Queue */}
      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h3 className="card-title">Flagged Outlier Quotes Queue ({flagged.length})</h3>
            <p className="card-subtitle">Deals requiring RevOps inspection due to high deviation or margin leakage.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Rep Name</th>
                <th>Account</th>
                <th>Proposed vs Rep Avg</th>
                <th>Anomaly Score</th>
                <th>Risk Level</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map(a => (
                <tr key={a.id}>
                  <td><span className="font-mono text-xs">{a.id}</span></td>
                  <td><strong>{a.rep}</strong></td>
                  <td>{a.account}</td>
                  <td>
                    <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{a.proposedDiscount}%</span>
                    <span className="text-muted text-xs" style={{ marginLeft: '0.35rem' }}>(avg: {a.repAverage}%)</span>
                  </td>
                  <td>
                    <span className="badge badge-purple font-bold">{a.anomalyScore}/100</span>
                  </td>
                  <td>
                    <span className={`badge badge-${a.risk === 'Critical' ? 'danger' : a.risk === 'High' ? 'warning' : 'info'}`}>
                      {a.risk}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${a.status === 'Approved' ? 'success' : a.status === 'Rejected' ? 'danger' : 'warning'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleOpenReview(a)}>
                      <Eye size={14} style={{ marginRight: '4px' }} /> Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Anomaly Modal */}
      <Modal
        isOpen={!!reviewingAnomaly}
        onClose={() => setReviewingAnomaly(null)}
        title={`Review Outlier Quote: ${reviewingAnomaly?.id || ''}`}
        width="550px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setReviewingAnomaly(null)}>Close</button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={() => handleAction('Rejected')}>
                Block Quote
              </button>
              <button className="btn btn-primary" onClick={() => handleAction('Approved')}>
                Approve Exception
              </button>
            </div>
          </div>
        }
      >
        {reviewingAnomaly && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div><strong>Account:</strong> {reviewingAnomaly.account}</div>
              <div><strong>Sales Rep:</strong> {reviewingAnomaly.rep}</div>
              <div style={{ marginTop: '0.5rem' }}>
                Proposed Discount: <strong style={{ color: 'var(--color-danger)' }}>{reviewingAnomaly.proposedDiscount}%</strong> (Rep 90-Day Avg: {reviewingAnomaly.repAverage}%)
              </div>
              <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Anomaly Score: <strong>{reviewingAnomaly.anomalyScore}/100</strong> | Risk Level: <strong>{reviewingAnomaly.risk}</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Review / Exception Note</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Reason for approving or blocking this anomaly..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
