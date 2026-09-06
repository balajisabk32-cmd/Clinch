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

  const fetchQuotations = async (silent = false) => {
    try {
      if (!silent && quotations.length === 0) setLoading(true);
      const res = await api.get('/shop/quotes');
      // /shop/quotes returns an array directly.
      // Guard: if it's not an array (e.g. a 404 error body) fall back to [].
      const raw = res.data;
      setQuotations(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load quotations:', err);
      if (!silent) setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
    const interval = setInterval(() => {
      fetchQuotations(true);
    }, 2500);
    const onFocus = () => fetchQuotations(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const filteredQuotations = quotations.filter((q) => {
    const matchesFilter = filter === 'all' || q.state === filter;
    const matchesSearch =
      q.ref?.toLowerCase().includes(search.toLowerCase()) ||
      String(q.total ?? '').includes(search);
    return matchesFilter && matchesSearch;
  });

  const totalValue = quotations.reduce((acc, q) => acc + parseFloat(q.total || 0), 0);
  const activeCount = quotations.filter((q) => ['under_review', 'draft', 'submitted'].includes(q.state)).length;
  const confirmedCount = quotations.filter((q) => ['approved', 'shipped', 'fulfilled'].includes(q.state)).length;

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#7b8ca0] mb-3">
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="hover:text-[#0d1b2a] transition-colors"
        >
          Home
        </button>
        <span>•</span>
        <span className="text-[#0d1b2a] font-medium">Quotations</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-['Syne',sans-serif] text-[2.2rem] font-extrabold text-[#0d1b2a] tracking-tight leading-tight">
            My Quotations
          </h1>
          <p className="text-sm text-[#46586b] mt-1">
            Track, negotiate, and approve your custom B2B pricing proposals
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#0d1b2a] text-white text-sm font-semibold hover:bg-[#0e7490] transition-all shrink-0 shadow-sm"
          onClick={() => navigate('/shop')}
        >
          <span>+ New Quote Request</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-[#0d1b2a]/[0.08] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#7b8ca0] mb-1">
            Total Quotations
          </div>
          <div className="font-['Syne',sans-serif] text-[1.8rem] font-extrabold text-[#0d1b2a] leading-none my-1">
            {quotations.length}
          </div>
          <div className="text-xs text-[#46586b] mt-1 font-medium">
            Lifetime value: <b className="font-mono text-[#0d1b2a]">{formatCurrency(totalValue)}</b>
          </div>
        </div>

        <div className="bg-white border border-[#0d1b2a]/[0.08] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#b45309] mb-1">
            In Negotiation / Review
          </div>
          <div className="font-['Syne',sans-serif] text-[1.8rem] font-extrabold text-[#b45309] leading-none my-1">
            {activeCount}
          </div>
          <div className="text-xs text-[#46586b] mt-1 font-medium">
            Awaiting decision or manager sign-off
          </div>
        </div>

        <div className="bg-white border border-[#0d1b2a]/[0.08] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#047857] mb-1">
            Confirmed & Fulfilled
          </div>
          <div className="font-['Syne',sans-serif] text-[1.8rem] font-extrabold text-[#047857] leading-none my-1">
            {confirmedCount}
          </div>
          <div className="text-xs text-[#46586b] mt-1 font-medium">
            Orders confirmed and shipped
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="tab-group">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending_review', label: 'In Review' },
            { id: 'sent', label: 'Approved' },
            { id: 'under_negotiation', label: 'In Negotiation' },
            { id: 'fulfillment', label: 'Fulfillment' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn ${filter === tab.id ? 'active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder="Filter by quote # or amount..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-xs rounded-full bg-white border border-[#0d1b2a]/[0.1] text-[#0d1b2a] placeholder-[#7b8ca0] focus:outline-none focus:ring-2 focus:ring-[#0e7490]/30 focus:border-[#0e7490] shadow-sm transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="quotation-list">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#7b8ca0]">
            <div className="w-8 h-8 rounded-full border-2 border-[#0e7490] border-t-transparent animate-spin mx-auto mb-3" />
            Loading your quotations...
          </div>
        ) : filteredQuotations.length === 0 ? (
          <EmptyState
            icon=""
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
          filteredQuotations.map((q) => <QuotationCard key={q.ref} quotation={q} />)
        )}
      </div>
    </div>
  );
}
