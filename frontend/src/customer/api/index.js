// Vite dev server proxies /api → http://localhost:8000 via the proxy in vite.config.ts.
// Using a relative base keeps this portable (no hard-coded port), and the
// browser's own origin is always correct in production builds too.
const baseURL = '/api';

const api = {
  async get(endpoint) {
    const token = localStorage.getItem('clinch_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${baseURL}${endpoint}`, { headers });
    const data = await res.json();
    return { data };
  },
  async post(endpoint, body) {
    const token = localStorage.getItem('clinch_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { data };
  },
  async put(endpoint, body) {
    const token = localStorage.getItem('clinch_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${baseURL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { data };
  },
  async delete(endpoint) {
    const token = localStorage.getItem('clinch_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${baseURL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    return { data };
  },
};

export default api;
