import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// Self-hosted fonts (no remote origin) — only the weights actually in use.
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles/global.css';
import { migrateFromLocalStorage, ensurePersistentStorage } from './lib/db.js';

// Ask the browser to keep local data (guards against Safari/iOS 7-day eviction).
ensurePersistentStorage();

// Run localStorage → IndexedDB migration, then render
migrateFromLocalStorage().then(() => {
  const root = createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .then((reg) => {
        console.log('SW registered:', reg.scope);

        // Tell Toast.jsx a new SW is installed-and-waiting so it can offer a reload —
        // never activate silently out from under the user.
        function notifyWaiting(worker) {
          if (!worker) return;
          window.dispatchEvent(new window.CustomEvent('labmate-sw-waiting', { detail: { worker } }));
        }

        // An update may already be sitting there waiting when we land on the page.
        if (reg.waiting && navigator.serviceWorker.controller) {
          notifyWaiting(reg.waiting);
        }

        // A controller already exists (this isn't the very first install) and a new
        // worker just finished installing → it's an update, waiting to activate.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyWaiting(newWorker);
            }
          });
        });
      })
      .catch((err) => console.warn('SW registration failed:', err));

    // Once the user accepts the reload prompt (Toast.jsx posts SKIP_WAITING to the
    // waiting worker), the new SW takes control — reload once to pick it up.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
