import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, createHmac } from "node:crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

interface AuthedRequest extends Request {
  schoolId?: string;
  userId?: string;
}

/** Same shape as domains.ts's requireDomainAdmin — registering an outbound webhook is account-level integration config, not a day-to-day staff task. */
async function requireWebhookAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    res.status(403).json({ error: "Webhooks are managed by the school's admin." });
    return;
  }

  (req as AuthedRequest).schoolId = schoolId;
  (req as AuthedRequest).userId = user.id;
  next();
}

function maskSecret(secret: string) {
  return `whsec_...${secret.slice(-4)}`;
}

router.get("/webhooks", requireWebhookAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("tenant_webhooks")
    .select("id, url, description, events, is_active, secret, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: "Could not load webhooks." });
    return;
  }

  res.json({ webhooks: (data ?? []).map((w) => ({ ...w, secret: maskSecret(w.secret) })) });
});

router.post("/webhooks", requireWebhookAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  const userId = (req as AuthedRequest).userId!;
  const { url, events, description } = req.body as { url?: string; events?: string[]; description?: string };

  if (!url || !/^https:\/\//i.test(url)) {
    res.status(400).json({ error: "Webhook URL must be an https:// address." });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const secret = `whsec_${randomBytes(24).toString("hex")}`;

  const { data, error } = await supabaseAdmin
    .from("tenant_webhooks")
    .insert({
      school_id: schoolId,
      url,
      description: description ?? "",
      events: Array.isArray(events) ? events : [],
      secret,
      created_by: userId,
    })
    .select("id, url, description, events, is_active, created_at")
    .single();

  if (error || !data) {
    res.status(500).json({ error: "Could not create the webhook." });
    return;
  }

  // The only time the full secret is ever returned — the caller must save it now.
  res.json({ webhook: { ...data, secret } });
});

router.patch("/webhooks/:id", requireWebhookAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  const id = String(req.params.id);
  const { url, events, description, is_active } = req.body as {
    url?: string;
    events?: string[];
    description?: string;
    is_active?: boolean;
  };

  if (url && !/^https:\/\//i.test(url)) {
    res.status(400).json({ error: "Webhook URL must be an https:// address." });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (url !== undefined) patch.url = url;
  if (events !== undefined) patch.events = events;
  if (description !== undefined) patch.description = description;
  if (is_active !== undefined) patch.is_active = is_active;

  const { error } = await supabaseAdmin.from("tenant_webhooks").update(patch).eq("id", id).eq("school_id", schoolId);
  if (error) {
    res.status(500).json({ error: "Could not update the webhook." });
    return;
  }
  res.json({ success: true });
});

router.post("/webhooks/:id/regenerate-secret", requireWebhookAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  const id = String(req.params.id);
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const { error } = await supabaseAdmin
    .from("tenant_webhooks")
    .update({ secret, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);

  if (error) {
    res.status(500).json({ error: "Could not regenerate the secret." });
    return;
  }
  res.json({ secret });
});

router.delete("/webhooks/:id", requireWebhookAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  const id = String(req.params.id);
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { error } = await supabaseAdmin.from("tenant_webhooks").delete().eq("id", id).eq("school_id", schoolId);
  if (error) {
    res.status(500).json({ error: "Could not delete the webhook." });
    return;
  }
  res.json({ success: true });
});

router.get("/webhooks/:id/deliveries", requireWebhookAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  const id = String(req.params.id);
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { data: webhook } = await supabaseAdmin.from("tenant_webhooks").select("id").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (!webhook) {
    res.status(404).json({ error: "Webhook not found." });
    return;
  }

  const { data } = await supabaseAdmin
    .from("tenant_webhook_deliveries")
    .select("id, event_type, attempt, response_status, response_body, success, created_at")
    .eq("webhook_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  res.json({ deliveries: data ?? [] });
});

async function deliver(webhook: { id: string; url: string; secret: string }, eventType: string, payload: unknown) {
  const body = JSON.stringify({ event: eventType, data: payload });
  const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": eventType,
        "X-Webhook-Signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text().catch(() => "");
    return { status: response.status, body: text.slice(0, 1000), success: response.ok };
  } catch (e) {
    return { status: null, body: e instanceof Error ? e.message : "Request failed", success: false };
  }
}

router.post("/webhooks/deliveries/:deliveryId/retry", requireWebhookAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  const deliveryId = String(req.params.deliveryId);
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { data: delivery } = await supabaseAdmin
    .from("tenant_webhook_deliveries")
    .select("id, webhook_id, outbox_id, event_type, attempt")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) {
    res.status(404).json({ error: "Delivery not found." });
    return;
  }

  const { data: webhook } = await supabaseAdmin
    .from("tenant_webhooks")
    .select("id, url, secret")
    .eq("id", delivery.webhook_id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!webhook) {
    res.status(404).json({ error: "Webhook not found." });
    return;
  }

  let payload: unknown = {};
  if (delivery.outbox_id) {
    const { data: outbox } = await supabaseAdmin.from("tenant_webhook_outbox").select("payload").eq("id", delivery.outbox_id).maybeSingle();
    payload = outbox?.payload ?? {};
  }

  const result = await deliver(webhook, delivery.event_type, payload);
  await supabaseAdmin.from("tenant_webhook_deliveries").insert({
    webhook_id: webhook.id,
    outbox_id: delivery.outbox_id,
    event_type: delivery.event_type,
    attempt: delivery.attempt + 1,
    response_status: result.status,
    response_body: result.body,
    success: result.success,
  });

  res.json({ success: result.success });
});

/** Drains up to `limit` pending outbox rows (optionally scoped to one school) and delivers them. */
async function drainOutbox(opts: { schoolId?: string; limit: number }) {
  let query = supabaseAdmin!
    .from("tenant_webhook_outbox")
    .select("id, school_id, event_type, payload")
    .is("dispatched_at", null)
    .order("created_at", { ascending: true })
    .limit(opts.limit);
  if (opts.schoolId) query = query.eq("school_id", opts.schoolId);

  const { data: pending } = await query;

  let delivered = 0;
  for (const item of pending ?? []) {
    const { data: subscribers } = await supabaseAdmin!
      .from("tenant_webhooks")
      .select("id, url, secret")
      .eq("school_id", item.school_id)
      .eq("is_active", true)
      .contains("events", [item.event_type]);

    for (const webhook of subscribers ?? []) {
      const result = await deliver(webhook, item.event_type, item.payload);
      await supabaseAdmin!.from("tenant_webhook_deliveries").insert({
        webhook_id: webhook.id,
        outbox_id: item.id,
        event_type: item.event_type,
        attempt: 1,
        response_status: result.status,
        response_body: result.body,
        success: result.success,
      });
      delivered++;
    }

    await supabaseAdmin!.from("tenant_webhook_outbox").update({ dispatched_at: new Date().toISOString() }).eq("id", item.id);
  }

  return { processed: pending?.length ?? 0, delivered };
}

/**
 * Drains the whole outbox across every tenant. Wired to Vercel Cron via
 * vercel.json (GET, authenticated by Vercel's own CRON_SECRET convention —
 * it auto-attaches `Authorization: Bearer $CRON_SECRET` to its own cron
 * requests). Also accepts a manual POST with `x-cron-secret` for a
 * Supabase Cron job or GitHub Action instead, using a separately-named
 * WEBHOOK_CRON_SECRET so the two invocation paths can't be confused with
 * each other. One delivery attempt per subscriber per event — failures are
 * visible (and retryable) in the delivery log rather than auto-retried, to
 * keep this endpoint's own runtime bounded.
 */
router.all("/webhooks/dispatch", async (req: Request, res: Response) => {
  const viaVercelCron = !!process.env.CRON_SECRET && req.header("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const viaManualCron = !!process.env.WEBHOOK_CRON_SECRET && req.header("x-cron-secret") === process.env.WEBHOOK_CRON_SECRET;
  if (!viaVercelCron && !viaManualCron) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  res.json(await drainOutbox({ limit: 50 }));
});

/**
 * Lets an admin drain their own school's pending outbox on demand, instead
 * of waiting for the next cron tick — mainly so "did my webhook actually
 * fire?" has an immediate answer while testing.
 */
router.post("/webhooks/dispatch-now", requireWebhookAdmin, async (req: Request, res: Response) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }
  res.json(await drainOutbox({ schoolId, limit: 20 }));
});

export default router;
