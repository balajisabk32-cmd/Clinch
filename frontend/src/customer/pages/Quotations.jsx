import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import QuotationCard from '../components/QuotationCard';
import EmptyState from '../components/EmptyState';
import { formatCurrency } from '../components/shared';

export default function Quotations() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/quotations');
      setQuotations(res.data || []);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredQuotations = quotations.filter((q) => {
    const matchesFilter = filter === 'all' || q.status === filter;
    const matchesSearch =
      q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      String(q.total_amount).includes(search);
    return matchesFilter && matchesSearch;
  });

  const totalValue = quotations.reduce((acc, q) => acc + parseFloat(q.total_amount || 0), 0);
  const activeCount = quotations.filter((q) => ['sent', 'under_negotiation', 'pending_review'].includes(q.status)).length;
  const confirmedCount = quotations.filter((q) => ['confirmed', 'fulfillment', 'delivered'].includes(q.status)).length;

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">My Quotations</h1>
          <p className="page-subtitle">Track, negotiate, and approve your custom B2B pricing proposals</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/shop')}>
          + New Quote Request
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '24px 0' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Quotes</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{quotations.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Lifetime value: {formatCurrency(totalValue)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginBottom: '4px' }}>In Negotiation / Review</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)' }}>{activeCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Awaiting your decision</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginBottom: '4px' }}>Confirmed & Fulfilled</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{confirmedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Orders placed</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div className="tab-group" style={{ margin: 0 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'pending_review', label: 'In Review' },
            { id: 'sent', label: 'Approved' },
            { id: 'under_negotiation', label: 'In Negotiation' },
            { id: 'fulfillment', label: 'Fulfillment' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${filter === tab.id ? 'active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter by quote #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            maxWidth: '240px',
            padding: '8px 12px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
      </div>

      {/* List */}
      <div className="quotation-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Loading quotations...
          </div>
        ) : filteredQuotations.length === 0 ? (
          <EmptyState
            icon="📄"
            title={search || filter !== 'all' ? 'No matching quotations' : 'No quotations yet'}
            description={
              search || filter !== 'all'
                ? 'Try adjusting your filters or search term.'
                : 'Items added to your cart can be submitted directly as B2B quote requests.'
            }
            actionText={search || filter !== 'all' ? 'Reset Filters' : 'Start Shopping'}
            onAction={
              search || filter !== 'all'
                ? () => { setFilter('all'); setSearch(''); }
                : () => navigate('/shop')
            }
          />
        ) : (
          filteredQuotations.map((q) => <QuotationCard key={q.id} quotation={q} />)
        )}
      </div>
    </div>
  );
}
