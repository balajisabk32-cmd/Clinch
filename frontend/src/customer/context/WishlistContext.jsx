/**
 * Wishlist context — client-side only.
 *
 * There is no backend wishlist endpoint. The list is persisted in
 * localStorage so it survives a page refresh, and it is keyed by product SKU.
 * No network call is made: the wishlist is purely a front-end convenience
 * that the customer uses to shortlist items before requesting a quotation.
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useToast } from './ToastContext';

const WishlistContext = createContext(null);

const STORAGE_KEY = 'clinch_wishlist';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStored(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState(() => loadStored());
  const { showToast } = useToast();

  // Keep localStorage in sync whenever the list changes.
  useEffect(() => { saveStored(wishlist); }, [wishlist]);

  /** `fetchWishlist` is a no-op — the list is already in state from localStorage. */
  const fetchWishlist = useCallback(() => {}, []);

  const addToWishlist = useCallback((product) => {
    const sku = product?.sku ?? product;
    setWishlist((prev) => {
      if (prev.some((item) => item.sku === sku)) return prev;
      const entry = typeof product === 'object' ? product : { sku };
      return [...prev, entry];
    });
    showToast('Saved to wishlist!', 'success');
  }, [showToast]);

  const removeFromWishlist = useCallback((sku) => {
    setWishlist((prev) => prev.filter((item) => item.sku !== sku));
    showToast('Removed from wishlist', 'info');
  }, [showToast]);

  const isInWishlist = useCallback(
    (sku) => wishlist.some((item) => item.sku === sku),
    [wishlist],
  );

  return (
    <WishlistContext.Provider value={{
      wishlist,
      fetchWishlist,
      addToWishlist,
      removeFromWishlist,
      isInWishlist,
      wishlistCount: wishlist.length,
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
