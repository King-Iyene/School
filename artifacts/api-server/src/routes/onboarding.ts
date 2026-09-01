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

function generateTempPassword() {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "!1";
}

async function verifyPaystackTransaction(reference: string, expectedAmountNgn: number) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, reason: "PAYSTACK_SECRET_KEY not configured on the server" };
  }
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = (await res.json()) as any;
  if (!res.ok || data?.data?.status !== "success") {
    return { ok: false, reason: data?.message || "Payment could not be verified" };
  }
  const paidAmountNgn = (data.data.amount ?? 0) / 100;
  if (paidAmountNgn < expectedAmountNgn) {
    return { ok: false, reason: "Paid amount does not match the selected plan" };
  }
  return { ok: true as const, amountNgn: paidAmountNgn };
}

router.post("/api/onboarding/register", async (req, res) => {
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

  let tenantStatus: "active" | "trial" = "trial";
  if (paystackReference) {
    const verification = await verifyPaystackTransaction(paystackReference, PLAN_PRICES_NGN[plan]);
    if (!verification.ok) {
      return res.status(402).json({ error: verification.reason });
    }
    tenantStatus = "active";
  }

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
      status: tenantStatus,
    });
    if (tenantErr) throw tenantErr;

    await supabaseAdmin.from("tenant_settings").insert({
      tenant_id: school.id,
      school_name: schoolName,
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
        amount: PLAN_PRICES_NGN[plan],
        currency: "NGN",
        provider: "paystack",
        provider_reference: paystackReference,
        status: "success",
      });
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
          html: `<p>Hi ${adminFirstName},</p><p>Your school portal for <strong>${schoolName}</strong> is ready.</p><p>Sign in with:</p><p>Email: ${adminEmail}<br/>Temporary password: <strong>${tempPassword}</strong></p><p>Please change your password after first login.</p>`,
        }),
      }).catch(err => logger.error({ err }, "Failed to send onboarding welcome email"));
    } else {
      logger.warn("RESEND_API_KEY not set — onboarding welcome email skipped");
    }

    logger.info({ schoolId: school.id, subdomain, plan }, "Tenant onboarded");
    return res.status(200).json({ ok: true, loginUrl: "/login", tenantId: school.id });
  } catch (err: any) {
    logger.error({ err }, "Tenant onboarding failed");
    return res.status(500).json({ error: err.message || "Onboarding failed" });
  }
});

export default router;
