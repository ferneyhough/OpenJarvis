// Must stay the first import: fills in crypto.randomUUID before any module uses it.
import './lib/polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import { initApiBase } from './lib/api';
import { initAvatarSync } from './lib/avatarSync';
import { initAnalytics } from './lib/analytics';
import { applyAppearance } from './lib/themes';
import './index.css';

function applyTheme() {
  try {
    const raw = localStorage.getItem('openjarvis-settings');
    const settings = raw ? JSON.parse(raw) : {};
    applyAppearance({
      theme: settings.theme || 'system',
      colorTheme: settings.colorTheme,
      backgroundOpacity: settings.backgroundOpacity,
    });
  } catch { /* use system default */ }
}

applyTheme();

// Avatar pop-up: broadcast TTS level for the pop-up window and tell the
// desktop host when this window is covered (see lib/avatarSync.ts).
initAvatarSync();

// Fetch the API base URL from the Tauri backend before rendering.
// This ensures JARVIS_PORT is defined in one place (the Rust backend).
// In non-Tauri environments this is a no-op.
initApiBase().finally(() => {
  // Kick off analytics init in the background — it's never awaited so
  // a slow/failed identity fetch never delays UI render.
  void initAnalytics();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
});
