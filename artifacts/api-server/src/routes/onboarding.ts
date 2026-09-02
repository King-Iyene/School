import { Router } from "express";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

// Keep in sync with artifacts/ogs-school/src/lib/planFeatures.ts
const PLAN_STUDENT_LIMITS: Record<string, number | null> = {
  starter: 250,
  premium: 1000,
  enterprise: null,
};
const PLAN_PRICES_NGN: Record<string, number> = {
  starter: 15000,
  premium: 45000,
  enterprise: 120000,
};

// Every plan gets a 14-day free trial. Paystack has no "authorize a card for
// $0" mode for card channels, so we run one small, fully-refunded charge at
// signup purely to obtain a reusable authorization_code — the tenant is not
// charged the real plan price until process-trial-conversions runs at day 14.
// Keep in sync with artifacts/ogs-school/src/pages/public/Onboarding.tsx.
const TRIAL_VERIFICATION_AMOUNT_NGN = 100;
const TRIAL_DAYS = 14;

function generateTempPassword() {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "!1";
}

function trialEndsAt(): string {
  return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
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

/** Best-effort — never blocks signup. The ₦100 verification hold is refunded immediately. */
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

router.post("/onboarding/register", async (req, res) => {
  const {
    schoolName, subdomain, adminFirstName, adminLastName, adminEmail, plan, paystackReference,
  } = req.body ?? {};

  if (!schoolName || !subdomain || !adminFirstName || !adminLastName || !adminEmail || !plan) {
    return res.status(400).json({ error: "Missing required registration fields" });
  }
  if (!PLAN_STUDENT_LIMITS.hasOwnProperty(plan)) {
    return res.status(400).json({ error: "Invalid plan tier" });
  }
  if (!supabaseAdmin) {
    logger.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured");
    return res.status(503).json({ error: "Onboarding is not configured on this server yet" });
  }

  let authorizationCode: string | null = null;
  let customerCode: string | null = null;

  if (paystackReference) {
    const verification = await verifyPaystackTransaction(paystackReference, TRIAL_VERIFICATION_AMOUNT_NGN);
    if (!verification.ok) {
      return res.status(402).json({ error: verification.reason });
    }
    authorizationCode = verification.authorizationCode;
    customerCode = verification.customerCode ?? null;
  }
  // No paystackReference means this deployment has no live payment gateway
  // configured (see VITE_PLATFORM_PAYSTACK_PUBLIC_KEY) — the trial still
  // starts, but without a saved card it cannot auto-convert to paid at day
  // 14 and will need the platform owner to follow up from /saas-admin.

  try {
    const { data: existingSlug } = await supabaseAdmin.from("tenants").select("id").eq("slug", subdomain).maybeSingle();
    if (existingSlug) {
      return res.status(409).json({ error: "That subdomain is already taken. Please choose another." });
    }

    const { data: school, error: schoolErr } = await supabaseAdmin
      .from("schools")
      .insert({ name: schoolName })
      .select("id")
      .single();
    if (schoolErr || !school) throw schoolErr ?? new Error("Failed to create school record");

    const { error: tenantErr } = await supabaseAdmin.from("tenants").insert({
      id: school.id,
      slug: subdomain,
      plan_tier: plan,
      student_limit: PLAN_STUDENT_LIMITS[plan],
      status: "trial",
      trial_ends_at: trialEndsAt(),
      paystack_authorization_code: authorizationCode,
      paystack_customer_code: customerCode,
    });
    if (tenantErr) throw tenantErr;

    await supabaseAdmin.from("tenant_settings").insert({
      tenant_id: school.id,
      school_name: schoolName,
      email: adminEmail,
    });

    const tempPassword = generateTempPassword();
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
    });
    if (authErr || !authUser?.user) throw authErr ?? new Error("Failed to create admin account");

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
      id: authUser.user.id,
      school_id: school.id,
      role: "super_admin",
      first_name: adminFirstName,
      last_name: adminLastName,
      email: adminEmail,
      is_active: true,
    });
    if (profileErr) throw profileErr;

    if (paystackReference) {
      await supabaseAdmin.from("tenant_billing_events").insert({
        tenant_id: school.id,
        plan_tier: plan,
        amount: TRIAL_VERIFICATION_AMOUNT_NGN,
        currency: "NGN",
        provider: "paystack",
        provider_reference: paystackReference,
        status: "success",
      });
      // Refund the verification hold after the tenant row exists — never
      // blocks the response, and a failure here just means a ₦100 manual
      // refund follow-up rather than a broken signup.
      refundVerificationCharge(paystackReference).catch(() => {});
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SchoolOS <onboarding@schoolos.app>",
          to: [adminEmail],
          subject: `${schoolName} portal is ready`,
          html: `<p>Hi ${adminFirstName},</p><p>Your school portal for <strong>${schoolName}</strong> is ready — your 14-day free trial has started.</p><p>Sign in with:</p><p>Email: ${adminEmail}<br/>Temporary password: <strong>${tempPassword}</strong></p><p>Please change your password after first login. You can cancel any time before your trial ends with no charge.</p>`,
        }),
      }).catch(err => logger.error({ err }, "Failed to send onboarding welcome email"));
    } else {
      logger.warn("RESEND_API_KEY not set — onboarding welcome email skipped");
    }

    logger.info({ schoolId: school.id, subdomain, plan, hasCard: !!authorizationCode }, "Tenant trial started");
    // Always return the temp password directly — the welcome email is a
    // best-effort convenience (needs RESEND_API_KEY configured), never the
    // only place the admin can see the credential they need to log in.
    return res.status(200).json({
      ok: true,
      loginUrl: "/login",
      tenantId: school.id,
      adminEmail,
      tempPassword,
    });
  } catch (err: any) {
    logger.error({ err }, "Tenant onboarding failed");
    return res.status(500).json({ error: err.message || "Onboarding failed" });
  }
});

/**
 * Converts trials that have reached trial_ends_at into paid subscriptions
 * (charging the saved card) or cancels them, per cancel_at_period_end.
 *
 * Not wired to a schedule by this change — point a daily cron (Supabase
 * Cron, a hosting platform's scheduled job, or a simple GitHub Action) at
 * this endpoint with the shared secret. Untested against live Paystack.
 */
router.post("/billing/process-trial-conversions", async (req, res) => {
  const secret = process.env.BILLING_CRON_SECRET;
  if (!secret || req.header("x-cron-secret") !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Not configured" });
  }
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

  const { data: dueTrials, error } = await supabaseAdmin
    .from("tenants")
    .select("id, plan_tier, status, trial_ends_at, cancel_at_period_end, paystack_authorization_code")
    .eq("status", "trial")
    .lte("trial_ends_at", new Date().toISOString());
  if (error) return res.status(500).json({ error: error.message });

  const results: Record<string, string> = {};

  for (const tenant of dueTrials ?? []) {
    if (tenant.cancel_at_period_end) {
      await supabaseAdmin.from("tenants").update({ status: "canceled" }).eq("id", tenant.id);
      results[tenant.id] = "canceled (requested)";
      continue;
    }
    if (!tenant.paystack_authorization_code || !paystackSecretKey) {
      await supabaseAdmin.from("tenants").update({ status: "suspended" }).eq("id", tenant.id);
      results[tenant.id] = "suspended (no card on file)";
      continue;
    }

    const { data: settings } = await supabaseAdmin
      .from("tenant_settings")
      .select("email")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    try {
      const chargeRes = await fetch("https://api.paystack.co/transaction/charge_authorization", {
        method: "POST",
        headers: { Authorization: `Bearer ${paystackSecretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          authorization_code: tenant.paystack_authorization_code,
          email: settings?.email || "billing@schoolos.app",
          amount: PLAN_PRICES_NGN[tenant.plan_tier] * 100,
        }),
      });
      const chargeData = (await chargeRes.json()) as any;
      if (chargeRes.ok && chargeData?.data?.status === "success") {
        await supabaseAdmin.from("tenants").update({ status: "active" }).eq("id", tenant.id);
        await supabaseAdmin.from("tenant_billing_events").insert({
          tenant_id: tenant.id,
          plan_tier: tenant.plan_tier,
          amount: PLAN_PRICES_NGN[tenant.plan_tier],
          currency: "NGN",
          provider: "paystack",
          provider_reference: chargeData.data.reference,
          status: "success",
        });
        results[tenant.id] = "active (charged)";
      } else {
        await supabaseAdmin.from("tenants").update({ status: "suspended" }).eq("id", tenant.id);
        results[tenant.id] = `suspended (charge failed: ${chargeData?.message || "unknown"})`;
      }
    } catch (err: any) {
      logger.error({ err, tenantId: tenant.id }, "Trial conversion charge failed");
      await supabaseAdmin.from("tenants").update({ status: "suspended" }).eq("id", tenant.id);
      results[tenant.id] = "suspended (charge request error)";
    }
  }

  return res.status(200).json({ ok: true, processed: Object.keys(results).length, results });
});

export default router;
