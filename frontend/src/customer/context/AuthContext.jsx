import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('df360_token'));
  const [loading, setLoading] = useState(true);

  // Re-fetch user profile on mount if token exists
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/account')
        .then((res) => setUser(res.data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      // Check if logged into Clinch
      try {
        const clinchUser = JSON.parse(localStorage.getItem('clinch_user') || '{}');
        if (clinchUser.email && (clinchUser.role === 'customer' || clinchUser.email.includes('acme') || clinchUser.email.includes('techcorp'))) {
          api.post('/auth/login', { email: clinchUser.email, password: 'password123' })
            .then((res) => {
              const { token: t, customer } = res.data;
              localStorage.setItem('df360_token', t);
              api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
              setToken(t);
              setUser(customer);
            })
            .catch(() => {
              // fallback demo login if needed
              api.post('/auth/login', { email: 'rajesh@acme.com', password: 'password123' })
                .then((res) => {
                  const { token: t, customer } = res.data;
                  localStorage.setItem('df360_token', t);
                  api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
                  setToken(t);
                  setUser(customer);
                })
                .catch(() => {})
                .finally(() => setLoading(false));
            })
            .finally(() => setLoading(false));
          return;
        }
      } catch {}
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, customer } = res.data;
    localStorage.setItem('df360_token', t);
    api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(customer);
    return customer;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('df360_token');
    localStorage.removeItem('clinch_token');
    localStorage.removeItem('clinch_user');
    sessionStorage.clear();
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    window.location.assign('/login');
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get('/account');
    setUser(res.data);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
