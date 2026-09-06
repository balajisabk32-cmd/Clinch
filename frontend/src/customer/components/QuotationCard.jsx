import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Calendar, Tag } from 'lucide-react';
import { StatusBadge, formatCurrency } from './shared';

export default function QuotationCard({ quotation }) {
  const navigate = useNavigate();

  // Backend /shop/quotes returns { ref, state, total, customer, lines, ... }
  const ref = quotation.ref ?? quotation.id ?? '';
  const total = quotation.total ?? quotation.total_amount ?? 0;
  const state = quotation.state ?? quotation.status ?? '';
  const lines = quotation.lines ?? [];
  const itemCount = lines.length > 0 ? lines.length : (quotation.item_count ?? 0);
  const discountPct = parseFloat(quotation.order_discount_pct || quotation.discount_applied || 0);

  const formattedDate = quotation.created_at
    ? new Date(quotation.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : quotation.last_activity_at
    ? new Date(quotation.last_activity_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className="bg-white border border-[#0d1b2a]/[0.08] hover:border-[#0e7490] rounded-2xl p-5 mb-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
      onClick={() => navigate(`/quotations/${ref}`)}
    >
      {/* Left: Ref, Date, and Line Item Preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="font-mono text-[14px] font-bold text-[#0d1b2a] group-hover:text-[#0e7490] transition-colors">
            {ref}
          </span>
          <StatusBadge status={state} />
          {formattedDate && (
            <span className="inline-flex items-center gap-1 text-xs text-[#7b8ca0]">
              <Calendar size={12} />
              <span>{formattedDate}</span>
            </span>
          )}
        </div>

        {/* Item Count & Product tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#46586b]">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </span>
          {lines.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
              <span className="text-[#7b8ca0] text-xs">•</span>
              {lines.slice(0, 3).map((line, idx) => (
                <span
                  key={idx}
                  className="inline-block max-w-[180px] truncate text-[11.5px] px-2 py-0.5 rounded-md bg-[#f4f6f8] text-[#46586b] border border-[#0d1b2a]/[0.06]"
                  title={`${line.name} ×${line.qty}`}
                >
                  {line.name} <b className="font-mono text-[#0d1b2a]">×{line.qty}</b>
                </span>
              ))}
              {lines.length > 3 && (
                <span className="text-[11px] text-[#7b8ca0]">
                  +{lines.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Total Value, Discount & Chevron */}
      <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#0d1b2a]/[0.06]">
        <div className="text-left md:text-right">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#7b8ca0]">
            Total Value
          </div>
          <div className="font-['Syne',sans-serif] text-[1.25rem] font-bold text-[#0d1b2a] leading-tight">
            {formatCurrency(total)}
          </div>
          {discountPct > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] mt-0.5">
              <Tag size={10} />
              <span>{discountPct}% volume discount</span>
            </span>
          )}
        </div>

        <div className="w-8 h-8 rounded-full bg-[#f4f6f8] group-hover:bg-[#0e7490] text-[#7b8ca0] group-hover:text-white flex items-center justify-center transition-all shrink-0">
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
}

