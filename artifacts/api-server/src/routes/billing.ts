import { Router, type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

// Keep in sync with artifacts/ogs-school/src/lib/planFeatures.ts
const PLAN_ORDER = ["starter", "premium", "enterprise"] as const;
type PlanTier = (typeof PLAN_ORDER)[number];
const PLAN_PRICES_NGN: Record<PlanTier, number> = {
  starter: 15000,
  premium: 45000,
  enterprise: 120000,
};
function planRank(plan: string): number {
  return PLAN_ORDER.indexOf(plan as PlanTier);
}

const BILLING_PERIOD_DAYS = 30;
// A failed renewal charge doesn't lock the tenant out immediately — it gets
// one short retry window first (a bounced card is often a transient bank
// issue, not a genuinely lapsed subscription). Only a second consecutive
// failure suspends the account. Trial-end conversion is different: that's
// the FIRST charge attempt ever, so a failure there suspends immediately
// (unchanged from the existing process-trial-conversions behavior).
const RENEWAL_RETRY_DAYS = 3;
const TRIAL_REMINDER_DAYS_BEFORE_END = 3;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

interface AuthedRequest extends Request {
  schoolId?: string;
}

/**
 * Same shape as ai.ts's requireAuth: validate the caller's Supabase session
 * token, then look up their own profile (role/school_id) with that same
 * token so RLS scopes the lookup to themselves. Billing changes are
 * super_admin/admin only, and always act on the caller's OWN tenant — never
 * accept a tenant/school id from the request body.
 */
async function requireBillingAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    res.status(403).json({ error: "Billing is managed by the school's admin." });
    return;
  }

  (req as AuthedRequest).schoolId = schoolId;
  next();
}

async function verifyPaystackTransaction(reference: string, minAmountNgn: number) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { ok: false as const, reason: "PAYSTACK_SECRET_KEY not configured on the server" };
  }
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = (await res.json()) as any;
  if (!res.ok || data?.data?.status !== "success") {
    return { ok: false as const, reason: data?.message || "Card could not be verified" };
  }
  const paidAmountNgn = (data.data.amount ?? 0) / 100;
  if (paidAmountNgn < minAmountNgn) {
    return { ok: false as const, reason: "Verification amount did not match" };
  }
  const authorizationCode: string | undefined = data.data.authorization?.authorization_code;
  const customerCode: string | undefined = data.data.customer?.customer_code;
  if (!authorizationCode || !data.data.authorization?.reusable) {
    return { ok: false as const, reason: "This card cannot be saved for future billing. Please use a different card." };
  }
  return { ok: true as const, authorizationCode, customerCode };
}

/** Best-effort — never blocks the response. */
async function refundVerificationCharge(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return;
  try {
    const res = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: reference }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      logger.warn({ reference, data }, "Verification-charge refund failed — may need manual follow-up");
    }
  } catch (err) {
    logger.warn({ err, reference }, "Verification-charge refund request failed");
  }
}

/** Charges a tenant's saved card for one billing period of `planTier`. */
async function chargePlan(tenantId: string, planTier: PlanTier, email: string) {
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseAdmin || !paystackSecretKey) {
    return { ok: false as const, reason: "Billing is not configured on this server yet" };
  }
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("paystack_authorization_code")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant?.paystack_authorization_code) {
    return { ok: false as const, reason: "No card on file" };
  }
  try {
    const chargeRes = await fetch("https://api.paystack.co/transaction/charge_authorization", {
      method: "POST",
      headers: { Authorization: `Bearer ${paystackSecretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization_code: tenant.paystack_authorization_code,
        email: email || "billing@schoolos.app",
        amount: PLAN_PRICES_NGN[planTier] * 100,
      }),
    });
    const chargeData = (await chargeRes.json()) as any;
    if (chargeRes.ok && chargeData?.data?.status === "success") {
      await supabaseAdmin.from("tenant_billing_events").insert({
        tenant_id: tenantId,
        plan_tier: planTier,
        amount: PLAN_PRICES_NGN[planTier],
        currency: "NGN",
        provider: "paystack",
        provider_reference: chargeData.data.reference,
        status: "success",
      });
      return { ok: true as const };
    }
    const reason = chargeData?.data?.gateway_response || chargeData?.message || "Charge declined";
    await supabaseAdmin.from("tenant_billing_events").insert({
      tenant_id: tenantId,
      plan_tier: planTier,
      amount: PLAN_PRICES_NGN[planTier],
      currency: "NGN",
      provider: "paystack",
      provider_reference: chargeData?.data?.reference || `failed-${Date.now()}`,
      status: "failed",
    });
    return { ok: false as const, reason };
  } catch (err: any) {
    logger.error({ err, tenantId }, "Plan charge request failed");
    return { ok: false as const, reason: "Could not reach the payment gateway. Please try again." };
  }
}

/**
 * Change plan for the caller's own tenant. Upgrades unlock immediately and
 * are not charged until the next scheduled renewal (run-cycle) — the
 * tenant is never charged twice in one cycle, and never surprised by an
 * immediate proration charge. Downgrades keep the current (already paid
 * for) plan and its features until next_billing_at, then apply
 * automatically. A trial (never charged yet) just switches immediately
 * either way, since there's no cycle to protect.
 */
router.post("/billing/change-plan", requireBillingAdmin, async (req, res) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  const { newPlanTier } = req.body ?? {};
  if (!PLAN_ORDER.includes(newPlanTier)) {
    return res.status(400).json({ error: "Invalid plan tier" });
  }
  if (!supabaseAdmin) return res.status(503).json({ error: "Not configured" });

  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("plan_tier, status")
    .eq("id", schoolId)
    .maybeSingle();
  if (error || !tenant) return res.status(404).json({ error: "Tenant not found" });
  if (tenant.status === "suspended" || tenant.status === "canceled") {
    return res.status(409).json({ error: "Your account is inactive — reactivate billing before changing plans." });
  }

  const isUpgrade = planRank(newPlanTier) > planRank(tenant.plan_tier);
  const isTrial = tenant.status === "trial";

  if (isTrial || isUpgrade) {
    const { error: updateErr } = await supabaseAdmin
      .from("tenants")
      .update({ plan_tier: newPlanTier, pending_plan_tier: null })
      .eq("id", schoolId);
    if (updateErr) {
      logger.error({ err: updateErr, schoolId, newPlanTier }, "change-plan: tenants update failed");
      return res.status(500).json({ error: updateErr.message || "Could not update your plan. Please try again." });
    }
    return res.status(200).json({
      ok: true,
      appliedNow: true,
      message: isTrial
        ? `You're now on the ${newPlanTier} plan for the rest of your trial.`
        : `Upgraded — your new features are unlocked now. You'll be billed the ${newPlanTier} plan price at your next renewal.`,
    });
  }

  // Downgrade on an active/past_due subscription: schedule it instead of
  // taking anything away from a cycle they already paid for.
  const { error: scheduleErr } = await supabaseAdmin.from("tenants").update({ pending_plan_tier: newPlanTier }).eq("id", schoolId);
  if (scheduleErr) {
    logger.error({ err: scheduleErr, schoolId, newPlanTier }, "change-plan: tenants pending_plan_tier update failed");
    return res.status(500).json({ error: scheduleErr.message || "Could not schedule your plan change. Please try again." });
  }
  return res.status(200).json({
    ok: true,
    appliedNow: false,
    message: `You'll keep your current plan's features until your next billing date, then move to ${newPlanTier}.`,
  });
});

/**
 * Save a new card for the caller's own tenant (same small refundable
 * Paystack verification-hold pattern as onboarding). If the account was
 * past_due or suspended for a failed payment, immediately retries the
 * charge on the new card so a tenant fixing their card gets back in
 * without a second manual step.
 */
router.post("/billing/update-card", requireBillingAdmin, async (req, res) => {
  const schoolId = (req as AuthedRequest).schoolId!;
  const { paystackReference } = req.body ?? {};
  if (!paystackReference) return res.status(400).json({ error: "Missing payment reference" });
  if (!supabaseAdmin) return res.status(503).json({ error: "Not configured" });

  const verification = await verifyPaystackTransaction(paystackReference, 100);
  if (!verification.ok) {
    return res.status(402).json({ error: verification.reason });
  }

  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("plan_tier, status")
    .eq("id", schoolId)
    .maybeSingle();
  if (error || !tenant) return res.status(404).json({ error: "Tenant not found" });

  const { error: saveCardErr } = await supabaseAdmin
    .from("tenants")
    .update({
      paystack_authorization_code: verification.authorizationCode,
      paystack_customer_code: verification.customerCode,
    })
    .eq("id", schoolId);
  if (saveCardErr) {
    logger.error({ err: saveCardErr, schoolId }, "update-card: tenants update failed");
    return res.status(500).json({ error: saveCardErr.message || "Card was verified, but could not be saved. Please try again." });
  }
  refundVerificationCharge(paystackReference).catch(() => {});

  if (tenant.status !== "past_due" && tenant.status !== "suspended") {
    return res.status(200).json({ ok: true, reactivated: false, message: "Card updated." });
  }

  const { data: settings } = await supabaseAdmin.from("tenant_settings").select("email").eq("tenant_id", schoolId).maybeSingle();
  const result = await chargePlan(schoolId, tenant.plan_tier, settings?.email || "");
  if (result.ok) {
    await supabaseAdmin
      .from("tenants")
      .update({
        status: "active",
        next_billing_at: new Date(Date.now() + BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        payment_retry_count: 0,
        last_payment_error: null,
      })
      .eq("id", schoolId);
    return res.status(200).json({ ok: true, reactivated: true, message: "Card updated and your account is active again." });
  }

  await supabaseAdmin.from("tenants").update({ last_payment_error: result.reason }).eq("id", schoolId);
  return res.status(402).json({ ok: false, reactivated: false, error: `Card saved, but the charge still failed: ${result.reason}` });
});

/**
 * Runs the whole subscription lifecycle for every tenant that's due for
 * something today. Not wired to a schedule by this change — point a daily
 * cron (Vercel Cron, Supabase Cron, a GitHub Action) at this endpoint with
 * the shared secret. Untested against live Paystack.
 */
router.post("/billing/run-cycle", async (req, res) => {
  const secret = process.env.BILLING_CRON_SECRET;
  if (!secret || req.header("x-cron-secret") !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin) return res.status(503).json({ error: "Not configured" });

  const now = new Date();
  const results: Record<string, string> = {};

  // ── 1. Trial-ending reminder ──────────────────────────────────────────
  const reminderCutoff = new Date(now.getTime() + TRIAL_REMINDER_DAYS_BEFORE_END * 24 * 60 * 60 * 1000).toISOString();
  const { data: trialsNeedingReminder } = await supabaseAdmin
    .from("tenants")
    .select("id, trial_ends_at")
    .eq("status", "trial")
    .is("trial_reminder_sent_at", null)
    .lte("trial_ends_at", reminderCutoff)
    .gt("trial_ends_at", now.toISOString());

  const apiKey = process.env.RESEND_API_KEY;
  for (const tenant of trialsNeedingReminder ?? []) {
    const { data: settings } = await supabaseAdmin
      .from("tenant_settings")
      .select("email, school_name")
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (apiKey && settings?.email) {
      const daysLeft = Math.max(1, Math.ceil((new Date(tenant.trial_ends_at).getTime() - now.getTime()) / 86400000));
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SchoolOS <onboarding@resend.dev>",
          to: [settings.email],
          subject: `Your ${settings.school_name || "SchoolOS"} trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          html: `<p>Hi,</p><p>Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Your saved card will be charged automatically to continue — no action needed if that's what you want.</p><p>Changed your mind, or need to update your card first? Sign in and open <strong>Billing</strong> any time before then.</p>`,
        }),
      }).catch((err) => logger.error({ err, tenantId: tenant.id }, "Trial reminder email failed"));
    }
    await supabaseAdmin.from("tenants").update({ trial_reminder_sent_at: now.toISOString() }).eq("id", tenant.id);
    results[`reminder:${tenant.id}`] = "sent";
  }

  // ── 2. Trial -> paid conversion (first-ever charge; fails closed) ──────
  const { data: dueTrials } = await supabaseAdmin
    .from("tenants")
    .select("id, plan_tier, cancel_at_period_end, paystack_authorization_code")
    .eq("status", "trial")
    .lte("trial_ends_at", now.toISOString());

  for (const tenant of dueTrials ?? []) {
    if (tenant.cancel_at_period_end) {
      await supabaseAdmin.from("tenants").update({ status: "canceled" }).eq("id", tenant.id);
      results[tenant.id] = "canceled (requested)";
      continue;
    }
    if (!tenant.paystack_authorization_code) {
      await supabaseAdmin
        .from("tenants")
        .update({ status: "suspended", last_payment_error: "No card on file at trial end" })
        .eq("id", tenant.id);
      results[tenant.id] = "suspended (no card on file)";
      continue;
    }
    const { data: settings } = await supabaseAdmin.from("tenant_settings").select("email").eq("tenant_id", tenant.id).maybeSingle();
    const result = await chargePlan(tenant.id, tenant.plan_tier, settings?.email || "");
    if (result.ok) {
      await supabaseAdmin
        .from("tenants")
        .update({
          status: "active",
          next_billing_at: new Date(now.getTime() + BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          payment_retry_count: 0,
          last_payment_error: null,
        })
        .eq("id", tenant.id);
      results[tenant.id] = "active (charged)";
    } else {
      await supabaseAdmin.from("tenants").update({ status: "suspended", last_payment_error: result.reason }).eq("id", tenant.id);
      results[tenant.id] = `suspended (charge failed: ${result.reason})`;
    }
  }

  // ── 3. Recurring renewals (active/past_due tenants due today) ─────────
  const { data: dueRenewals } = await supabaseAdmin
    .from("tenants")
    .select("id, plan_tier, pending_plan_tier, cancel_at_period_end, payment_retry_count")
    .in("status", ["active", "past_due"])
    .lte("next_billing_at", now.toISOString());

  for (const tenant of dueRenewals ?? []) {
    if (tenant.cancel_at_period_end) {
      await supabaseAdmin.from("tenants").update({ status: "canceled" }).eq("id", tenant.id);
      results[tenant.id] = "canceled (requested)";
      continue;
    }
    // A scheduled downgrade takes effect for this renewal: charge the new
    // (lower) plan and grant its features from this cycle onward.
    const planForThisCycle = tenant.pending_plan_tier || tenant.plan_tier;
    const { data: settings } = await supabaseAdmin.from("tenant_settings").select("email").eq("tenant_id", tenant.id).maybeSingle();
    const result = await chargePlan(tenant.id, planForThisCycle, settings?.email || "");

    if (result.ok) {
      await supabaseAdmin
        .from("tenants")
        .update({
          plan_tier: planForThisCycle,
          pending_plan_tier: null,
          status: "active",
          next_billing_at: new Date(now.getTime() + BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          payment_retry_count: 0,
          last_payment_error: null,
        })
        .eq("id", tenant.id);
      results[tenant.id] = "active (renewed)";
      continue;
    }

    const retryCount = (tenant.payment_retry_count ?? 0) + 1;
    if (retryCount >= 2) {
      await supabaseAdmin
        .from("tenants")
        .update({ status: "suspended", payment_retry_count: retryCount, last_payment_error: result.reason })
        .eq("id", tenant.id);
      results[tenant.id] = `suspended (renewal failed twice: ${result.reason})`;
    } else {
      await supabaseAdmin
        .from("tenants")
        .update({
          status: "past_due",
          payment_retry_count: retryCount,
          last_payment_error: result.reason,
          next_billing_at: new Date(now.getTime() + RENEWAL_RETRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", tenant.id);
      results[tenant.id] = `past_due (renewal failed, retrying in ${RENEWAL_RETRY_DAYS}d: ${result.reason})`;
    }
  }

  return res.status(200).json({ ok: true, processed: Object.keys(results).length, results });
});

export default router;
