import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, StatusBadge, TierBadge } from '../components/shared';
import EmptyState from '../components/EmptyState';

export default function Account() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [accountData, setAccountData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    fetchAccountAndOrders();
  }, []);

  const fetchAccountAndOrders = async () => {
    try {
      setLoading(true);
      const [accRes, ordersRes] = await Promise.all([
        api.get('/account'),
        api.get('/orders'),
      ]);
      setAccountData(accRes.data);
      setOrders(ordersRes.data || []);
    } catch (err) {
      console.error('Failed to load account or orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const initials = accountData?.name
    ? accountData.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const tier = accountData?.tier || 'bronze';
  const tierProgress = accountData?.tier_progress || {};

  return (
    <div className="container" style={{ paddingBottom: '80px' }}>
      <div className="page-header">
        <h1 className="page-title">Corporate Account</h1>
        <p className="page-subtitle">Manage organization profile, B2B tier privileges, and order fulfillment</p>
      </div>

      <div className="account-layout">
        {/* Sidebar */}
        <div className="account-sidebar">
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'center', marginBottom: '16px' }}>
            <div className="account-avatar" style={{ margin: '0 auto 16px' }}>{initials}</div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>{accountData?.name || user?.name}</h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{accountData?.company || 'Enterprise Customer'}</p>
            <TierBadge tier={tier} />
            <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{accountData?.email || user?.email}</div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
            <button
              className={`account-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => handleTabChange('profile')}
            >
              👑 Tier & Corporate Profile
            </button>
            <button
              className={`account-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => handleTabChange('orders')}
            >
              📦 Order History ({orders.length})
            </button>
            <button
              className={`account-nav-item ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => handleTabChange('billing')}
            >
              🏢 Logistics & Invoicing
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              Loading corporate account details...
            </div>
          ) : activeTab === 'profile' ? (
            <div>
              {/* Tier Progress Card */}
              <div className="tier-card">
                <div className="tier-header">
                  <div className="tier-icon">
                    {tier === 'gold' ? '🥇' : tier === 'silver' ? '🥈' : '🥉'}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Privilege Tier</div>
                    <div className="tier-name">{tier} Tier Partner</div>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>
                    <span>Annual Purchase Volume</span>
                    <span style={{ color: 'var(--accent)' }}>{formatCurrency(tierProgress.current_spend || 0)}</span>
                  </div>
                  <div className="tier-progress-bar">
                    <div
                      className="tier-progress-fill"
                      style={{ width: `${tierProgress.progress_pct || 0}%` }}
                    />
                  </div>
                  <div className="tier-progress-labels">
                    <span>{formatCurrency(0)}</span>
                    {tierProgress.next_tier ? (
                      <span>Next Tier ({tierProgress.next_tier}): {formatCurrency(tierProgress.next_threshold)}</span>
                    ) : (
                      <span>Maximum Tier Reached! 🎉</span>
                    )}
                  </div>
                </div>

                {tierProgress.amount_to_next > 0 && (
                  <div style={{ background: 'var(--bg-hover)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    💡 Spend <strong>{formatCurrency(tierProgress.amount_to_next)}</strong> more in quotes to unlock <strong>{tierProgress.next_tier?.toUpperCase()} Tier</strong> with higher volume discounts & priority dispatch!
                  </div>
                )}
              </div>

              {/* Tier Privileges Comparison */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>B2B Tier Benefits Matrix</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', background: tier === 'bronze' ? 'var(--accent-light)' : 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: tier === 'bronze' ? '1.5px solid var(--accent)' : '1px solid transparent' }}>
                    <div style={{ fontWeight: 700, marginBottom: '8px' }}>🥉 Bronze Tier</div>
                    <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <li>Standard catalog prices</li>
                      <li>Standard quotations</li>
                      <li>Email customer support</li>
                    </ul>
                  </div>
                  <div style={{ padding: '16px', background: tier === 'silver' ? 'var(--accent-light)' : 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: tier === 'silver' ? '1.5px solid var(--accent)' : '1px solid transparent' }}>
                    <div style={{ fontWeight: 700, marginBottom: '8px' }}>🥈 Silver Tier (Current)</div>
                    <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <li>5-8% automatic catalog discount</li>
                      <li>Expedited freight quote approvals</li>
                      <li>Net 30 payment terms eligibility</li>
                    </ul>
                  </div>
                  <div style={{ padding: '16px', background: tier === 'gold' ? 'var(--accent-light)' : 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: tier === 'gold' ? '1.5px solid var(--accent)' : '1px solid transparent' }}>
                    <div style={{ fontWeight: 700, marginBottom: '8px' }}>🥇 Gold Tier VIP</div>
                    <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <li>12-15% bulk pricing across all SKUs</li>
                      <li>Dedicated Senior Account Director</li>
                      <li>Priority warehouse slot & dispatch</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Organization Info */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Company Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Company Name</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>{accountData?.company}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authorized Representative</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>{accountData?.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Corporate Email</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>{accountData?.email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account Created</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {new Date(accountData?.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'orders' ? (
            <div>
              <h3 style={{ marginBottom: '16px' }}>Confirmed Orders & Fulfillment</h3>
              {orders.length === 0 ? (
                <EmptyState
                  icon="📦"
                  title="No orders yet"
                  description="When you confirm an approved quotation, your orders and dispatch tracking will appear here."
                  actionText="View Quotations"
                  actionPath="/quotations"
                />
              ) : (
                orders.map((o) => (
                  <div
                    key={o.id}
                    className="order-history-item"
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>📦 {o.order_number}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Placed on {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {o.quote_number && ` • From ${o.quote_number}`}
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>
                        {formatCurrency(o.total_amount)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Track shipment ›
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px' }}>Logistics, Delivery Hubs & Invoicing</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Primary Delivery Hub</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Acme Logistics Terminal, Gate #4<br />
                    Plot 12, MIDC Industrial Area, Andheri East<br />
                    Mumbai, Maharashtra 400093
                  </p>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Tax & Invoicing Entity</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    <strong>GSTIN:</strong> 27AABCA1234F1Z5<br />
                    <strong>PAN:</strong> AABCA1234F<br />
                    <strong>Invoice Preference:</strong> Consolidated E-Invoice
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
