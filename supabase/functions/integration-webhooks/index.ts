import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function deliverWebhook(
  webhookId: string,
  url: string,
  secretToken: string,
  event: string,
  payload: Record<string, unknown>,
  deliveryId: string,
) {
  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
  const encoder = new TextEncoder();
  const key = encoder.encode(secretToken);
  const msg = encoder.encode(body);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  const sigHex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": `sha256=${sigHex}`,
      },
      body,
      signal: AbortSignal.timeout(15000),
    });

    const respText = await resp.text();
    const isOk = resp.ok;
    const newStatus = isOk ? "delivered" : "retrying";
    const nextRetry = isOk ? null : new Date(Date.now() + Math.pow(2, 3) * 60000).toISOString();

    await supabase.from("integration_webhook_deliveries").update({
      status: newStatus,
      response_code: resp.status,
      response_body: respText.slice(0, 2000),
      attempts: 1,
      next_retry_at: nextRetry,
    }).eq("id", deliveryId);

    await supabase.from("integration_webhooks").update({
      last_delivery_at: new Date().toISOString(),
      last_delivery_status: newStatus,
    }).eq("id", webhookId);

    return { success: isOk, status: resp.status };
  } catch (err) {
    const nextRetry = new Date(Date.now() + Math.pow(2, 3) * 60000).toISOString();
    await supabase.from("integration_webhook_deliveries").update({
      status: "retrying",
      response_body: String(err.message || err).slice(0, 2000),
      attempts: 1,
      next_retry_at: nextRetry,
    }).eq("id", deliveryId);

    await supabase.from("integration_webhooks").update({
      last_delivery_at: new Date().toISOString(),
      last_delivery_status: "failed",
    }).eq("id", webhookId);

    return { success: false, error: String(err.message || err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { webhook_id, event, payload } = await req.json();

    if (!webhook_id || !event) {
      return new Response(JSON.stringify({ error: "Missing webhook_id or event" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: webhook, error: whError } = await supabase
      .from("integration_webhooks")
      .select("*")
      .eq("id", webhook_id)
      .maybeSingle();

    if (whError || !webhook) {
      return new Response(JSON.stringify({ error: "Webhook not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!webhook.is_active) {
      return new Response(JSON.stringify({ skipped: true, reason: "inactive" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!webhook.events.includes(event)) {
      return new Response(JSON.stringify({ skipped: true, reason: "event_not_subscribed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create delivery record
    const { data: delivery, error: delError } = await supabase
      .from("integration_webhook_deliveries")
      .insert({
        webhook_id: webhook.id,
        user_id: webhook.user_id,
        event,
        payload: payload || {},
        status: "pending",
      })
      .select()
      .single();

    if (delError || !delivery) {
      return new Response(JSON.stringify({ error: "Failed to create delivery record" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await deliverWebhook(webhook.id, webhook.url, webhook.secret_token, event, payload || {}, delivery.id);

    return new Response(JSON.stringify({ success: result.success, delivery_id: delivery.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

