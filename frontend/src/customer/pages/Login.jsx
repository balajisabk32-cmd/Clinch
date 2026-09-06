import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

export default function Login() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('rajesh@acme.com');
  const [password, setPassword] = useState('password123');
  const [magicEmail, setMagicEmail] = useState('rajesh@acme.com');
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
      showToast('Welcome back!', 'success');
      navigate('/shop');
    } catch (err) {
      showToast(err?.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Demo-only: generate a token locally for already registered customer.
      const fakeToken = `demo-${Date.now()}`;
      setMagicToken(fakeToken);
      setMagicSent(true);
      showToast('Magic link generated for registered customer!', 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to send magic link', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLogin = async () => {
    try {
      // Log in directly as already registered customer (Acme Corp / Gold Tier)
      await login(magicEmail || 'rajesh@acme.com', 'password123');
      showToast('Logged in as registered customer!', 'success');
      navigate('/shop');
    } catch {
      showToast('Magic login failed', 'error');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }} className="login-logo">
          <div className="login-logo-icon">D</div>
          <div className="login-logo-text">Deal<span>Flow</span>360</div>
        </Link>

        <p style={{ textAlign: 'center', marginBottom: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Customer Portal — Sign in to access your account
        </p>

        {/* Tabs */}
        <div className="tab-group">
          <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
             Password Login
          </button>
          <button className={`tab-btn ${tab === 'magic' ? 'active' : ''}`} onClick={() => setTab('magic')}>
             Magic Link
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
              {loading ? '⏳ Signing in...' : 'Sign In'}
            </button>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Registered Customer: <strong>rajesh@acme.com</strong> / <strong>password123</strong> (Acme Corp · Gold Tier)
            </div>
          </form>
        )}

        {tab === 'magic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!magicSent ? (
              <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="input" type="email" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} required placeholder="rajesh@acme.com" />
                </div>
                <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                  {loading ? '⏳ Generating...' : 'Generate Magic Link'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center' }}>
 <div style={{ fontSize: '2.5rem', marginBottom: 12 }}></div>
                <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
                  Magic link generated for registered customer <strong>{magicEmail || 'rajesh@acme.com'}</strong>!
                </p>
                <button className="btn btn-primary btn-full" onClick={handleMagicLogin}>
                   Click to Login as Registered Customer (Demo)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle at bottom */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme}>
            {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
