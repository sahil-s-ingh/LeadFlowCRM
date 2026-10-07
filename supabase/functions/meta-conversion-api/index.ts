import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_STAGE_EVENTS: Record<string, string> = {
  new: "Lead",
  not_interested: "Lead",
  called_no_response: "Contact",
  called_responded: "Contact",
  interested: "Contact",
  converted: "Purchase",
};

async function hashValueAsync(value: string): Promise<string | undefined> {
  if (!value) return undefined;
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminSupabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings, error: settingsError } = await adminSupabase
      .from("meta_conversion_settings")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Meta Conversion API settings not configured. Please set up in Settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!settings.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, message: "Meta Conversion API is disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { lead_id, event_name: clientEventName, status, fund_amount, purchase_value, mobile_number, email, meta_lead_id } = body;

    if (!lead_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: lead_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve event name: use client-provided value, or fall back to DB mapping, then defaults
    let event_name = clientEventName;
    if (!event_name && status) {
      const dbKey = `event_${status}`;
      event_name = (settings as Record<string, unknown>)[dbKey] as string | undefined;
      if (!event_name || event_name === "None") {
        event_name = DEFAULT_STAGE_EVENTS[status];
      }
    }
    if (!event_name || event_name === "None") {
      return new Response(
        JSON.stringify({ success: false, message: `No event mapped for status: ${status || "unknown"}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build user_data with hashed identifiers
    const user_data: Record<string, unknown> = {};

    if (meta_lead_id) {
      user_data["lead_id"] = meta_lead_id;
    }

    if (mobile_number) {
      const digits = mobile_number.replace(/[^0-9]/g, "");
      if (digits.length >= 10) {
        user_data["phone"] = [await hashValueAsync(digits)];
      }
    }

    if (email) {
      user_data["email"] = [await hashValueAsync(email)];
    }

    // Build custom data
    const custom_data: Record<string, unknown> = {
      status: status || "unknown",
    };

    if (event_name === "Purchase") {
      const value = purchase_value != null ? purchase_value : (fund_amount != null ? fund_amount : (settings.default_purchase_value != null ? Number(settings.default_purchase_value) : null));
      const currency = (settings.currency as string) || "USD";
      if (value != null) {
        custom_data["value"] = Number(value);
        custom_data["currency"] = currency;
      }
    }

    const event_id = `${lead_id}_${event_name}_${Date.now()}`;

    const payload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id,
          action_source: "system_generated",
          user_data,
          custom_data,
        },
      ],
    };

    const apiVersion = settings.api_version || "v18.0";
    const metaApiUrl = `https://graph.facebook.com/${apiVersion}/${settings.pixel_id}/events?access_token=${settings.access_token}`;

    const metaResponse = await fetch(metaApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const metaResult = await metaResponse.json();
    const success = metaResponse.ok && (metaResult.events_received != null || metaResult.fbq_event_id != null);

    // Log the result
    await adminSupabase.from("meta_conversion_log").insert({
      lead_id,
      event_name,
      event_time: new Date().toISOString(),
      status,
      fund_amount: fund_amount || null,
      purchase_value: purchase_value || null,
      meta_response: metaResult,
      success,
      error_message: success ? null : (metaResult.error?.message || `HTTP ${metaResponse.status}`),
    });

    if (success) {
      await adminSupabase
        .from("submissions")
        .update({ meta_conversion_sent_at: new Date().toISOString() })
        .eq("id", lead_id);
    }

    return new Response(
      JSON.stringify({ success: true, event_id, meta_response: metaResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
