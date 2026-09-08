import { Router, type Request, type Response, type NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

function vercelUrl(path: string): string {
  const url = new URL(`https://api.vercel.com${path}`);
  if (VERCEL_TEAM_ID) url.searchParams.set("teamId", VERCEL_TEAM_ID);
  return url.toString();
}

interface AuthedRequest extends Request {
  schoolId?: string;
}

/**
 * Same shape as billing.ts's requireBillingAdmin: validate the caller's
 * Supabase session token, then look up their own profile (role/school_id)
 * with that same token so RLS scopes the lookup to themselves. Connecting a
 * domain to the live Vercel project is super_admin/admin only, and always
 * acts on the caller's OWN tenant — never accepts a school id from the
 * request body.
 */
async function requireDomainAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ") || !SUPABASE_URL) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);

  let userRes: globalThis.Response;
  try {
    userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
  } catch (e) {
    req.log?.error?.(e);
    res.status(503).json({ error: "Could not verify your session right now. Please try again shortly." });
    return;
  }
  if (userRes.status === 401 || userRes.status === 403) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  if (!userRes.ok) {
    res.status(503).json({ error: "Could not verify your session right now. Please try again shortly." });
    return;
  }
  const user = (await userRes.json().catch(() => ({}))) as { id?: string };
  if (!user.id) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  let profRes: globalThis.Response;
  try {
    profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role,school_id`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    req.log?.error?.(e);
    res.status(503).json({ error: "Could not load your account right now. Please try again shortly." });
    return;
  }
  const profiles = (await profRes.json().catch(() => [])) as { role?: string; school_id?: string }[];
  const role = profiles[0]?.role ?? "";
  const schoolId = profiles[0]?.school_id ?? null;
  if (!schoolId || (role !== "super_admin" && role !== "admin")) {
    res.status(403).json({ error: "Custom domains are managed by the school's admin." });
    return;
  }

  (req as AuthedRequest).schoolId = schoolId;
  next();
}

/**
 * Registers the caller's own tenant's custom_domain with the live Vercel
 * project, so it actually serves the app instead of just being a verified-
 * but-unconnected data field. Requires the domain to already have passed
 * the DNS TXT ownership check (custom_domain_verified) — Vercel only
 * confirms the domain resolves to it, not who is allowed to claim it, so
 * that check is this app's own line of defense against one tenant
 * squatting another's domain.
 */
router.post("/domains/register-vercel", requireDomainAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;

  if (!VERCEL_API_TOKEN || !VERCEL_PROJECT_ID) {
    res.status(503).json({ error: "Custom domain connection isn't configured on this server yet." });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { data: settings, error: settingsErr } = await supabaseAdmin
    .from("tenant_settings")
    .select("custom_domain, custom_domain_verified")
    .eq("tenant_id", schoolId)
    .maybeSingle();

  if (settingsErr || !settings?.custom_domain) {
    res.status(400).json({ error: "Set a custom domain first." });
    return;
  }
  if (!settings.custom_domain_verified) {
    res.status(400).json({ error: "Verify domain ownership (the DNS TXT record check) before connecting it." });
    return;
  }

  let vercelRes: globalThis.Response;
  try {
    vercelRes = await fetch(vercelUrl(`/v10/projects/${VERCEL_PROJECT_ID}/domains`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: settings.custom_domain }),
    });
  } catch (e) {
    req.log?.error?.(e);
    res.status(503).json({ error: "Could not reach Vercel right now. Please try again shortly." });
    return;
  }

  const body = (await vercelRes.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };

  if (!vercelRes.ok) {
    // Vercel's "domain_already_in_use" message never names which project —
    // it could mean OUR project (a previous attempt already registered it,
    // nothing to do) or a genuinely different one (a real conflict). Ask
    // Vercel directly which case this is, rather than guessing from message
    // text: "Get a Project Domain" 404s if the domain isn't attached to
    // THIS project, and succeeds if it already is.
    if (body.error?.code === "domain_already_in_use") {
      try {
        const existingRes = await fetch(
          vercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${settings.custom_domain}`),
          { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } },
        );
        if (existingRes.ok) {
          res.json({ success: true });
          return;
        }
      } catch (e) {
        req.log?.error?.(e);
      }
      res.status(502).json({
        error: `${settings.custom_domain} is already attached to a different Vercel project. Remove it there first, then try again.`,
      });
      return;
    }

    req.log?.error?.({ vercelError: body.error }, "Vercel domain registration failed");
    res.status(502).json({ error: body.error?.message ?? "Vercel rejected this domain." });
    return;
  }

  res.json({ success: true });
});

/**
 * Live status of the tenant's domain from Vercel's side — lets the UI show
 * real progress ("DNS not pointed at Vercel yet" vs "connected") without
 * the admin needing to guess from a generic error message.
 */
router.get("/domains/vercel-status", requireDomainAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;

  if (!VERCEL_API_TOKEN || !VERCEL_PROJECT_ID) {
    res.status(503).json({ error: "Custom domain connection isn't configured on this server yet." });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { data: settings } = await supabaseAdmin
    .from("tenant_settings")
    .select("custom_domain")
    .eq("tenant_id", schoolId)
    .maybeSingle();

  if (!settings?.custom_domain) {
    res.status(400).json({ error: "No custom domain set." });
    return;
  }

  let configRes: globalThis.Response;
  try {
    configRes = await fetch(vercelUrl(`/v6/domains/${settings.custom_domain}/config`), {
      headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` },
    });
  } catch (e) {
    req.log?.error?.(e);
    res.status(503).json({ error: "Could not reach Vercel right now. Please try again shortly." });
    return;
  }

  if (!configRes.ok) {
    // Vercel not (yet) recognizing this domain at all is a normal state to
    // report while it's mid-setup, not a failure of this endpoint itself —
    // keep the HTTP status 200 so it isn't indistinguishable from a broken
    // route in the browser's network tab.
    res.json({ connected: false, misconfigured: true, notFound: true });
    return;
  }

  const config = (await configRes.json().catch(() => ({}))) as { misconfigured?: boolean };
  res.json({ connected: true, misconfigured: !!config.misconfigured });
});

export default router;
