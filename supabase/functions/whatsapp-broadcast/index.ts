import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_API_VERSION = "v20.0";
const BATCH_DELAY_MS = 500; // multi-number: default to first settings row

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
    const action = url.searchParams.get("action") || "list";

    // Helper: check if WhatsApp credit system is active
    async function isCreditSystemActive(): Promise<boolean> {
      const { data } = await adminSupabase
        .from("wa_message_pricing")
        .select("is_active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return Boolean(data?.is_active);
    }

    // ─── LIST: fetch campaigns ──────────────────────────────────────────
    if (action === "list" && req.method === "GET") {
      const { data, error } = await adminSupabase
        .from("wa_broadcast_campaigns")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ campaigns: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET: fetch single campaign with recipients ─────────────────────
    if (action === "get" && req.method === "GET") {
      const campaignId = url.searchParams.get("campaign_id");
      if (!campaignId) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("wa_broadcast_campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: recipients } = await adminSupabase
        .from("wa_broadcast_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      return new Response(
        JSON.stringify({ campaign, recipients: recipients || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE: create campaign with recipients ─────────────────────────
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const { template_name, template_language, template_components, recipients } = body;

      if (!template_name || !template_components || !recipients || !Array.isArray(recipients)) {
        return new Response(
          JSON.stringify({ error: "template_name, template_components, and recipients array are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("wa_broadcast_campaigns")
        .insert({
          user_id: userData.user.id,
          template_name,
          template_language: template_language || "en_US",
          template_components,
          status: "draft",
          total_recipients: recipients.length,
        })
        .select()
        .single();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: campError?.message || "Failed to create campaign" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const recipientRows = recipients.map((r: { lead_id?: string; phone_number: string }) => ({
        campaign_id: campaign.id,
        user_id: userData.user.id,
        lead_id: r.lead_id || null,
        phone_number: r.phone_number.replace(/^\+/, ""),
        status: "pending",
      }));

      const { error: recipError } = await adminSupabase
        .from("wa_broadcast_recipients")
        .insert(recipientRows);

      if (recipError) {
        return new Response(
          JSON.stringify({ error: recipError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, campaign_id: campaign.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SEND: start sending a campaign ─────────────────────────────────
    if (action === "send" && req.method === "POST") {
      const body = await req.json();
      const { campaign_id } = body;

      if (!campaign_id) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("wa_broadcast_campaigns")
        .select("*")
        .eq("id", campaign_id)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: settings, error: settingsError } = await adminSupabase
        .from("whatsapp_settings")
        .select("phone_number_id, access_token")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (settingsError || !settings || !settings.phone_number_id || !settings.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured. Go to Settings to set it up." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: pendingRecipients } = await adminSupabase
        .from("wa_broadcast_recipients")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (!pendingRecipients || pendingRecipients.length === 0) {
        return new Response(
          JSON.stringify({ error: "No pending recipients to send to" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ── Credit check: deduct credits before sending if system is active ──
      const creditSystemOn = await isCreditSystemActive();
      if (creditSystemOn) {
        const { data: balData } = await userSupabase.rpc("get_wa_credit_balance");
        const balance = typeof balData === "number" ? balData : 0;
        if (balance < pendingRecipients.length) {
          return new Response(
            JSON.stringify({
              error: `Insufficient WhatsApp credits. You need ${pendingRecipients.length} credits but have ${balance}. Please purchase credits in the WhatsApp Credits page.`,
              insufficient_credits: true,
              required: pendingRecipients.length,
              balance,
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Deduct credits via RPC (atomic, rejects overdraft)
        const { error: deductErr } = await userSupabase.rpc("deduct_wa_credits", {
          p_amount: pendingRecipients.length,
          p_reference: `Broadcast ${campaign_id}`,
        });
        if (deductErr) {
          return new Response(
            JSON.stringify({ error: deductErr.message || "Failed to deduct credits" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      await adminSupabase
        .from("wa_broadcast_campaigns")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);

      const phoneNumberId = settings.phone_number_id;
      const accessToken = settings.access_token;
      const templateName = campaign.template_name;
      const templateLanguage = campaign.template_language;
      const rawComponents = campaign.template_components;

      // Transform Meta template-definition components into the send API format.
      // Definition components look like: { type: "BODY", text: "Hello {{1}}", example: {...} }
      // Send API expects: { type: "body", parameters: [{ type: "text", text: "value" }] }
      // Components without parameters (e.g. HEADER with no variables) can be omitted.
      const sendComponents = Array.isArray(rawComponents)
        ? rawComponents
            .map((c: Record<string, unknown>) => ({
              type: typeof c.type === "string" ? (c.type as string).toLowerCase() : c.type,
              ...(c.parameters ? { parameters: c.parameters } : {}),
            }))
            .filter((c: Record<string, unknown>) => c.parameters)
        : [];

      let sentCount = campaign.sent_count || 0;
      let failedCount = campaign.failed_count || 0;

      for (const recipient of pendingRecipients) {
        try {
          const templatePayload: Record<string, unknown> = {
            name: templateName,
            language: { code: templateLanguage },
          };
          if (sendComponents.length > 0) {
            templatePayload.components = sendComponents;
          }

          const sendBody: Record<string, unknown> = {
            messaging_product: "whatsapp",
            to: recipient.phone_number,
            type: "template",
            template: templatePayload,
          };

          const sendRes = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(sendBody),
            },
          );

          const sendData = await sendRes.json();

          if (sendData.error) {
            const errCode = sendData.error.code;
            const errMsg = errCode === 131037
              ? "Your WhatsApp Business number's display name has not been approved by Meta yet. Until approval is granted, you cannot send outgoing messages. Please visit Meta Business Manager to submit or check the status of your display name approval."
              : (sendData.error.error_data?.details || sendData.error.message || "Unknown error");
            await adminSupabase
              .from("wa_broadcast_recipients")
              .update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() })
              .eq("id", recipient.id);
            failedCount++;
          } else {
            const waMessageId = sendData.messages?.[0]?.id || null;
            await adminSupabase
              .from("wa_broadcast_recipients")
              .update({ status: "sent", wa_message_id: waMessageId, sent_at: new Date().toISOString() })
              .eq("id", recipient.id);
            sentCount++;
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          await adminSupabase
            .from("wa_broadcast_recipients")
            .update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() })
            .eq("id", recipient.id);
          failedCount++;
        }

        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }

      const finalStatus = failedCount === pendingRecipients.length ? "failed" : "completed";
      await adminSupabase
        .from("wa_broadcast_campaigns")
        .update({
          status: finalStatus,
          sent_count: sentCount,
          failed_count: failedCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({
          success: true,
          sent: sentCount - (campaign.sent_count || 0),
          failed: failedCount - (campaign.failed_count || 0),
          status: finalStatus,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DELETE: delete a campaign ───────────────────────────────────────
    if (action === "delete" && req.method === "DELETE") {
      const body = await req.json();
      const { campaign_id } = body;

      if (!campaign_id) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error } = await adminSupabase
        .from("wa_broadcast_campaigns")
        .delete()
        .eq("id", campaign_id)
        .eq("user_id", userData.user.id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
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

