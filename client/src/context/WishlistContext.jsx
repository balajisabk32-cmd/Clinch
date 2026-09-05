import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api';
import { useToast } from './ToastContext';

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState([]);
  const { showToast } = useToast();

  const fetchWishlist = useCallback(async () => {
    try {
      const res = await api.get('/wishlist');
      setWishlist(res.data);
    } catch (err) {
      console.error('Wishlist fetch error:', err);
    }
  }, []);

  const addToWishlist = useCallback(async (product_id) => {
    try {
      await api.post('/wishlist', { product_id });
      await fetchWishlist();
      showToast('Saved to wishlist! ❤️', 'success');
    } catch (err) {
      showToast('Failed to save', 'error');
    }
  }, [fetchWishlist, showToast]);

  const removeFromWishlist = useCallback(async (id) => {
    try {
      await api.delete(`/wishlist/${id}`);
      setWishlist((prev) => prev.filter((item) => item.id !== id));
      showToast('Removed from wishlist', 'info');
    } catch (err) {
      showToast('Remove failed', 'error');
    }
  }, [showToast]);

  const isInWishlist = useCallback(
    (product_id) => wishlist.some((item) => item.product_id === product_id),
    [wishlist]
  );

  const wishlistCount = wishlist.length;

  return (
    <WishlistContext.Provider value={{ wishlist, fetchWishlist, addToWishlist, removeFromWishlist, isInWishlist, wishlistCount }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
