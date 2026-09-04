import { createClient } from '@supabase/supabase-js';

// A bare host (e.g. "xyz.supabase.co", no "https://") is a one-character-away
// mistake when copying the URL out of the Supabase dashboard into Vercel's env
// vars — the exact same failure mode fixed for VITE_API_URL in lib/apiUrl.ts.
// Without a scheme, supabase-js builds request URLs the browser resolves as
// *relative paths under the current origin* instead of Supabase's host,
// which typically surfaces as "TypeError: Failed to fetch" once those paths
// don't line up with anything routable on this app's own domain.
function normalizeSupabaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/$/, '') ?? '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
