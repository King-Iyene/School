/**
 * Base URL for the api-server backend. Empty by default, so relative
 * `/api/...` calls keep working under local dev's Vite proxy (see
 * vite.config.ts's server.proxy). Set VITE_API_URL in production
 * (frontend and backend are separate Vercel deployments with different
 * origins, so relative paths would otherwise hit the frontend itself).
 *
 * A bare host (e.g. "school-api-server.vercel.app", no "https://") is a
 * one-character-away mistake that's easy to make when copying a domain out
 * of the Vercel dashboard — and without a scheme, the browser silently
 * resolves it as a *relative path under the current origin* instead of an
 * absolute URL to a different host, reproducing the exact same-origin bug
 * this file exists to fix. Normalize it defensively rather than trust every
 * deployment to set it exactly right.
 */
function normalizeApiBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/$/, '') ?? '';
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL as string | undefined);

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
