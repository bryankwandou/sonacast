import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppPreferencesProvider } from './contexts/AppPreferencesContext.tsx'

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  window.location.protocol.startsWith('http')
) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let lastUpdateCheckAt = Date.now();

    if (hadController) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        try {
          const last = Number(sessionStorage.getItem('sonacast_sw_reloaded_at') || 0);
          if (Date.now() - last < 15000) return;
          sessionStorage.setItem('sonacast_sw_reloaded_at', String(Date.now()));
        } catch {
          // Proceed with reload even if sessionStorage is unavailable
        }
        window.location.reload();
      });
    }

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          const now = Date.now();
          if (now - lastUpdateCheckAt < 60000) return;
          lastUpdateCheckAt = now;
          reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppPreferencesProvider>
      <App />
    </AppPreferencesProvider>
  </StrictMode>,
)
