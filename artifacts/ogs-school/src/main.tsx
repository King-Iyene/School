import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { supabase } from './lib/supabase';

// A stale/invalid refresh token makes supabase-js throw from its background
// session refresh as an unhandled rejection, crashing the app on load.
// Catch it, clear the stale session, and let the user land on the login page.
function isStaleAuthError(value: unknown): boolean {
  if (typeof value === 'string') return /refresh token/i.test(value);
  const err = value as { name?: string; code?: string; message?: string; status?: number } | undefined;
  return (
    err?.name === 'AuthApiError' ||
    err?.code === 'refresh_token_not_found' ||
    /refresh token/i.test(err?.message ?? '')
  );
}

function recoverFromStaleSession() {
  supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

window.addEventListener('unhandledrejection', (event) => {
  if (isStaleAuthError(event.reason)) {
    event.preventDefault();
    recoverFromStaleSession();
    return;
  }
  // Non-Error rejections (plain objects/strings) crash the dev overlay with an
  // opaque "(unknown runtime error)". Log full detail and keep the app alive.
  if (!(event.reason instanceof Error)) {
    console.error('[unhandled rejection - non-Error value]', event.reason);
    event.preventDefault();
  }
});

// Some browsers/extensions surface the same failure as a plain uncaught
// exception (sometimes a non-Error value) instead of a rejection.
window.addEventListener('error', (event) => {
  if (isStaleAuthError(event.error) || isStaleAuthError(event.message)) {
    event.preventDefault();
    recoverFromStaleSession();
    return;
  }
  if (event.error !== undefined && !(event.error instanceof Error)) {
    console.error('[uncaught exception - non-Error value]', event.error, event.message);
    event.preventDefault();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
