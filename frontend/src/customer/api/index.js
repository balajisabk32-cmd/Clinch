const baseURL = 'http://localhost:5000/api';

const api = {
  async get(endpoint) {
    const token = localStorage.getItem('df360_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${baseURL}${endpoint}`, { headers });
    const data = await res.json();
    return { data };
  },
  async post(endpoint, body) {
    const token = localStorage.getItem('df360_token');
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
    const token = localStorage.getItem('df360_token');
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
    const token = localStorage.getItem('df360_token');
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
