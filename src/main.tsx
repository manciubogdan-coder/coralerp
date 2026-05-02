
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { clearAppBadge } from './lib/pushNotifications';

// La deschiderea aplicației, curăță badge-ul de pe iconiță
if (typeof window !== 'undefined') {
  clearAppBadge();
  window.addEventListener('focus', () => clearAppBadge());
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

