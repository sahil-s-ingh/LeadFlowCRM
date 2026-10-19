import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_API_VERSION = "v21.0";
const BATCH_DELAY_MS = 500;
// Broadcast sender — create, send, schedule, retry, duplicate check, variable mapping, CSV
// Opt-out filtering, drip sequences, audience management

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const isServiceRoleCall = bearerToken && bearerToken === supabaseKey;

    // update_status is a server-to-server callback from the webhook (uses the
    // service role key, not a user JWT). Allow it through without user auth.
    if (action === "update_status" && req.method === "POST") {
      if (!isServiceRoleCall) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adminSupabase = createClient(supabaseUrl, supabaseKey);
      const body = await req.json();
      // Support two shapes:
      //   (a) { wa_message_id, status }            — legacy single update
      //   (b) { statuses: [{ id, status, ... }] }  — forwarded Meta webhook payload
      const statuses: any[] = Array.isArray(body.statuses) ? body.statuses : (body.wa_message_id ? [{ id: body.wa_message_id, status: body.status }] : []);
      if (statuses.length === 0) return new Response(JSON.stringify({ error: "wa_message_id/status or statuses array is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const affectedCampaigns = new Set<string>();

      for (const s of statuses) {
        const waMessageId = s.id || s.wa_message_id;
        const newStatus = (s.status || "").toLowerCase();
        if (!waMessageId || !newStatus) continue;

        const updateData: Record<string, unknown> = { status: newStatus };
        if (newStatus === "delivered") updateData.delivered_at = new Date().toISOString();
        if (newStatus === "read") { updateData.delivered_at = new Date().toISOString(); updateData.read_at = new Date().toISOString(); }

        const { data: recipient } = await adminSupabase.from("wa_broadcast_recipients").update(updateData).eq("wa_message_id", waMessageId).select("campaign_id").maybeSingle();
        if (recipient?.campaign_id) affectedCampaigns.add(recipient.campaign_id);
      }

      // Recalculate aggregate stats for every affected campaign
      for (const campaignId of affectedCampaigns) {
        const { data: stats } = await adminSupabase.from("wa_broadcast_recipients").select("status").eq("campaign_id", campaignId);
        if (!stats) continue;
        const delivered = stats.filter((st: { status: string }) => st.status === "delivered" || st.status === "read").length;
        const read = stats.filter((st: { status: string }) => st.status === "read").length;
        const sent = stats.filter((st: { status: string }) => ["sent", "delivered", "read"].includes(st.status)).length;
        const failed = stats.filter((st: { status: string }) => st.status === "failed").length;
        await adminSupabase.from("wa_broadcast_campaigns").update({ delivered_count: delivered, read_count: read, sent_count: sent, failed_count: failed }).eq("id", campaignId);
      }

      return new Response(JSON.stringify({ success: true, updated: statuses.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    // ─── LIST ───────────────────────────────────────────────────────────
    if (action === "list" && req.method === "GET") {
      const { data, error } = await adminSupabase
        .from("wa_broadcast_campaigns")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ campaigns: data || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── GET ────────────────────────────────────────────────────────────
    if (action === "get" && req.method === "GET") {
      const campaignId = url.searchParams.get("campaign_id");
      if (!campaignId) return new Response(JSON.stringify({ error: "campaign_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: campaign, error: campError } = await adminSupabase.from("wa_broadcast_campaigns").select("*").eq("id", campaignId).eq("user_id", userData.user.id).maybeSingle();
      if (campError || !campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: recipients } = await adminSupabase.from("wa_broadcast_recipients").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: true });
      return new Response(JSON.stringify({ campaign, recipients: recipients || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── GET_PHONE_NUMBERS ──────────────────────────────────────────────
    if (action === "get_phone_numbers" && req.method === "GET") {
      const { data: numbers, error } = await adminSupabase.from("whatsapp_settings").select("id, phone_number_id, phone_number_display, connected_phone_number").eq("user_id", userData.user.id).order("created_at", { ascending: true });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ phone_numbers: numbers || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── PREVIEW_RECIPIENTS ─────────────────────────────────────────────
    if (action === "preview_recipients" && req.method === "GET") {
      const filter = url.searchParams.get("filter") || "all";
      let query = adminSupabase.from("submissions").select("id, full_name, mobile_number, email, state, status, trading_product").eq("user_id", userData.user.id).is("deleted_at", null).limit(50);
      if (filter !== "all") query = query.eq("status", filter);
      const { data: leads, error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ recipients: leads || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CHECK_DUPLICATES ───────────────────────────────────────────────
    if (action === "check_duplicates" && req.method === "POST") {
      const body = await req.json();
      const { template_name, phone_numbers } = body;
      if (!template_name || !phone_numbers || !Array.isArray(phone_numbers)) {
        return new Response(JSON.stringify({ error: "template_name and phone_numbers array are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentRecipients, error } = await adminSupabase
        .from("wa_broadcast_recipients")
        .select("phone_number, campaign_id!inner(template_name)")
        .eq("user_id", userData.user.id)
        .eq("campaign_id.template_name", template_name)
        .gte("sent_at", twentyFourHoursAgo)
        .in("phone_number", phone_numbers);

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const dupedPhones = new Set((recentRecipients || []).map((r: { phone_number: string }) => r.phone_number));
      const dupCount = phone_numbers.filter((p: string) => dupedPhones.has(p.replace(/^\+/, ""))).length;

      return new Response(JSON.stringify({ duplicates: dupCount, total_checked: phone_numbers.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CREATE ─────────────────────────────────────────────────────────
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const { template_name, template_language, template_components, recipients, campaign_name, scheduled_at, phone_number_id, variable_mapping } = body;

      if (!template_name || !template_components || !recipients || !Array.isArray(recipients)) {
        return new Response(JSON.stringify({ error: "template_name, template_components, and recipients array are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch opted-out phone numbers for this user and exclude them
      const { data: optOuts } = await adminSupabase
        .from("wa_opt_outs")
        .select("phone_number")
        .eq("user_id", userData.user.id)
        .eq("status", "opted_out");
      const optedOutSet = new Set((optOuts || []).map((o: { phone_number: string }) => o.phone_number.replace(/^\+/, "")));

      const resolveVariables = (recipient: { lead_id?: string; phone_number: string; name?: string; lead_data?: Record<string, unknown> }): Record<string, string> => {
        if (!variable_mapping || Object.keys(variable_mapping).length === 0) return {};
        const leadData = recipient.lead_data || {};
        const resolved: Record<string, string> = {};
        for (const [varNum, fieldName] of Object.entries(variable_mapping)) {
          const val = (leadData as Record<string, unknown>)[fieldName as string];
          if (val !== null && val !== undefined) resolved[varNum] = String(val);
        }
        return resolved;
      };

      const filteredRecipients = recipients.filter((r: { phone_number: string }) => !optedOutSet.has(r.phone_number.replace(/^\+/, "")));
      const excludedCount = recipients.length - filteredRecipients.length;
      if (filteredRecipients.length === 0) {
        return new Response(JSON.stringify({ error: `All ${recipients.length} recipients have opted out of broadcasts and were excluded.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const recipientRows = filteredRecipients.map((r: { lead_id?: string; phone_number: string; name?: string; lead_data?: Record<string, unknown> }) => ({
        campaign_id: null,
        user_id: userData.user.id,
        lead_id: r.lead_id || null,
        phone_number: r.phone_number.replace(/^\+/, ""),
        recipient_name: r.name || null,
        status: "pending",
        variable_values: resolveVariables(r),
        is_manual: !r.lead_id,
      }));

      const { data: campaign, error: campError } = await adminSupabase
        .from("wa_broadcast_campaigns")
        .insert({ user_id: userData.user.id, campaign_name: campaign_name || template_name, template_name, template_language: template_language || "en_US", template_components, status: scheduled_at ? "scheduled" : "draft", total_recipients: filteredRecipients.length, scheduled_at: scheduled_at || null, phone_number_id: phone_number_id || null, variable_mapping: variable_mapping || {} })
        .select().single();

      if (campError || !campaign) return new Response(JSON.stringify({ error: campError?.message || "Failed to create campaign" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const finalRecipientRows = recipientRows.map((r) => ({ ...r, campaign_id: campaign.id }));
      const { error: recipError } = await adminSupabase.from("wa_broadcast_recipients").insert(finalRecipientRows);
      if (recipError) return new Response(JSON.stringify({ error: recipError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      return new Response(JSON.stringify({ success: true, campaign_id: campaign.id, excluded_opt_outs: excludedCount }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── SEND (also used by retry — filters by status) ──────────────────
    if (action === "send" && req.method === "POST") {
      const body = await req.json();
      const { campaign_id, retry_only } = body;
      if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: campaign, error: campError } = await adminSupabase.from("wa_broadcast_campaigns").select("*").eq("id", campaign_id).eq("user_id", userData.user.id).maybeSingle();
      if (campError || !campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      let settingsQuery = adminSupabase.from("whatsapp_settings").select("phone_number_id, access_token").eq("user_id", userData.user.id).order("created_at", { ascending: true }).limit(1);
      if (campaign.phone_number_id) {
        settingsQuery = adminSupabase.from("whatsapp_settings").select("phone_number_id, access_token").eq("user_id", userData.user.id).eq("phone_number_id", campaign.phone_number_id).limit(1);
      }
      const { data: settings } = await settingsQuery.maybeSingle();
      if (!settings || !settings.phone_number_id || !settings.access_token) return new Response(JSON.stringify({ error: "WhatsApp is not configured. Go to Settings to set it up." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // For retry: only get failed recipients. For normal send: only pending.
      let recipQuery = adminSupabase.from("wa_broadcast_recipients").select("*").eq("campaign_id", campaign_id).order("created_at", { ascending: true });
      if (retry_only) {
        recipQuery = recipQuery.eq("status", "failed");
      } else {
        recipQuery = recipQuery.eq("status", "pending");
      }

      const { data: targets } = await recipQuery;
      if (!targets || targets.length === 0) return new Response(JSON.stringify({ error: retry_only ? "No failed recipients to retry" : "No pending recipients to send to" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await adminSupabase.from("wa_broadcast_campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", campaign_id);

      const phoneNumberId = settings.phone_number_id;
      const accessToken = settings.access_token;
      const templateName = campaign.template_name;
      const templateLanguage = campaign.template_language;

      // Count the {{N}} placeholders expected by the template body so we always
      // send the correct number of parameters, even when a recipient has no
      // mapped variable values. WhatsApp rejects mismatches with:
      // "number of localizable_params (0) does not match the expected number of params (N)"
      const storedComponents: any[] = Array.isArray(campaign.template_components) ? campaign.template_components : [];
      const bodyComponent = storedComponents.find((c) => (c?.type || "").toUpperCase() === "BODY");
      const bodyText: string = bodyComponent?.text || "";
      const placeholderMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const expectedParamCount = placeholderMatches.length;

      let sentCount = campaign.sent_count || 0;
      let failedCount = retry_only ? 0 : (campaign.failed_count || 0);

      for (const recipient of targets) {
        try {
          const varValues: Record<string, string> = recipient.variable_values || {};
          const components: { type: string; parameters: { type: string; text: string }[] }[] = [];

          if (expectedParamCount > 0) {
            const params: { type: string; text: string }[] = [];
            for (let i = 1; i <= expectedParamCount; i++) {
              const key = String(i);
              const rawVal = varValues[key];
              const val = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "" ? String(rawVal) : " ";
              params.push({ type: "text", text: val });
            }
            components.push({ type: "body", parameters: params });
          } else if (varValues && Object.keys(varValues).length > 0) {
            const sortedKeys = Object.keys(varValues).sort((a, b) => parseInt(a) - parseInt(b));
            components.push({ type: "body", parameters: sortedKeys.map((k) => ({ type: "text", text: varValues[k] || " " })) });
          }

          const templatePayload: Record<string, unknown> = { name: templateName, language: { code: templateLanguage } };
          if (components.length > 0) templatePayload.components = components;

          const sendBody: Record<string, unknown> = { messaging_product: "whatsapp", to: recipient.phone_number, type: "template", template: templatePayload };

          const sendRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify(sendBody),
          });
          const sendData = await sendRes.json();

          if (sendData.error) {
            const errCode = sendData.error.code;
            const errMsg = errCode === 131037 ? "Your WhatsApp Business number's display name has not been approved by Meta yet." : (sendData.error.error_data?.details || sendData.error.message || "Unknown error");
            await adminSupabase.from("wa_broadcast_recipients").update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() }).eq("id", recipient.id);
            failedCount++;
          } else {
            const waMessageId = sendData.messages?.[0]?.id || null;
            await adminSupabase.from("wa_broadcast_recipients").update({ status: "sent", wa_message_id: waMessageId, sent_at: new Date().toISOString(), error_message: null }).eq("id", recipient.id);
            sentCount++;
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          await adminSupabase.from("wa_broadcast_recipients").update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() }).eq("id", recipient.id);
          failedCount++;
        }
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }

      // Recalculate actual counts from DB for accuracy
      const { data: allRecips } = await adminSupabase.from("wa_broadcast_recipients").select("status").eq("campaign_id", campaign_id);
      const realSent = (allRecips || []).filter((r: { status: string }) => r.status === "sent").length;
      const realFailed = (allRecips || []).filter((r: { status: string }) => r.status === "failed").length;
      const realDelivered = (allRecips || []).filter((r: { status: string }) => r.status === "delivered" || r.status === "read").length;
      const realRead = (allRecips || []).filter((r: { status: string }) => r.status === "read").length;

      const finalStatus = realFailed === (allRecips || []).length ? "failed" : "completed";
      await adminSupabase.from("wa_broadcast_campaigns").update({ status: finalStatus, sent_count: realSent, failed_count: realFailed, delivered_count: realDelivered, read_count: realRead, updated_at: new Date().toISOString() }).eq("id", campaign_id);

      return new Response(JSON.stringify({ success: true, sent: realSent, failed: realFailed, status: finalStatus }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CANCEL ─────────────────────────────────────────────────────────
    if (action === "cancel" && req.method === "POST") {
      const body = await req.json();
      const { campaign_id } = body;
      if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await adminSupabase.from("wa_broadcast_campaigns").update({ status: "draft", scheduled_at: null, updated_at: new Date().toISOString() }).eq("id", campaign_id).eq("user_id", userData.user.id).eq("status", "scheduled");
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DELETE ─────────────────────────────────────────────────────────
    if (action === "delete" && req.method === "DELETE") {
      const body = await req.json();
      const { campaign_id } = body;
      if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await adminSupabase.from("wa_broadcast_campaigns").delete().eq("id", campaign_id).eq("user_id", userData.user.id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── LIST_OPT_OUTS ─────────────────────────────────────────────────
    if (action === "list_opt_outs" && req.method === "GET") {
      const { data, error } = await adminSupabase
        .from("wa_opt_outs")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("opted_out_at", { ascending: false });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ opt_outs: data || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── RESUBSCRIBE ───────────────────────────────────────────────────
    if (action === "resubscribe" && req.method === "POST") {
      const body = await req.json();
      const { opt_out_id } = body;
      if (!opt_out_id) return new Response(JSON.stringify({ error: "opt_out_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await adminSupabase
        .from("wa_opt_outs")
        .update({ status: "subscribed", opted_in_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", opt_out_id)
        .eq("user_id", userData.user.id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ADD_OPT_OUT (manual) ──────────────────────────────────────────
    if (action === "add_opt_out" && req.method === "POST") {
      const body = await req.json();
      const { phone_number } = body;
      if (!phone_number) return new Response(JSON.stringify({ error: "phone_number is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const normalized = phone_number.replace(/^\+/, "");
      const { data: existing } = await adminSupabase
        .from("wa_opt_outs")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("phone_number", normalized)
        .maybeSingle();
      if (existing) {
        await adminSupabase.from("wa_opt_outs").update({ status: "opted_out", reason: "manual", opted_out_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await adminSupabase.from("wa_opt_outs").insert({ user_id: userData.user.id, phone_number: normalized, reason: "manual", status: "opted_out", opted_out_at: new Date().toISOString() });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DRIP: CREATE SEQUENCE ─────────────────────────────────────────
    if (action === "drip_create" && req.method === "POST") {
      const body = await req.json();
      const { name, recipient_filter, segment_id, phone_number_id, steps } = body;
      if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
        return new Response(JSON.stringify({ error: "name and steps array are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch recipients based on filter or segment
      let leads: any[] = [];
      if (segment_id) {
        const { data: seg } = await adminSupabase.from("wa_broadcast_segments").select("conditions").eq("id", segment_id).eq("user_id", userData.user.id).maybeSingle();
        if (seg?.conditions) {
          let query = adminSupabase.from("submissions").select("id, full_name, mobile_number, email, state, status, trading_product, fund_amount, lead_source").eq("user_id", userData.user.id).is("deleted_at", null);
          for (const cond of seg.conditions) {
            if (!cond.value?.trim?.()) continue;
            if (cond.operator === "eq") query = query.eq(cond.field, cond.value);
            else if (cond.operator === "neq") query = query.neq(cond.field, cond.value);
            else if (cond.operator === "contains") query = query.ilike(cond.field, `%${cond.value}%`);
            else if (cond.operator === "gt") query = query.gt(cond.field, cond.value);
            else if (cond.operator === "lt") query = query.lt(cond.field, cond.value);
          }
          const { data } = await query;
          leads = data || [];
        }
      } else {
        let query = adminSupabase.from("submissions").select("id, full_name, mobile_number, email, state, status, trading_product, fund_amount, lead_source").eq("user_id", userData.user.id).is("deleted_at", null);
        if (recipient_filter && recipient_filter !== "all") query = query.eq("status", recipient_filter);
        const { data } = await query;
        leads = data || [];
      }

      // Filter leads with phone numbers and exclude opted-out
      const { data: optOuts } = await adminSupabase.from("wa_opt_outs").select("phone_number").eq("user_id", userData.user.id).eq("status", "opted_out");
      const optedOutSet = new Set((optOuts || []).map((o: any) => o.phone_number.replace(/^\+/, "")));
      const validLeads = leads.filter((l: any) => l.mobile_number?.trim() && !optedOutSet.has(l.mobile_number.trim().replace(/^\+/, "")));
      if (validLeads.length === 0) return new Response(JSON.stringify({ error: "No valid recipients found (all either lack phone numbers or have opted out)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Create the sequence
      const { data: seq, error: seqErr } = await adminSupabase
        .from("wa_drip_sequences")
        .insert({ user_id: userData.user.id, name, recipient_filter: recipient_filter || "all", segment_id: segment_id || null, phone_number_id: phone_number_id || null, status: "active", total_recipients: validLeads.length, started_at: new Date().toISOString() })
        .select().single();
      if (seqErr || !seq) return new Response(JSON.stringify({ error: seqErr?.message || "Failed to create sequence" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Create steps sorted by offset_days then step_number
      const sortedSteps = [...steps].sort((a: any, b: any) => (a.offset_days || 0) - (b.offset_days || 0));
      for (let i = 0; i < sortedSteps.length; i++) {
        const s = sortedSteps[i];
        const { data: step } = await adminSupabase
          .from("wa_drip_steps")
          .insert({
            sequence_id: seq.id,
            user_id: userData.user.id,
            step_number: i + 1,
            template_name: s.template_name,
            template_language: s.template_language || "en_US",
            template_components: s.template_components || [],
            variable_mapping: s.variable_mapping || {},
            offset_days: s.offset_days || 0,
            status: s.offset_days === 0 ? "pending" : "pending",
          })
          .select().single();

        if (step) {
          // Create drip recipients for this step
          const resolveVars = (lead: any): Record<string, string> => {
            if (!s.variable_mapping || Object.keys(s.variable_mapping).length === 0) return {};
            const resolved: Record<string, string> = {};
            for (const [varNum, fieldName] of Object.entries(s.variable_mapping)) {
              const val = lead[fieldName as string];
              if (val !== null && val !== undefined) resolved[varNum] = String(val);
            }
            return resolved;
          };
          const recipRows = validLeads.map((l: any) => ({
            sequence_id: seq.id,
            step_id: step.id,
            user_id: userData.user.id,
            lead_id: l.id,
            phone_number: l.mobile_number.trim().replace(/^\+/, ""),
            recipient_name: l.full_name || null,
            status: "pending",
            variable_values: resolveVars(l),
          }));
          // Insert in batches of 200
          for (let j = 0; j < recipRows.length; j += 200) {
            await adminSupabase.from("wa_drip_recipients").insert(recipRows.slice(j, j + 200));
          }
        }
      }

      return new Response(JSON.stringify({ success: true, sequence_id: seq.id, total_recipients: validLeads.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DRIP: LIST SEQUENCES ──────────────────────────────────────────
    if (action === "drip_list" && req.method === "GET") {
      const { data, error } = await adminSupabase
        .from("wa_drip_sequences")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      // Fetch steps for each sequence
      const seqIds = (data || []).map((s: any) => s.id);
      let stepsBySeq: Record<string, any[]> = {};
      if (seqIds.length > 0) {
        const { data: allSteps } = await adminSupabase.from("wa_drip_steps").select("*").in("sequence_id", seqIds).order("step_number", { ascending: true });
        for (const st of allSteps || []) {
          if (!stepsBySeq[st.sequence_id]) stepsBySeq[st.sequence_id] = [];
          stepsBySeq[st.sequence_id].push(st);
        }
      }
      const sequences = (data || []).map((s: any) => ({ ...s, steps: stepsBySeq[s.id] || [] }));
      return new Response(JSON.stringify({ sequences }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DRIP: GET SEQUENCE DETAIL ─────────────────────────────────────
    if (action === "drip_get" && req.method === "GET") {
      const seqId = url.searchParams.get("sequence_id");
      if (!seqId) return new Response(JSON.stringify({ error: "sequence_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: seq } = await adminSupabase.from("wa_drip_sequences").select("*").eq("id", seqId).eq("user_id", userData.user.id).maybeSingle();
      if (!seq) return new Response(JSON.stringify({ error: "Sequence not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: steps } = await adminSupabase.from("wa_drip_steps").select("*").eq("sequence_id", seqId).order("step_number", { ascending: true });
      return new Response(JSON.stringify({ sequence: seq, steps: steps || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DRIP: PAUSE / RESUME / DELETE ─────────────────────────────────
    if (action === "drip_update_status" && req.method === "POST") {
      const body = await req.json();
      const { sequence_id, status } = body;
      if (!sequence_id || !status) return new Response(JSON.stringify({ error: "sequence_id and status are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "completed") updateData.completed_at = new Date().toISOString();
      const { error } = await adminSupabase.from("wa_drip_sequences").update(updateData).eq("id", sequence_id).eq("user_id", userData.user.id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "drip_delete" && req.method === "DELETE") {
      const body = await req.json();
      const { sequence_id } = body;
      if (!sequence_id) return new Response(JSON.stringify({ error: "sequence_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await adminSupabase.from("wa_drip_sequences").delete().eq("id", sequence_id).eq("user_id", userData.user.id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── AUDIENCE: LIST with recipient counts ──────────────────────────
    if (action === "audience_list" && req.method === "GET") {
      const { data, error } = await adminSupabase
        .from("wa_broadcast_segments")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ audiences: data || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── AUDIENCE: SAVE ────────────────────────────────────────────────
    if (action === "audience_save" && req.method === "POST") {
      const body = await req.json();
      const { name, description, conditions, type } = body;
      if (!name || !conditions || !Array.isArray(conditions)) {
        return new Response(JSON.stringify({ error: "name and conditions array are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Count matching leads
      let query = adminSupabase.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", userData.user.id).is("deleted_at", null);
      for (const cond of conditions) {
        if (!cond.value?.trim?.()) continue;
        if (cond.operator === "eq") query = query.eq(cond.field, cond.value);
        else if (cond.operator === "neq") query = query.neq(cond.field, cond.value);
        else if (cond.operator === "contains") query = query.ilike(cond.field, `%${cond.value}%`);
        else if (cond.operator === "gt") query = query.gt(cond.field, cond.value);
        else if (cond.operator === "lt") query = query.lt(cond.field, cond.value);
      }
      const { count } = await query;
      const { data, error } = await adminSupabase
        .from("wa_broadcast_segments")
        .insert({ user_id: userData.user.id, name, description: description || null, conditions, type: type || "audience", recipient_count: count || 0 })
        .select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, audience: data, recipient_count: count || 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
