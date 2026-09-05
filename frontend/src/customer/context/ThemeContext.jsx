import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  useEffect(() => {
    // Permanently ensure Clinch unified light theme
    localStorage.setItem('df360_theme', 'light');
    localStorage.removeItem('theme');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
    document.body.classList.remove('dark');
    document.body.classList.add('customer-portal-active');
    document.body.style.backgroundColor = '#f4f6f8';
    document.body.style.color = '#0d1b2a';
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
