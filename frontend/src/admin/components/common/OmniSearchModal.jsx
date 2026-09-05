import React, { useState } from 'react';
import { Modal } from './Modal';
import { useClinchStore } from '../../context/ClinchStoreContext';
import { Search, ExternalLink, Package, ShieldAlert, Sliders, Calendar } from 'lucide-react';

export function OmniSearchModal({ isOpen, onClose, onNavigate }) {
  const { state } = useClinchStore();
  const [query, setQuery] = useState('');

  const filteredProducts = state.products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.sku.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleJump = (route) => {
    onNavigate(route);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clinch Command Palette & Omni-Search"
      width="600px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span className="text-xs text-muted">
            Press <kbd style={{ background: 'var(--bg-hover)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>ESC</kbd> to exit
          </span>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search modules, products, deals, or rules..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
          <div className="text-xs text-muted" style={{ padding: '0.25rem 0.5rem' }}>QUICK MODULE JUMPS</div>

          <div
            onClick={() => handleJump('#products')}
            className="omni-item"
            style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-subtle)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Package size={16} />
              Product Catalog & Variants
            </div>
            <span className="badge badge-info">Catalog</span>
          </div>

          <div
            onClick={() => handleJump('#discounts')}
            className="omni-item"
            style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-subtle)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Sliders size={16} />
              Discount Approvals & Chain Builder
            </div>
            <span className="badge badge-warning">Governance</span>
          </div>

          <div
            onClick={() => handleJump('#subscriptions')}
            className="omni-item"
            style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-subtle)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Calendar size={16} />
              Recurring Subscriptions
            </div>
            <span className="badge badge-purple">Billing</span>
          </div>

          <div
            onClick={() => handleJump('#anomalies')}
            className="omni-item"
            style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-subtle)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <ShieldAlert size={16} />
              Flagged Discount Outliers
            </div>
            <span className="badge badge-danger">3 Critical</span>
          </div>

          <div className="text-xs text-muted" style={{ padding: '0.5rem 0.5rem 0.25rem' }}>
            PRODUCTS & CATALOG ({filteredProducts.length})
          </div>

          {filteredProducts.slice(0, 5).map(p => (
            <div
              key={p.id}
              onClick={() => handleJump('#products')}
              className="omni-item"
              style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-subtle)', cursor: 'pointer' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                <span className="text-xs text-muted">{p.sku}</span>
              </div>
              <strong style={{ color: 'var(--accent-primary)' }}>${p.basePrice}</strong>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
