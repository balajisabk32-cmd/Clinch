import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
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

  const fetchAccountAndOrders = async (silent = false) => {
    try {
      if (!silent && !accountData) setLoading(true);
      /* `/shop/quotes`, not `/shop/quote-requests`.
         The latter is a POST-only route -- creating a quotation request. A GET
         against it answered 405, the guard below turned that error body into an
         empty array, and the Order History tab therefore read "No orders yet"
         for every customer, forever, no matter how many orders they had. */
      const [accRes, quotesRes] = await Promise.all([
        api.get('/shop/me'),
        api.get('/shop/quotes'),
      ]);
      setAccountData(accRes.data);
      const raw = quotesRes.data;
      setOrders(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load account or orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountAndOrders();
    const interval = setInterval(() => {
      fetchAccountAndOrders(true);
    }, 2500);
    const onFocus = () => fetchAccountAndOrders(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    fetchAccountAndOrders(true);
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const initials = accountData?.name
    ? accountData.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  /* The account payload is FLAT -- tier, lifetime_value, next_tier, remaining,
     progress_pct sit at the top level. This read `accountData.tier_progress`,
     a key the server has never sent, so the object was always {} and the whole
     tier panel rendered zeroes: an empty progress bar, a blank next-tier label
     and no spend. That is the "empty profile data". */
  const tier = accountData?.tier ?? 'Bronze';
  // The server returns "Gold"; the comparisons below were against 'gold'.
  const tierKey = String(tier).toLowerCase();
  const lifetimeValue = accountData?.lifetime_value ?? 0;
  const nextTier = accountData?.next_tier ?? null;
  const remaining = accountData?.remaining ?? 0;
  const progressPct = accountData?.progress_pct ?? (nextTier ? 0 : 100);

  /* Orders are the quotations that have been placed. The stage is read from the
     quotation's own status rather than stored twice. */
  const PLACED = ['Confirmed', 'Fulfilled', 'Invoiced', 'Paid'];
  const placedOrders = orders.filter((o) => PLACED.includes(o.status));

  const fmtDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="container" style={{ paddingBottom: '80px' }}>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-3">
        <Link to="/shop" className="hover:text-[#0d1b2a] transition-colors">Home</Link>
        <span>•</span>
        <span className="text-[#0d1b2a] font-medium">Corporate Account</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Corporate Account</h1>
          <p className="page-subtitle">Manage organization profile, B2B tier privileges, and order fulfillment</p>
        </div>
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
               Tier & Corporate Profile
            </button>
            <button
              className={`account-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => handleTabChange('orders')}
            >
               Order History ({orders.length})
            </button>
            <button
              className={`account-nav-item ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => handleTabChange('billing')}
            >
               Logistics & Invoicing
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
                    {tierKey === 'gold' ? '' : tierKey === 'silver' ? '' : ''}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Privilege Tier</div>
                    <div className="tier-name">{tier} Tier Partner</div>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>
                    <span>Annual Purchase Volume</span>
                    <span style={{ color: 'var(--accent)' }}>{formatCurrency(lifetimeValue)}</span>
                  </div>
                  <div className="tier-progress-bar">
                    <div
                      className="tier-progress-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="tier-progress-labels">
                    <span>{formatCurrency(0)}</span>
                    {nextTier ? (
                      <span>Next tier ({nextTier}): {formatCurrency(lifetimeValue + remaining)}</span>
                    ) : accountData?.locked ? (
                      <span>Negotiated contract tier</span>
                    ) : (
                      <span>Top tier reached</span>
                    )}
                  </div>
                </div>

                {nextTier && remaining > 0 && (
                  <div style={{ background: 'var(--bg-hover)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    Spend <strong>{formatCurrency(remaining)}</strong> more to reach{' '}
                    <strong>{nextTier} tier</strong> and its volume pricing.
                  </div>
                )}
                {accountData?.locked && (
                  <div style={{ background: 'var(--bg-hover)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    Your tier is set by a negotiated contract rather than by spend, so it
                    does not move with purchase volume.
                  </div>
                )}
              </div>

              {/* Tier Privileges Comparison */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>B2B Tier Benefits Matrix</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', background: tierKey === 'bronze' ? 'var(--accent-light)' : 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: tierKey === 'bronze' ? '1.5px solid var(--accent)' : '1px solid transparent' }}>
 <div style={{ fontWeight: 700, marginBottom: '8px' }}> Bronze Tier</div>
                    <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <li>Standard catalog prices</li>
                      <li>Standard quotations</li>
                      <li>Email customer support</li>
                    </ul>
                  </div>
                  <div style={{ padding: '16px', background: tierKey === 'silver' ? 'var(--accent-light)' : 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: tierKey === 'silver' ? '1.5px solid var(--accent)' : '1px solid transparent' }}>
 <div style={{ fontWeight: 700, marginBottom: '8px' }}> Silver Tier</div>
                    <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <li>5-8% automatic catalog discount</li>
                      <li>Expedited freight quote approvals</li>
                      <li>Net 30 payment terms eligibility</li>
                    </ul>
                  </div>
                  <div style={{ padding: '16px', background: tierKey === 'gold' ? 'var(--accent-light)' : 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: tierKey === 'gold' ? '1.5px solid var(--accent)' : '1px solid transparent' }}>
 <div style={{ fontWeight: 700, marginBottom: '8px' }}> Gold Tier VIP</div>
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account Manager</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {accountData?.account_manager || 'Being assigned'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GSTIN</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {accountData?.gst_number || 'Not on file'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phone</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {accountData?.phone || 'Not on file'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registered Address</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {[accountData?.address, accountData?.city, accountData?.postcode]
                        .filter(Boolean).join(', ') || 'Not on file'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account Created</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {fmtDate(accountData?.created_at) || 'Not recorded'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'orders' ? (
            /* Orders, with the stage each one has reached and what is in it.

               This tab read `o.order_number`, `o.total_amount` and `o.status`
               from a route that answered 405, so it was permanently empty. It
               now lists the customer's own placed quotations, each showing
               where it has got to and the items actually bought -- which is the
               question the tab exists to answer. */
            <div>
              <h3 style={{ marginBottom: '4px' }}>Orders &amp; fulfilment</h3>
              <p className="page-subtitle" style={{ marginBottom: '16px' }}>
                Quotations you have confirmed, and how far each has progressed.
              </p>

              {placedOrders.length === 0 ? (
                <EmptyState
                  title="No orders yet"
                  description="When you confirm an approved quotation it becomes an order, and its progress appears here."
                  actionText="View Quotations"
                  actionPath="/quotations"
                />
              ) : (
                <div className="order-stage-list">
                  {placedOrders.map((o) => {
                    const stages = ['Confirmed', 'Fulfilled', 'Invoiced', 'Paid'];
                    const reached = stages.indexOf(o.status);
                    return (
                      <article key={o.ref} className="order-stage-card">
                        <div className="order-stage-head">
                          <div>
                            <span className="invoice-ref">{o.ref}</span>
                            <div className="order-stage-status">{o.status}</div>
                          </div>
                          <span className="invoice-amount">{formatCurrency(o.total)}</span>
                        </div>

                        {/* Where it has got to. */}
                        <ol className="order-stage-track">
                          {stages.map((label, i) => (
                            <li
                              key={label}
                              className={i <= reached ? 'is-done' : ''}
                            >
                              <span className="order-stage-dot" />
                              <span className="order-stage-label">{label}</span>
                            </li>
                          ))}
                        </ol>

                        {/* What was bought. The list endpoint sends a compact
                            `items` summary; the full pricing breakdown is on
                            the quotation itself. */}
                        {o.items?.length > 0 && (
                          <ul className="invoice-lines">
                            {o.items.map((l, i) => (
                              <li key={i}>
                                <span>{l.name} <em>&times;{l.qty}</em></span>
                                <span className="invoice-ref">{formatCurrency(l.line_total)}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="order-stage-foot">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/quotations/${o.ref}`)}
                          >
                            View quotation
                          </button>
                          {o.status !== 'Paid' && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/payments')}
                            >
                              Go to payments
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 4px' }}>Delivery &amp; invoicing</h3>
              <p className="page-subtitle" style={{ marginBottom: '20px' }}>
                Taken from your account record. Ask your account manager to change any of it.
              </p>
              {/* Previously this panel printed a hardcoded Mumbai warehouse
                  address and the GSTIN 27AABCA1234F1Z5 for every customer,
                  presented as their own registered details. Both are now read
                  from the account, and a field with nothing in it says so. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Delivery address</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    {accountData?.company}<br />
                    {accountData?.address
                      ? <>{accountData.address}<br /></>
                      : <><em style={{ color: 'var(--text-muted)' }}>No street address on file</em><br /></>}
                    {[accountData?.city, accountData?.postcode].filter(Boolean).join(' ') || ''}
                  </p>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Tax &amp; invoicing</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    <strong>GSTIN:</strong> {accountData?.gst_number || 'Not on file'}<br />
                    <strong>Contact:</strong> {accountData?.phone || 'Not on file'}<br />
                    <strong>Account manager:</strong> {accountData?.account_manager || 'Being assigned'}
                  </p>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Invoices</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.6 }}>
                    Every invoice raised against your orders, with its balance and
                    payment history.
                  </p>
                  <button type="button" className="btn btn-secondary btn-sm"
                          onClick={() => navigate('/payments')}>
                    Open payments
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
