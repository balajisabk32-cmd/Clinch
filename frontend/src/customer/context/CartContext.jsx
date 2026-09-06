/**
 * Customer cart context.
 *
 * Backend contract (storefront.py):
 *   GET    /shop/cart            → { lines, subtotal, count, tier }
 *   POST   /shop/cart            body: { sku, qty }  → same shape
 *   DELETE /shop/cart/{sku}      → same shape
 *   POST   /shop/quote-requests  body: { note? }     → { ref, state, rep, message }
 *
 * The old version called /cart (wrong path), sent { product_id, variant_id, quantity }
 * (wrong body), and did setCartItems(res.data) where res.data is the full
 * { lines, subtotal, count, tier } object — not an array — which caused
 * "cartItems.reduce is not a function" on every render.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { useToast } from './ToastContext';

const CartContext = createContext(null);

const TOKEN_KEY = 'clinch_token';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

async function cartFetch(method, path, body) {
  const token = getToken();
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail || ''; } catch {}
    throw new Error(detail || `Cart request failed (${res.status})`);
  }
  return res.json();
}

export function CartProvider({ children }) {
  // Full cart object: { lines, subtotal, count, tier }
  const [cart, setCart] = useState({ lines: [], subtotal: 0, count: 0, tier: 'Bronze' });
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cartFetch('GET', '/api/shop/cart');
      setCart({ lines: [], subtotal: 0, count: 0, tier: 'Bronze', ...data });
    } catch (err) {
      console.error('Cart fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Add or update a line by SKU. qty=0 removes the line. */
  const addToCart = useCallback(async (sku, qty = 1) => {
    try {
      const data = await cartFetch('POST', '/api/shop/cart', { sku, qty });
      setCart({ lines: [], subtotal: 0, count: 0, tier: 'Bronze', ...data });
      showToast('Added to cart!', 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to add to cart', 'error');
    }
  }, [showToast]);

  /** Set an exact quantity for a SKU (qty ≤ 0 removes). */
  const updateCartItem = useCallback(async (sku, qty) => {
    try {
      const data = await cartFetch('POST', '/api/shop/cart', { sku, qty });
      setCart({ lines: [], subtotal: 0, count: 0, tier: 'Bronze', ...data });
    } catch (err) {
      showToast(err?.message || 'Update failed', 'error');
    }
  }, [showToast]);

  const removeFromCart = useCallback(async (sku) => {
    try {
      const data = await cartFetch('DELETE', `/api/shop/cart/${sku}`);
      setCart({ lines: [], subtotal: 0, count: 0, tier: 'Bronze', ...data });
      showToast('Item removed from cart', 'info');
    } catch (err) {
      showToast(err?.message || 'Remove failed', 'error');
    }
  }, [showToast]);

  /** Submit the cart as a quotation request with per-product discount allotments. Returns { ref, state, rep, message }. */
  const submitAsQuote = useCallback(async (note = '', requestedDiscountPct = null, lineDiscounts = {}) => {
    const lines = cart.lines || [];
    const itemsPayload = lines.map((item) => ({
      sku: item.sku,
      qty: item.qty ?? item.quantity ?? 1,
      discount_pct: Number(lineDiscounts[item.sku] || 0),
    }));

    const data = await cartFetch('POST', '/api/shop/quote-requests', {
      note,
      requested_discount_pct: requestedDiscountPct,
      line_discounts: lineDiscounts,
      items: itemsPayload,
    });
    // Optimistically clear the cart
    setCart({ lines: [], subtotal: 0, count: 0, tier: cart.tier });
    return data;
  }, [cart.tier, cart.lines]);

  // Derived values — always safe because cart.lines is always an array
  const cartItems = cart.lines ?? [];
  const cartCount = cart.count ?? cartItems.reduce((s, l) => s + (l.qty ?? 0), 0);
  const cartSubtotal = cart.subtotal ?? 0;

  return (
    <CartContext.Provider value={{
      cart, cartItems, cartCount, cartSubtotal, loading,
      fetchCart, addToCart, updateCartItem, removeFromCart, submitAsQuote,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
