import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

export default function Login() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('rajesh@acme.com');
  const [password, setPassword] = useState('password123');
  const [magicEmail, setMagicEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicToken, setMagicToken] = useState('');

  const { login } = useAuth();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      showToast('Welcome back! 👋', 'success');
      navigate('/shop');
    } catch (err) {
      showToast(err.response?.data?.error || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/magic-link', { email: magicEmail });
      setMagicToken(res.data.token);
      setMagicSent(true);
      showToast('Magic link generated (demo mode)!', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send magic link', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLogin = async () => {
    try {
      const res = await api.post('/auth/login', { email: magicEmail, password: 'password123' });
      localStorage.setItem('df360_token', magicToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${magicToken}`;
      showToast('Logged in via magic link!', 'success');
      navigate('/shop');
      window.location.reload();
    } catch {
      showToast('Magic login failed', 'error');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">D</div>
          <div className="login-logo-text">Deal<span>Flow</span>360</div>
        </div>

        <p style={{ textAlign: 'center', marginBottom: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Customer Portal — Sign in to access your account
        </p>

        {/* Tabs */}
        <div className="tab-group">
          <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            🔑 Password Login
          </button>
          <button className={`tab-btn ${tab === 'magic' ? 'active' : ''}`} onClick={() => setTab('magic')}>
            ✨ Magic Link
          </button>
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
              {loading ? '⏳ Signing in...' : '🚀 Sign In'}
            </button>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Demo: <strong>rajesh@acme.com</strong> / <strong>password123</strong>
            </div>
          </form>
        )}

        {tab === 'magic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!magicSent ? (
              <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="input" type="email" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} required placeholder="you@company.com" />
                </div>
                <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                  {loading ? '⏳ Sending...' : '✉️ Send Magic Link'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
                <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
                  Magic link generated! In production, this would be emailed to you.
                </p>
                <button className="btn btn-primary btn-full" onClick={handleMagicLogin}>
                  🔓 Click to Login (Demo)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle at bottom */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
