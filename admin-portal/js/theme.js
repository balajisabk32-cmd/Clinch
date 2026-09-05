// Theme Manager for Clinch Admin Portal
(function () {
  const THEME_STORAGE_KEY = 'clinch_theme_mode';
  
  // Default to dark theme as requested
  function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return 'dark'; // Deep charcoal/navy SaaS default
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    // Update theme toggle button tooltip/state if present
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.setAttribute('title', `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`);
    }

    // Dispatch custom event for charts or dynamic components
    window.dispatchEvent(new CustomEvent('clinch-theme-changed', { detail: { theme } }));
  }

  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    if (window.showToast) {
      window.showToast(`${next === 'dark' ? 'Dark' : 'Light'} theme activated`, 'info', 1800);
    }
  };

  // Immediate invocation on script load
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', window.toggleTheme);
    }
  });
})();
