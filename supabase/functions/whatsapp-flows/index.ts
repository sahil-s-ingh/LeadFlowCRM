// WhatsApp Flows API — create/manage in-chat forms via Meta Cloud API
// Supports: create, update, publish, unpublish, delete, info, send, sync, submissions

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_API_VERSION = "v23.0";

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
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "create";
    const body = await req.json().catch(() => ({}));

    const resolveSettings = async (waSettingsId?: string) => {
      let settings: any = null;
      if (waSettingsId) {
        const { data } = await adminSupabase
          .from("whatsapp_settings")
          .select("*")
          .eq("id", waSettingsId)
          .eq("user_id", userData.user.id)
          .maybeSingle();
        settings = data;
      }
      if (!settings) {
        const { data } = await adminSupabase
          .from("whatsapp_settings")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        settings = data;
      }
      return settings;
    };

    const resolveWabaId = (settings: any): string | null => {
      return settings?.waba_id || null;
    };

    // ─── CREATE FLOW ───────────────────────────────────────────────
    if (action === "create") {
      const { name, categories, flowJson, endpointUri, waSettingsId } = body;
      if (!name || !name.trim()) {
        return new Response(
          JSON.stringify({ error: "Flow name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(waSettingsId);
      if (!settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured. Go to Settings to set it up." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const wabaId = resolveWabaId(settings);
      if (!wabaId) {
        return new Response(
          JSON.stringify({ error: "WhatsApp Business Account ID (waba_id) is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        categories: categories || ["SURVEY"],
      };
      if (endpointUri) payload.endpoint_uri = endpointUri;
      if (flowJson) payload.flow_json = typeof flowJson === "string" ? JSON.parse(flowJson) : flowJson;

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/whatsapp_flows`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.access_token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();

      if (data.error) {
        const errMsg = data.error.error_data?.details || data.error.message || "Unknown error";
        return new Response(
          JSON.stringify({ error: `WhatsApp API error: ${errMsg}`, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const flowId = data.id;
      if (!flowId) {
        return new Response(
          JSON.stringify({ error: "Meta did not return a Flow ID", metaResponse: data }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: inserted, error: insErr } = await adminSupabase
        .from("wa_flows")
        .insert({
          user_id: userData.user.id,
          wa_flow_id: flowId,
          wa_settings_id: settings.id,
          name: name.trim(),
          categories: categories || ["SURVEY"],
          endpoint_uri: endpointUri || null,
          flow_json: flowJson || {},
          status: "draft",
        })
        .select("id, wa_flow_id, name, categories, status, created_at")
        .single();

      if (insErr) {
        return new Response(
          JSON.stringify({ error: "Flow created on WhatsApp but failed to save locally", details: insErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, flow: inserted, metaResponse: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── UPDATE FLOW (JSON) ────────────────────────────────────────
    if (action === "update") {
      const { flowId, flowJson, name } = body;
      if (!flowId) {
        return new Response(
          JSON.stringify({ error: "flowId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const updatePayload: Record<string, unknown> = {};
      if (flowJson) updatePayload.flow_json = typeof flowJson === "string" ? JSON.parse(flowJson) : flowJson;
      if (name) updatePayload.name = name;

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${flowId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.access_token}`,
          },
          body: JSON.stringify(updatePayload),
        },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const localUpd: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (flowJson) localUpd.flow_json = typeof flowJson === "string" ? JSON.parse(flowJson) : flowJson;
      if (name) localUpd.name = name;

      await adminSupabase
        .from("wa_flows")
        .update(localUpd)
        .eq("wa_flow_id", flowId)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── PUBLISH FLOW ──────────────────────────────────────────────
    if (action === "publish") {
      const { flowId } = body;
      if (!flowId) {
        return new Response(
          JSON.stringify({ error: "flowId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${flowId}/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.access_token}`,
          },
        },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase
        .from("wa_flows")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("wa_flow_id", flowId)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── UNPUBLISH FLOW ────────────────────────────────────────────
    if (action === "unpublish") {
      const { flowId } = body;
      if (!flowId) {
        return new Response(
          JSON.stringify({ error: "flowId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${flowId}/unpublish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.access_token}`,
          },
        },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase
        .from("wa_flows")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("wa_flow_id", flowId)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DELETE FLOW ───────────────────────────────────────────────
    if (action === "delete") {
      const { flowId } = body;
      if (!flowId) {
        return new Response(
          JSON.stringify({ error: "flowId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${flowId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.access_token}`,
          },
        },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase
        .from("wa_flows")
        .delete()
        .eq("wa_flow_id", flowId)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET FLOW INFO / METADATA ──────────────────────────────────
    if (action === "info") {
      const { flowId } = body;
      if (!flowId) {
        return new Response(
          JSON.stringify({ error: "flowId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${flowId}`,
        { headers: { Authorization: `Bearer ${settings.access_token}` } },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase
        .from("wa_flows")
        .update({
          status: data.status || "draft",
          name: data.name || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("wa_flow_id", flowId)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true, flow: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SEND FLOW MESSAGE ─────────────────────────────────────────
    if (action === "send") {
      const { to, flowId, headerText, bodyText, buttonText, footerText, waSettingsId } = body;
      if (!to || !flowId) {
        return new Response(
          JSON.stringify({ error: "to (phone number) and flowId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(waSettingsId);
      if (!settings?.phone_number_id || !settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const sendBody: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/^\+/, ""),
        type: "interactive",
        interactive: {
          type: "flow",
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: `flow_token_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
              flow_id: flowId,
              flow_cta: buttonText || "Start",
              flow_action: "navigate",
              flow_action_payload: {
                screen: "WELCOME",
                data: {},
              },
            },
          },
          body: {
            text: bodyText || "Please fill out this form",
          },
        },
      };

      if (headerText) {
        (sendBody.interactive as Record<string, unknown>).header = { type: "text", text: headerText };
      }
      if (footerText) {
        (sendBody.interactive as Record<string, unknown>).footer = { text: footerText };
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${settings.phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.access_token}`,
          },
          body: JSON.stringify(sendBody),
        },
      );
      const data = await res.json();

      if (data.error) {
        const errMsg = data.error.error_data?.details || data.error.message || "Unknown error";
        return new Response(
          JSON.stringify({ error: `WhatsApp API error: ${errMsg}`, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, waMessageId: data.messages?.[0]?.id || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SYNC FLOWS (pull from Meta) ───────────────────────────────
    if (action === "sync") {
      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.access_token || !settings?.waba_id) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured or missing WABA ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${settings.waba_id}/whatsapp_flows`,
        { headers: { Authorization: `Bearer ${settings.access_token}` } },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const metaFlows = data.data || [];
      let upserted = 0;
      for (const f of metaFlows) {
        const { error: upsertErr } = await adminSupabase
          .from("wa_flows")
          .upsert(
            {
              user_id: userData.user.id,
              wa_flow_id: f.id,
              wa_settings_id: settings.id,
              name: f.name,
              categories: f.categories || ["SURVEY"],
              status: f.status || "draft",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "wa_flow_id" },
          );
        if (!upsertErr) upserted++;
      }

      return new Response(
        JSON.stringify({ success: true, synced: upserted, total: metaFlows.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET SUBMISSIONS ───────────────────────────────────────────
    if (action === "submissions") {
      const { flowId, localId } = body;
      let query = adminSupabase
        .from("wa_flow_submissions")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (localId) {
        query = query.eq("flow_id", localId);
      } else if (flowId) {
        const { data: localFlow } = await adminSupabase
          .from("wa_flows")
          .select("id")
          .eq("wa_flow_id", flowId)
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (localFlow) query = query.eq("flow_id", localFlow.id);
      }

      const { data: submissions, error: subErr } = await query.limit(200);
      if (subErr) {
        return new Response(
          JSON.stringify({ error: subErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, submissions: submissions || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});