/**
 * Customer storefront auth context.
 *
 * The old version used `api.defaults.headers.common[...]` which is Axios
 * syntax — `api` is a plain fetch wrapper, so `api.defaults` was undefined,
 * which caused the "Cannot read properties of undefined (reading 'headers')"
 * crash whenever the shop loaded.
 *
 * Token key is `clinch_token` (matching authClient.ts / the Clinch backend).
 * Backend login response shape is { access_token, token_type, user } — the
 * old code destructured { token, customer } which were both undefined.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'clinch_token';
const USER_KEY  = 'clinch_user';

const AuthContext = createContext(null);

/** Read the stored token without any side effects. */
function storedToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/** Call the backend login endpoint and return { access_token, user }. */
async function fetchLogin(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  return res.json();           // { access_token, token_type, expires_in, user, tabs }
}

/** Call /auth/me to validate the token and get a fresh user profile. */
async function fetchMe(token) {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`me failed (${res.status})`);
  return res.json();
}

export function AuthProvider({ children }) {
  const [token, setToken]   = useState(() => storedToken());
  const [user,  setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Persist / clear token in localStorage whenever it changes.
  useEffect(() => {
    if (token) {
      try { localStorage.setItem(TOKEN_KEY, token); } catch {}
    } else {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch {}
    }
  }, [token]);

  // On mount: validate an existing token, or try to auto-login from the
  // Clinch internal session (a logged-in manager who clicks "Storefront").
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const t = storedToken();

      if (t) {
        // Validate the existing token.
        try {
          const me = await fetchMe(t);
          if (!cancelled) { setUser(me); setToken(t); }
        } catch {
          // Token is stale — clear it. The guard in CustomerInnerShell will
          // redirect to /login.
          if (!cancelled) { setToken(null); setUser(null); }
        }
        if (!cancelled) setLoading(false);
        return;
      }

      // No stored token — check if there is a Clinch internal session that
      // belongs to a customer account and try a silent re-login.
      try {
        const raw = localStorage.getItem(USER_KEY);
        if (raw) {
          const clinchUser = JSON.parse(raw);
          if (clinchUser?.role === 'customer' && clinchUser?.email) {
            // The internal session token is already valid — reuse it directly.
            const internToken = localStorage.getItem(TOKEN_KEY);
            if (internToken) {
              const me = await fetchMe(internToken);
              if (!cancelled) { setUser(me); setToken(internToken); }
              if (!cancelled) setLoading(false);
              return;
            }
          }
        }
      } catch { /* ignore */ }

      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);   // run once on mount only

  const login = useCallback(async (email, password) => {
    const data = await fetchLogin(email, password);
    // data = { access_token, token_type, expires_in, user, tabs }
    const { access_token, user: u } = data;
    if (!access_token) throw new Error('No token in login response.');
    try {
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch {}
    setToken(access_token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      // Clean up any legacy keys from the old mock-auth era.
      localStorage.removeItem('df360_token');
      localStorage.removeItem('dealflow_user');
      // Guarantee intro animation is not triggered
      sessionStorage.removeItem('dealflow360_force_intro');
      sessionStorage.setItem('dealflow360_intro_shown', 'true');
      localStorage.setItem('dealflow360_intro_shown', 'true');
    } catch {}
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dealflow360:logout'));
      window.location.assign('/login');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const t = storedToken();
    if (!t) return;
    const me = await fetchMe(t);
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
