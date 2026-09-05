import React from 'react';
import { useClinchStore } from '../../context/ClinchStoreContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useClinchStore();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {toasts.map(t => {
        let IconComponent = Info;
        if (t.type === 'success') IconComponent = CheckCircle2;
        if (t.type === 'danger' || t.type === 'error') IconComponent = AlertCircle;
        if (t.type === 'warning') IconComponent = AlertTriangle;

        return (
          <div key={t.id} className={`toast toast-${t.type} animate-slide-up`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '280px', maxWidth: '420px', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
            <IconComponent size={18} className={`text-${t.type}`} />
            <span style={{ flex: 1, fontSize: '0.85rem' }}>{t.message}</span>
            <button onClick={() => removeToast(t.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
