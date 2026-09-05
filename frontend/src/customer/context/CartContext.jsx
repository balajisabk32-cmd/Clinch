import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from './ToastContext';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/cart');
      setCartItems(res.data);
    } catch (err) {
      console.error('Cart fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToCart = useCallback(async (product_id, variant_id = null, quantity = 1) => {
    try {
      await api.post('/cart', { product_id, variant_id, quantity });
      await fetchCart();
      showToast('Added to cart!', 'success');
    } catch (err) {
      showToast('Failed to add to cart', 'error');
    }
  }, [fetchCart, showToast]);

  const updateCartItem = useCallback(async (id, updates) => {
    try {
      await api.put(`/cart/${id}`, updates);
      setCartItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    } catch (err) {
      showToast('Update failed', 'error');
    }
  }, [showToast]);

  const removeFromCart = useCallback(async (id) => {
    try {
      await api.delete(`/cart/${id}`);
      setCartItems((prev) => prev.filter((item) => item.id !== id));
      showToast('Item removed from cart', 'info');
    } catch (err) {
      showToast('Remove failed', 'error');
    }
  }, [showToast]);

  const submitAsQuote = useCallback(async () => {
    const res = await api.post('/cart/submit-quote');
    setCartItems([]);
    return res.data;
  }, []);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, loading, fetchCart, addToCart, updateCartItem, removeFromCart, submitAsQuote, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
