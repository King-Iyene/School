/**
 * Base URL for the api-server backend. Empty by default, so relative
 * `/api/...` calls keep working under local dev's Vite proxy (see
 * vite.config.ts's server.proxy). Set VITE_API_URL in production
 * (frontend and backend are separate Vercel deployments with different
 * origins, so relative paths would otherwise hit the frontend itself).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
