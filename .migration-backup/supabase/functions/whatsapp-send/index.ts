import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { school_id, phone, message, contact_name, sent_by } = body;

    if (!school_id || !phone || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("whatsapp_settings")
      .select("phone_number_id, access_token, enabled")
      .eq("school_id", school_id)
      .maybeSingle();

    let status = "sent";
    let errorMsg = null;

    if (settings?.enabled && settings?.phone_number_id && settings?.access_token) {
      const cleanPhone = phone.replace(/\D/g, "");
      const waPayload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: message },
      };

      const waRes = await fetch(
        `https://graph.facebook.com/v18.0/${settings.phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(waPayload),
        }
      );

      if (!waRes.ok) {
        const errData = await waRes.json();
        status = "failed";
        errorMsg = errData?.error?.message ?? "WhatsApp API error";
      } else {
        status = "sent";
      }
    }

    const { data: log } = await supabase.from("whatsapp_logs").insert({
      school_id,
      phone,
      contact_name: contact_name ?? "",
      message,
      direction: "outbound",
      status,
      sent_by: sent_by ?? null,
    }).select("id").single();

    return new Response(
      JSON.stringify({ success: status !== "failed", status, logId: log?.id, error: errorMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
