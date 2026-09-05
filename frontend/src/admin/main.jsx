import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { ClinchStoreProvider } from './context/ClinchStoreContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ClinchStoreProvider>
        <App />
      </ClinchStoreProvider>
    </ThemeProvider>
  </React.StrictMode>
);
