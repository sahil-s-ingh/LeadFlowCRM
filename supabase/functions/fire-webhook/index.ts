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

interface WebhookConfig {
  id: string;
  url: string;
  secret_token: string | null;
  events: string[];
  is_active: boolean;
}

async function deliverWebhook(webhook: WebhookConfig, event: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": event,
  "X-Webhook-Timestamp": new Date().toISOString(),
  "User-Agent": "LeadCentre-Webhook/1.0",
  ...(webhook.secret_token ? { "X-Webhook-Token": webhook.secret_token } : {}),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseText = await res.text();
    const truncatedBody = responseText.slice(0, 1000);

    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event,
      payload: JSON.parse(body),
      status: res.ok ? "success" : "failed",
      response_status: res.status,
      response_body: truncatedBody,
      attempts: 1,
    });

    return res.ok;
  } catch (err) {
    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event,
      payload: JSON.parse(body),
      status: "failed",
      response_status: null,
      response_body: String(err.message || err).slice(0, 1000),
      attempts: 1,
    });
    return false;
  }
}

async function fireAutomationTriggers(
  supabase: ReturnType<typeof createClient>,
  event: string,
  payload: Record<string, unknown>,
  _userId: string,
) {
  const eventToTrigger: Record<string, string> = {
    "lead.created": "lead_created",
    "lead.status_changed": "lead_status_changed",
    "lead.converted": "lead_status_changed",
    "lead.tagged": "lead_tagged",
    "lead.assigned": "lead_assigned",
    "call.completed": "call_completed",
  "whatsapp.received": "whatsapp_received",
    "telegram.received": "telegram_received",
    "email.opened": "email_opened",
  "lead.updated": "lead_updated",
    "lead.deleted": "lead_deleted",
  "lead.tag_added": "lead_tagged",
    "lead.assigned_to": "lead_assigned",
  "lead.status_changed_to": "lead_status_changed",
    "lead.tag_added_to": "lead_tagged",
    "lead.assigned_to_team": "lead_assigned",
    "lead.status_changed_from": "lead_status_changed",
    "lead.tag_removed": "lead_tagged",
    "lead.assigned_from": "lead_assigned",
    "lead.status_changed_by": "lead_status_changed",
    "lead.tag_added_by": "lead_tagged",
    "lead.assigned_by": "lead_assigned",
    "lead.status_changed_to_by": "lead_status_changed",
    "lead.tag_added_to_by": "lead_tagged",
    "lead.assigned_to_by": "lead_assigned",
    "lead.status_changed_from_by": "lead_status_changed",
    "lead.tag_removed_by": "lead_tagged",
    "lead.assigned_from_by": "lead_assigned",
    "lead.status_changed_to_from": "lead_status_changed",
    "lead.tag_added_to_from": "lead_tagged",
    "lead.assigned_to_from": "lead_assigned",
    "lead.status_changed_to_from_by": "lead_status_changed",
    "lead.tag_added_to_from_by": "lead_tagged",
    "lead.assigned_to_from_by": "lead_assigned",
  };

  const triggerType = eventToTrigger[event];
  if (!triggerType) return;

  const leadId = (payload.id as string) || (payload.lead_id as string) || null;
  let leadData = payload;

  if (leadId && typeof leadId === "string") {
    const { data: lead } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();
    if (lead) leadData = lead as Record<string, unknown>;
  }

  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-automations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_type: triggerType,
        lead_id: leadId,
        lead_data: leadData,
        user_id: _userId,
      }),
    });
  } catch {
    // Best-effort — automation failures should not block webhook delivery
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { event, payload, user_id } = await req.json();

    if (!event || !user_id) {
      return new Response(JSON.stringify({ error: "event and user_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: webhooks, error } = await supabase
      .from("webhooks")
      .select("id, url, secret_token, events, is_active")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .contains("events", [event]);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire automation triggers for lead events (best-effort, non-blocking)
    await fireAutomationTriggers(supabase, event, payload, user_id);

    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ delivered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      (webhooks as WebhookConfig[]).map((w) => deliverWebhook(w, event, payload)),
    );

    const succeeded = results.filter(Boolean).length;
    const failed = results.length - succeeded;

    return new Response(JSON.stringify({ delivered: succeeded, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

