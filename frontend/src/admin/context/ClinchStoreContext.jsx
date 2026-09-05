import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { defaultState } from '../data/defaultState';
import { loadStateFromApi } from '../data/fromApi';
import { writeApi, withWrite } from '../data/writeApi';

// v2: the store is now hydrated from the live engine. The version bump
// abandons any cached copy of the old hardcoded catalogue rather than
// letting it resurrect itself out of localStorage on the next load.
const STORE_KEY = 'clinch_master_store_v2';

const ClinchStoreContext = createContext(null);

export function ClinchStoreProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.warehouseStock) {
          parsed.warehouseStock = JSON.parse(JSON.stringify(defaultState.warehouseStock));
        }
        if (parsed.warehouses) {
          parsed.warehouses.forEach((w, i) => {
            if (!w.contactPerson) {
              w.contactPerson = defaultState.warehouses[i]?.contactPerson || 'Logistics Lead';
            }
            if (!w.status || w.status === 'Operational') {
              w.status = 'Active';
            }
          });
        }
        if (parsed.discountApproval) {
          if (parsed.discountApproval.tierCeilings) {
            delete parsed.discountApproval.tierCeilings.Platinum;
          }
          if (parsed.discountApproval.categoryCeilings) {
            delete parsed.discountApproval.categoryCeilings;
          }
          if (!parsed.discountApproval.productDiscountRules) {
            parsed.discountApproval.productDiscountRules = JSON.parse(JSON.stringify(defaultState.discountApproval.productDiscountRules));
          }
          if (!parsed.discountApproval.productRuleAuditLogs) {
            parsed.discountApproval.productRuleAuditLogs = JSON.parse(JSON.stringify(defaultState.discountApproval.productRuleAuditLogs));
          }
        }
        if (parsed.products) {
          defaultState.products.forEach(dp => {
            if (!parsed.products.some(p => p.id === dp.id)) {
              parsed.products.push(JSON.parse(JSON.stringify(dp)));
            }
          });
        }
        if (!parsed.subscriptions || !parsed.subscriptions.recurringPlans || (parsed.subscriptions.plans && parsed.subscriptions.plans.some(p => p.id === 'SUB-STARTER'))) {
          parsed.subscriptions = JSON.parse(JSON.stringify(defaultState.subscriptions));
        }
        if (!parsed.customerSubscriptions || !Array.isArray(parsed.customerSubscriptions) || parsed.customerSubscriptions.length === 0) {
          parsed.customerSubscriptions = JSON.parse(JSON.stringify(defaultState.customerSubscriptions));
        }
        if (parsed.upsell) delete parsed.upsell;
        if (parsed.dealCoach) delete parsed.dealCoach;
        return parsed;
      }
    } catch (e) {
      console.error('Error loading stored state, using default', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  });

  const [toasts, setToasts] = useState([]);
  // 'loading' -> 'live' -> or 'offline' if the engine could not be reached.
  const [dataSource, setDataSource] = useState('loading');

  // Hydrate from the running engine. defaultState is now only a SHAPE
  // reference: it defines the keys the pages read, and every value below is
  // replaced by whatever the API actually returns. If the engine is
  // unreachable we surface that rather than silently presenting the old
  // fictional catalogue as though it were real data.
  // Re-read the engine after a write. The panel shows the server's truth
  // rather than an optimistic local edit that may have been refused.
  const resync = useCallback(async () => {
    try {
      const live = await loadStateFromApi();
      setState(prev => ({ ...prev, ...live }));
      setDataSource('live');
    } catch (err) {
      console.error('Admin resync failed:', err);
      setDataSource('offline');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadStateFromApi()
      .then(live => {
        if (!alive) return;
        setState(prev => ({ ...prev, ...live }));
        setDataSource('live');
      })
      .catch(err => {
        if (!alive) return;
        console.error('Admin store could not reach the engine:', err);
        setDataSource('offline');
      });
    return () => { alive = false; };
  }, []);


  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 4);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving state to localStorage', e);
    }
  }, [state]);

  // Product Actions
  const addProduct = useCallback((product) => {
    // Persist first; the engine is the source of truth for the catalogue.
    withWrite(() => writeApi.createProduct(product), {
      showToast, onOk: resync,
      okMessage: `${product.name} saved to the catalogue`,
    });
    setState(prev => {
      const productRules = { ...(prev.discountApproval.productDiscountRules || {}) };
      if (!productRules[product.id]) {
        productRules[product.id] = { Bronze: 5, Silver: 10, Gold: 15 };
      }
      return {
        ...prev,
        products: [product, ...prev.products],
        discountApproval: {
          ...prev.discountApproval,
          productDiscountRules: productRules
        }
      };
    });
    showToast(`Product "${product.name}" created successfully!`, 'success');
  }, [showToast]);

  const updateProduct = useCallback((id, updated) => {
    withWrite(() => writeApi.updateProduct(
      updated?.sku || updated?.id || id, updated), {
      showToast, onOk: resync, okMessage: 'Product updated',
    });
    setState(prev => ({
      ...prev,
      products: prev.products.map(p => (p.id === id ? { ...p, ...updated } : p))
    }));
    showToast('Product updated successfully!', 'success');
  }, [showToast]);

  const deleteProduct = useCallback((id) => {
    setState(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id)
    }));
    showToast('Product removed from catalog', 'info');
  }, [showToast]);

  // Discount Actions
  const saveTierCeilings = useCallback((ceilings) => {
    withWrite(() => writeApi.savePolicy({ tier_ceiling: ceilings }), {
      showToast, onOk: resync, okMessage: 'Discount tiers applied',
    });
    setState(prev => ({
      ...prev,
      discountApproval: {
        ...prev.discountApproval,
        tierCeilings: { ...prev.discountApproval.tierCeilings, ...ceilings }
      }
    }));
    showToast('Global customer tier discount ceilings saved!', 'success');
  }, [showToast]);

  const saveProductDiscountRule = useCallback((productId, rules, changedBy = 'Alex Vance (VP RevOps)') => {
    setState(prev => {
      const product = prev.products.find(p => p.id === productId);
      const oldRule = prev.discountApproval.productDiscountRules?.[productId] || { Bronze: 5, Silver: 10, Gold: 15 };
      const oldStr = `Bronze: ${oldRule.Bronze}% | Silver: ${oldRule.Silver}% | Gold: ${oldRule.Gold}%`;
      const newStr = `Bronze: ${rules.Bronze}% | Silver: ${rules.Silver}% | Gold: ${rules.Gold}%`;

      const now = new Date();
      const timestamp = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const newLog = {
        id: `PR-AUD-${Date.now().toString().slice(-4)}`,
        productName: product?.name || productId,
        sku: product?.sku || '',
        oldDiscount: oldStr,
        newDiscount: newStr,
        changedBy,
        timestamp
      };

      return {
        ...prev,
        discountApproval: {
          ...prev.discountApproval,
          productDiscountRules: {
            ...prev.discountApproval.productDiscountRules,
            [productId]: rules
          },
          productRuleAuditLogs: [newLog, ...(prev.discountApproval.productRuleAuditLogs || [])]
        }
      };
    });
    showToast('Product discount threshold updated and logged to audit trail!', 'success');
  }, [showToast]);

  const saveApprovalChain = useCallback((chain) => {
    setState(prev => ({
      ...prev,
      discountApproval: {
        ...prev.discountApproval,
        approvalChain: chain
      }
    }));
    showToast('Approval workflow tiers saved!', 'success');
  }, [showToast]);

  // Warehouse Actions
  const addWarehouse = useCallback((warehouse) => {
    setState(prev => ({
      ...prev,
      warehouses: [...prev.warehouses, warehouse],
      warehouseStock: {
        ...prev.warehouseStock,
        [warehouse.id]: []
      }
    }));
    showToast(`Warehouse "${warehouse.name}" registered!`, 'success');
  }, [showToast]);

  const updateWarehouse = useCallback((id, updated) => {
    setState(prev => ({
      ...prev,
      warehouses: prev.warehouses.map(w => (w.id === id ? { ...w, ...updated } : w))
    }));
    showToast('Warehouse details updated!', 'success');
  }, [showToast]);

  const deleteWarehouse = useCallback((id) => {
    setState(prev => {
      const updatedStock = { ...prev.warehouseStock };
      delete updatedStock[id];
      return {
        ...prev,
        warehouses: prev.warehouses.filter(w => w.id !== id),
        warehouseStock: updatedStock
      };
    });
    showToast('Warehouse removed', 'info');
  }, [showToast]);

  const addStock = useCallback((warehouseId, stockItem) => {
    setState(prev => {
      const currentList = prev.warehouseStock[warehouseId] || [];
      const exists = currentList.find(s => s.productId === stockItem.productId);
      let updatedList;
      if (exists) {
        updatedList = currentList.map(s => (s.productId === stockItem.productId ? { ...s, ...stockItem } : s));
      } else {
        updatedList = [...currentList, stockItem];
      }
      return {
        ...prev,
        warehouseStock: {
          ...prev.warehouseStock,
          [warehouseId]: updatedList
        }
      };
    });
    showToast('Warehouse inventory updated successfully!', 'success');
  }, [showToast]);

  const removeStock = useCallback((warehouseId, productId) => {
    setState(prev => ({
      ...prev,
      warehouseStock: {
        ...prev.warehouseStock,
        [warehouseId]: (prev.warehouseStock[warehouseId] || []).filter(s => s.productId !== productId)
      }
    }));
    showToast('Stock entry removed from warehouse', 'info');
  }, [showToast]);

  const saveReplenishmentRules = useCallback((rules) => {
    setState(prev => ({
      ...prev,
      replenishmentRules: { ...prev.replenishmentRules, ...rules }
    }));
    showToast('Replenishment rules updated globally!', 'success');
  }, [showToast]);

  const saveShippingWeighting = useCallback((weighting) => {
    setState(prev => ({
      ...prev,
      shippingWeighting: { ...prev.shippingWeighting, ...weighting }
    }));
    showToast('Fulfillment weighting factors updated!', 'success');
  }, [showToast]);

  // Subscription Actions
  const addRecurringPlan = useCallback((plan) => {
    setState(prev => ({
      ...prev,
      subscriptions: {
        ...prev.subscriptions,
        recurringPlans: [plan, ...(prev.subscriptions?.recurringPlans || [])]
      }
    }));
    showToast('Recurring product plan created successfully!', 'success');
  }, [showToast]);

  const updateRecurringPlan = useCallback((id, updated) => {
    setState(prev => ({
      ...prev,
      subscriptions: {
        ...prev.subscriptions,
        recurringPlans: prev.subscriptions.recurringPlans.map(p => (p.id === id ? { ...p, ...updated } : p))
      }
    }));
    showToast('Recurring plan updated!', 'success');
  }, [showToast]);

  const deleteRecurringPlan = useCallback((id) => {
    setState(prev => ({
      ...prev,
      subscriptions: {
        ...prev.subscriptions,
        recurringPlans: prev.subscriptions.recurringPlans.filter(p => p.id !== id)
      }
    }));
    showToast('Recurring plan deleted', 'info');
  }, [showToast]);

  const addCustomerSubscription = useCallback((sub) => {
    setState(prev => ({
      ...prev,
      customerSubscriptions: [sub, ...(prev.customerSubscriptions || [])]
    }));
    showToast(`Active subscription created for ${sub.customerName}!`, 'success');
  }, [showToast]);

  const cancelCustomerSubscription = useCallback((subId, reason = 'Administrative cancellation') => {
    setState(prev => ({
      ...prev,
      customerSubscriptions: prev.customerSubscriptions.map(s => {
        if (s.id === subId) {
          return {
            ...s,
            status: 'Cancelled',
            autoRenew: false,
            cancellationReason: reason,
            cancelledAt: new Date().toISOString().split('T')[0]
          };
        }
        return s;
      })
    }));
    showToast('Subscription cancelled. Access remains valid until next billing date.', 'warning');
  }, [showToast]);

  // Customer Tiers
  const toggleCustomerMode = useCallback((customerId) => {
    setState(prev => ({
      ...prev,
      customerTiers: {
        ...prev.customerTiers,
        customers: prev.customerTiers.customers.map(c => {
          if (c.id === customerId) {
            return { ...c, mode: c.mode === 'Auto' ? 'Manual' : 'Auto' };
          }
          return c;
        })
      }
    }));
    showToast('Customer tier evaluation mode toggled!', 'info');
  }, [showToast]);

  // Anomalies
  const updateAnomalyStatus = useCallback((anomalyId, status, note = '') => {
    setState(prev => ({
      ...prev,
      anomalies: {
        ...prev.anomalies,
        flagged: prev.anomalies.flagged.map(a => {
          if (a.id === anomalyId) {
            return { ...a, status, reviewNote: note || a.reviewNote };
          }
          return a;
        })
      }
    }));
    showToast(`Anomaly review updated to ${status}!`, 'success');
  }, [showToast]);

  const resetToDefault = useCallback(() => {
    const fresh = JSON.parse(JSON.stringify(defaultState));
    setState(fresh);
    localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
    showToast('All portal data reset to initial seed values', 'warning');
  }, [showToast]);

  const value = {
    state,
    toasts,
    dataSource,
    resync,
    showToast,
    removeToast,
    addProduct,
    updateProduct,
    deleteProduct,
    saveTierCeilings,
    saveProductDiscountRule,
    saveApprovalChain,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    addStock,
    removeStock,
    saveReplenishmentRules,
    saveShippingWeighting,
    addRecurringPlan,
    updateRecurringPlan,
    deleteRecurringPlan,
    addCustomerSubscription,
    cancelCustomerSubscription,
    toggleCustomerMode,
    updateAnomalyStatus,
    resetToDefault
  };

  return (
    <ClinchStoreContext.Provider value={value}>
      {children}
    </ClinchStoreContext.Provider>
  );
}

export function useClinchStore() {
  const context = useContext(ClinchStoreContext);
  if (!context) {
    throw new Error('useClinchStore must be used within a ClinchStoreProvider');
  }
  return context;
}
