import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (_req: Request) => {
  try {
    const { data: pending } = await supabase
      .from("integration_webhook_deliveries")
      .select("*, integration_webhooks!inner(*)")
      .in("status", ["pending", "retrying"])
      .lt("attempts", 5)
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .limit(50);

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let succeeded = 0;
    let failed = 0;

    for (const delivery of pending) {
      const webhook = delivery.integration_webhooks;
      if (!webhook || !webhook.is_active) continue;

      const body = JSON.stringify({
        event: delivery.event,
        timestamp: new Date().toISOString(),
        data: delivery.payload,
      });

      try {
        const encoder = new TextEncoder();
        const key = encoder.encode(webhook.secret_token);
        const msg = encoder.encode(body);
        const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signature = await crypto.subtle.sign("HMAC", cryptoKey, msg);
        const sigHex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");

        const resp = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": delivery.event,
            "X-Webhook-Signature": `sha256=${sigHex}`,
          },
          body,
          signal: AbortSignal.timeout(15000),
        });

        const respText = await resp.text();

        if (resp.ok) {
          await supabase.from("integration_webhook_deliveries").update({
            status: "delivered",
            response_code: resp.status,
            response_body: respText.slice(0, 2000),
            attempts: delivery.attempts + 1,
            next_retry_at: null,
          }).eq("id", delivery.id);
          succeeded++;
        } else {
          const backoff = Math.pow(2, delivery.attempts + 1) * 60000;
          await supabase.from("integration_webhook_deliveries").update({
            status: delivery.attempts + 1 >= 4 ? "failed" : "retrying",
            response_code: resp.status,
            response_body: respText.slice(0, 2000),
            attempts: delivery.attempts + 1,
            next_retry_at: new Date(Date.now() + backoff).toISOString(),
          }).eq("id", delivery.id);
          failed++;
        }
      } catch (err) {
        const backoff = Math.pow(2, delivery.attempts + 1) * 60000;
        await supabase.from("integration_webhook_deliveries").update({
          status: delivery.attempts + 1 >= 4 ? "failed" : "retrying",
          response_body: String(err.message || err).slice(0, 2000),
          attempts: delivery.attempts + 1,
          next_retry_at: new Date(Date.now() + backoff).toISOString(),
        }).eq("id", delivery.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed: pending.length, succeeded, failed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

