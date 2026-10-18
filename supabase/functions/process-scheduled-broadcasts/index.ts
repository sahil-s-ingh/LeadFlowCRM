import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_API_VERSION = "v21.0";
const BATCH_DELAY_MS = 500;

// Cron-triggered function: finds scheduled campaigns whose scheduled_at has passed
// and sends them automatically. No auth — called by Supabase cron scheduler.
// Auto-sends scheduled WhatsApp broadcasts.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all scheduled campaigns where scheduled_at <= now
    const now = new Date().toISOString();
    const { data: dueCampaigns, error } = await supabase
      .from("wa_broadcast_campaigns")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!dueCampaigns || dueCampaigns.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No scheduled campaigns due" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: { campaign_id: string; sent: number; failed: number }[] = [];

    for (const campaign of dueCampaigns) {
      try {
        // Get WhatsApp settings for this user
        let settingsQuery = supabase
          .from("whatsapp_settings")
          .select("phone_number_id, access_token")
          .eq("user_id", campaign.user_id)
          .order("created_at", { ascending: true })
          .limit(1);

        if (campaign.phone_number_id) {
          settingsQuery = supabase
            .from("whatsapp_settings")
            .select("phone_number_id, access_token")
            .eq("user_id", campaign.user_id)
            .eq("phone_number_id", campaign.phone_number_id)
            .limit(1);
        }

        const { data: settings } = await settingsQuery.maybeSingle();
        if (!settings || !settings.phone_number_id || !settings.access_token) {
          // Mark as failed — no WhatsApp config
          await supabase.from("wa_broadcast_campaigns").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", campaign.id);
          results.push({ campaign_id: campaign.id, sent: 0, failed: 0 });
          continue;
        }

        const { data: pendingRecipients } = await supabase
          .from("wa_broadcast_recipients")
          .select("*")
          .eq("campaign_id", campaign.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (!pendingRecipients || pendingRecipients.length === 0) {
          await supabase.from("wa_broadcast_campaigns").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", campaign.id);
          results.push({ campaign_id: campaign.id, sent: 0, failed: 0 });
          continue;
        }

        await supabase.from("wa_broadcast_campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", campaign.id);

        let sentCount = 0;
        let failedCount = 0;
        const phoneNumberId = settings.phone_number_id;
        const accessToken = settings.access_token;
        const templateName = campaign.template_name;
        const templateLanguage = campaign.template_language;

        // Count the {{N}} placeholders expected by the template body so we
        // always send the correct number of parameters. WhatsApp rejects a
        // mismatch with "number of localizable_params (0) does not match..."
        const storedComponents: any[] = Array.isArray(campaign.template_components) ? campaign.template_components : [];
        const bodyComponent = storedComponents.find((c) => (c?.type || "").toUpperCase() === "BODY");
        const bodyText: string = bodyComponent?.text || "";
        const placeholderMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
        const expectedParamCount = placeholderMatches.length;

        for (const recipient of pendingRecipients) {
          try {
            const components: { type: string; parameters: { type: string; text: string }[] }[] = [];
            const varValues: Record<string, string> = recipient.variable_values || {};

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
              const errMsg = sendData.error.error_data?.details || sendData.error.message || "Unknown error";
              await supabase.from("wa_broadcast_recipients").update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() }).eq("id", recipient.id);
              failedCount++;
            } else {
              const waMessageId = sendData.messages?.[0]?.id || null;
              await supabase.from("wa_broadcast_recipients").update({ status: "sent", wa_message_id: waMessageId, sent_at: new Date().toISOString() }).eq("id", recipient.id);
              sentCount++;
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            await supabase.from("wa_broadcast_recipients").update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() }).eq("id", recipient.id);
            failedCount++;
          }
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }

        // Recalculate from DB
        const { data: allRecips } = await supabase.from("wa_broadcast_recipients").select("status").eq("campaign_id", campaign.id);
        const realSent = (allRecips || []).filter((r: { status: string }) => r.status === "sent").length;
        const realFailed = (allRecips || []).filter((r: { status: string }) => r.status === "failed").length;
        const realDelivered = (allRecips || []).filter((r: { status: string }) => r.status === "delivered" || r.status === "read").length;
        const realRead = (allRecips || []).filter((r: { status: string }) => r.status === "read").length;
        const finalStatus = realFailed === (allRecips || []).length ? "failed" : "completed";

        await supabase.from("wa_broadcast_campaigns").update({ status: finalStatus, sent_count: realSent, failed_count: realFailed, delivered_count: realDelivered, read_count: realRead, updated_at: new Date().toISOString() }).eq("id", campaign.id);
        results.push({ campaign_id: campaign.id, sent: realSent, failed: realFailed });
      } catch {
        results.push({ campaign_id: campaign.id, sent: 0, failed: 0 });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
