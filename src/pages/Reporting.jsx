import React, { useState } from 'react';
import { useClinchStore } from '../context/ClinchStoreContext';
import { FileDown, Printer, Sliders, CheckCircle2 } from 'lucide-react';

const reportRecords = [
  { deal: 'Global Logistics Suite Expansion', rep: 'Marcus Sterling', team: 'Enterprise North', cat: 'SaaS Software', value: 210000, discount: 14.5, status: 'Approved', closeDate: '2026-08-28' },
  { deal: 'Edge Router X9 Multi-Site', rep: 'Priya Patel', team: 'Mid-Market West', cat: 'Hardware', value: 148000, discount: 18.0, status: 'Approved', closeDate: '2026-08-30' },
  { deal: 'Fintech ERP Migration Onboarding', rep: 'Liam O\'Connor', team: 'EMEA Direct', cat: 'Professional Services', value: 85000, discount: 10.0, status: 'Approved', closeDate: '2026-09-01' },
  { deal: 'Starlight Media Cloud Upgrade', rep: 'Marcus Sterling', team: 'Enterprise North', cat: 'SaaS Software', value: 290000, discount: 29.5, status: 'Pending', closeDate: '2026-09-04' },
  { deal: 'Nordic Horizon Transit Gateway', rep: 'Liam O\'Connor', team: 'EMEA Direct', cat: 'Hardware', value: 124000, discount: 24.0, status: 'Pending', closeDate: '2026-09-03' },
  { deal: 'Apex Healthcare TAM Annual', rep: 'Priya Patel', team: 'Mid-Market West', cat: 'Professional Services', value: 68000, discount: 28.0, status: 'Rejected', closeDate: '2026-09-02' }
];

export function Reporting() {
  const { showToast } = useClinchStore();

  const [period, setPeriod] = useState('quarter');
  const [repTeam, setRepTeam] = useState('all');
  const [approvalStatus, setApprovalStatus] = useState('all');
  const [category, setCategory] = useState('all');

  const filtered = reportRecords.filter(r => {
    const matchTeam = repTeam === 'all' || r.team === repTeam;
    const matchStatus = approvalStatus === 'all' || r.status === approvalStatus;
    const matchCat = category === 'all' || r.cat === category;
    return matchTeam && matchStatus && matchCat;
  });

  const totalBookings = filtered.reduce((acc, r) => acc + r.value, 0);
  const avgDisc = filtered.length > 0 ? (filtered.reduce((acc, r) => acc + r.discount, 0) / filtered.length).toFixed(1) : '0';

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div className="module-title-group">
          <h1>Reporting & Dashboard Configuration</h1>
          <p>Slice revenue performance across dimensions, configure executive widget visibility, and generate auditable PDF / Excel exports.</p>
        </div>
        <div className="module-actions">
          <button className="btn btn-secondary" onClick={() => showToast('Report exported as CSV / Excel spreadsheet', 'success')}>
            <FileDown className="icon icon-sm" size={15} />
            Export XLS / CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer className="icon icon-sm" size={15} />
            Export PDF Report
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-body" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Reporting Period</label>
              <select className="form-control" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="7d">Last 7 Days</option>
                <option value="month">Month to Date</option>
                <option value="quarter">Current Quarter (Q3)</option>
                <option value="ytd">Year to Date (2026)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Sales Rep / Team</label>
              <select className="form-control" value={repTeam} onChange={(e) => setRepTeam(e.target.value)}>
                <option value="all">All Global Teams</option>
                <option value="Enterprise North">Enterprise North</option>
                <option value="Mid-Market West">Mid-Market West</option>
                <option value="EMEA Direct">EMEA Direct</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Approval Status</label>
              <select className="form-control" value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="Approved">Approved Only</option>
                <option value="Pending">Pending Review</option>
                <option value="Rejected">Rejected Only</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Product Category</label>
              <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All Product Categories</option>
                <option value="SaaS Software">SaaS Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Professional Services">Professional Services</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="stat-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Filtered Bookings Volume</span></div>
          <div className="stat-value">${totalBookings.toLocaleString()}</div>
          <div className="stat-bottom"><span className="text-muted">{filtered.length} matching transactions</span></div>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Blended Average Discount</span></div>
          <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>{avgDisc}%</div>
          <div className="stat-bottom"><span className="stat-delta positive">Within target range (&lt;16%)</span></div>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="table-card" style={{ marginBottom: '1.75rem' }}>
        <div className="table-toolbar">
          <div>
            <h3 className="card-title">Detailed Deal Transaction Audit Records</h3>
            <p className="card-subtitle">Showing {filtered.length} transactions across filtered dimensions</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Deal Name</th>
                <th>Rep</th>
                <th>Team</th>
                <th>Category</th>
                <th>Contract Value</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Close Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.deal}</strong></td>
                  <td>{r.rep}</td>
                  <td><span className="badge badge-info">{r.team}</span></td>
                  <td>{r.cat}</td>
                  <td><strong>${r.value.toLocaleString()}</strong></td>
                  <td><strong style={{ color: 'var(--color-warning)' }}>{r.discount}%</strong></td>
                  <td>
                    <span className={`badge badge-${r.status === 'Approved' ? 'success' : r.status === 'Pending' ? 'warning' : 'danger'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="text-xs text-muted">{r.closeDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Executive Widget Configuration */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Executive Revenue Widget Visibility & Controls</h3>
          <p className="card-subtitle">Enable or disable real-time cockpit modules and rep quotation guidance widgets.</p>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Live Margin Calculator</strong>
                <div className="text-xs text-muted">Show real-time gross margin % on rep quotes</div>
              </div>
              <input type="checkbox" className="switch-input" defaultChecked />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Automated Approval Routing Nudges</strong>
                <div className="text-xs text-muted">Display automated approval threshold warnings</div>
              </div>
              <input type="checkbox" className="switch-input" defaultChecked />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Warehouse Stock Availability Map</strong>
                <div className="text-xs text-muted">Show real-time regional hardware counts</div>
              </div>
              <input type="checkbox" className="switch-input" defaultChecked />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Peer Discount Benchmarks</strong>
                <div className="text-xs text-muted">Show team average discount stats</div>
              </div>
              <input type="checkbox" className="switch-input" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
