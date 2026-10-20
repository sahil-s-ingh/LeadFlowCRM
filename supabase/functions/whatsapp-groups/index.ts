// WhatsApp Groups API — create/manage groups via Meta Cloud API
// Supports: create, list, info, invite_link, delete, send_message, sync

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

    // Resolve WhatsApp settings
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

    // ─── CREATE GROUP ──────────────────────────────────────────────
    if (action === "create") {
      const { subject, description, joinApprovalMode, waSettingsId } = body;
      if (!subject || !subject.trim()) {
        return new Response(
          JSON.stringify({ error: "Group subject (name) is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(waSettingsId);
      if (!settings?.phone_number_id || !settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured. Go to Settings to set it up." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const payload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        subject: subject.trim(),
      };
      if (description) payload.description = description.trim();
      if (joinApprovalMode) payload.join_approval_mode = joinApprovalMode;

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${settings.phone_number_id}/groups`,
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

      // Meta returns group_id; the invite_link comes via webhook later.
      // We insert a preliminary row; webhook will update invite_link etc.
      const groupId = data.id || data.group_id;
      if (!groupId) {
        return new Response(
          JSON.stringify({ error: "Meta did not return a group ID", metaResponse: data }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: inserted, error: insErr } = await adminSupabase
        .from("wa_groups")
        .insert({
          user_id: userData.user.id,
          wa_group_id: groupId,
          wa_settings_id: settings.id,
          subject: subject.trim(),
          description: description?.trim() || null,
          join_approval_mode: joinApprovalMode || "auto_approve",
          status: "active",
        })
        .select("id, wa_group_id, subject, description, status, created_at")
        .single();

      if (insErr) {
        return new Response(
          JSON.stringify({ error: "Group created on WhatsApp but failed to save locally", details: insErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, group: inserted, metaResponse: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── LIST GROUPS ───────────────────────────────────────────────
    if (action === "list") {
      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.phone_number_id || !settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${settings.phone_number_id}/groups?limit=100`,
        { headers: { Authorization: `Bearer ${settings.access_token}` } },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, groups: data.data?.groups || [], paging: data.paging || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET GROUP INFO ────────────────────────────────────────────
    if (action === "info") {
      const { groupId } = body;
      if (!groupId) {
        return new Response(
          JSON.stringify({ error: "groupId is required" }),
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
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${groupId}`,
        { headers: { Authorization: `Bearer ${settings.access_token}` } },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Sync local DB with Meta's info
      await adminSupabase
        .from("wa_groups")
        .update({
          subject: data.subject || null,
          description: data.description || null,
          participant_count: data.total_participant_count || 0,
          status: data.suspended === "true" ? "suspended" : "active",
          meta_created_at: data.creation_timestamp ? new Date(parseInt(data.creation_timestamp) * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("wa_group_id", groupId)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true, group: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET INVITE LINK ───────────────────────────────────────────
    if (action === "invite_link") {
      const { groupId } = body;
      if (!groupId) {
        return new Response(
          JSON.stringify({ error: "groupId is required" }),
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
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${groupId}/invite_link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.access_token}`,
          },
          body: JSON.stringify({ messaging_product: "whatsapp" }),
        },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Save invite link locally
      await adminSupabase
        .from("wa_groups")
        .update({ invite_link: data.invite_link, updated_at: new Date().toISOString() })
        .eq("wa_group_id", groupId)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true, invite_link: data.invite_link }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DELETE GROUP ──────────────────────────────────────────────
    if (action === "delete") {
      const { groupId } = body;
      if (!groupId) {
        return new Response(
          JSON.stringify({ error: "groupId is required" }),
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
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${settings.phone_number_id}/groups`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.access_token}`,
          },
          body: JSON.stringify({ messaging_product: "whatsapp", group_id: groupId }),
        },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Mark as deleted locally (don't hard-delete to preserve message history)
      await adminSupabase
        .from("wa_groups")
        .update({ status: "deleted", updated_at: new Date().toISOString() })
        .eq("wa_group_id", groupId)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SEND GROUP MESSAGE ────────────────────────────────────────
    if (action === "send_message") {
      const { groupId, text, mediaId, mediaType } = body;
      if (!groupId || (!text && !mediaId)) {
        return new Response(
          JSON.stringify({ error: "groupId and either text or mediaId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.phone_number_id || !settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const sendBody: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "group",
        to: groupId,
      };

      if (mediaId) {
        sendBody.type = mediaType || "image";
        sendBody[mediaType || "image"] = mediaId ? { id: mediaId, caption: text || undefined } : {};
      } else {
        sendBody.type = "text";
        sendBody.text = { body: text };
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

      const waMessageId = data.messages?.[0]?.id || null;

      // Save the message locally
      const { data: localGroup } = await adminSupabase
        .from("wa_groups")
        .select("id")
        .eq("wa_group_id", groupId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (localGroup) {
        await adminSupabase.from("wa_group_messages").insert({
          group_id: localGroup.id,
          user_id: userData.user.id,
          sender: "admin",
          message_type: mediaId ? (mediaType || "image") : "text",
          text_content: text || null,
          media_id: mediaId || null,
          wa_message_id: waMessageId,
          delivery_status: waMessageId ? "sent" : null,
        });
      }

      return new Response(
        JSON.stringify({ success: true, waMessageId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SYNC GROUPS (pull from Meta and upsert locally) ───────────
    if (action === "sync") {
      const settings = await resolveSettings(body.waSettingsId);
      if (!settings?.phone_number_id || !settings?.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${settings.phone_number_id}/groups?limit=100`,
        { headers: { Authorization: `Bearer ${settings.access_token}` } },
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message, metaError: data.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const metaGroups = data.data?.groups || [];
      let upserted = 0;
      for (const g of metaGroups) {
        const { error: upsertErr } = await adminSupabase
          .from("wa_groups")
          .upsert(
            {
              user_id: userData.user.id,
              wa_group_id: g.id,
              wa_settings_id: settings.id,
              subject: g.subject,
              status: "active",
              meta_created_at: g.created_at ? new Date(parseInt(g.created_at) * 1000).toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "wa_group_id" },
          );
        if (!upsertErr) upserted++;
      }

      return new Response(
        JSON.stringify({ success: true, synced: upserted, total: metaGroups.length }),
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
