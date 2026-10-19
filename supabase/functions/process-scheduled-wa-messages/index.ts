import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_API_VERSION = "v20.0";

// Cron-triggered: finds scheduled WhatsApp messages whose scheduled_at has passed
// and sends them via the Meta Graph API. No auth — called by Supabase cron.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();
    const { data: dueMessages, error } = await supabase
      .from("wa_scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!dueMessages || dueMessages.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;
    let failed = 0;

    for (const sm of dueMessages) {
      try {
        // Resolve conversation
        const { data: conv } = await supabase
          .from("wa_conversations")
          .select("*")
          .eq("id", sm.conversation_id)
          .maybeSingle();

        if (!conv) {
          await supabase.from("wa_scheduled_messages").update({ status: "failed", error_message: "Conversation not found" }).eq("id", sm.id);
          failed++;
          continue;
        }

        // Resolve WhatsApp settings
        let settings: any = null;
        if (conv.wa_settings_id) {
          const { data: s } = await supabase.from("whatsapp_settings").select("*").eq("id", conv.wa_settings_id).maybeSingle();
          settings = s;
        }
        if (!settings) {
          const { data: s } = await supabase.from("whatsapp_settings").select("*").eq("user_id", sm.user_id).order("created_at", { ascending: true }).limit(1).maybeSingle();
          settings = s;
        }
        if (!settings || !settings.phone_number_id || !settings.access_token) {
          await supabase.from("wa_scheduled_messages").update({ status: "failed", error_message: "WhatsApp not configured" }).eq("id", sm.id);
          failed++;
          continue;
        }

        const to = conv.wa_phone_number.replace(/^\+/, "");
        const phoneNumberId = settings.phone_number_id;
        const accessToken = settings.access_token;

        let sendData: any;

        if (sm.template_name) {
          // Template message path
          const rawComponents = sm.template_components || [];
          const sendComponents = Array.isArray(rawComponents)
            ? rawComponents
                .map((c: Record<string, unknown>) => {
                  const typeStr = typeof c.type === "string" ? (c.type as string).toLowerCase() : "";
                  const params = c.parameters as Array<{ type: string; text: string }> | undefined;
                  if (params && Array.isArray(params) && params.length > 0) {
                    return { type: typeStr, parameters: params };
                  }
                  return null;
                })
                .filter((c: Record<string, unknown> | null) => c !== null)
            : [];

          const templatePayload: Record<string, unknown> = {
            name: sm.template_name,
            language: { code: sm.template_language || "en_US" },
          };
          if (sendComponents.length > 0) templatePayload.components = sendComponents;

          const sendBody: Record<string, unknown> = {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: templatePayload,
          };

          const sendRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify(sendBody),
          });
          sendData = await sendRes.json();

          if (sendData.error) {
            await supabase.from("wa_scheduled_messages").update({ status: "failed", error_message: sendData.error.error_data?.details || sendData.error.message }).eq("id", sm.id);
            failed++;
            continue;
          }

          const waMessageId = sendData.messages?.[0]?.id || null;
          let previewText = `[Template: ${sm.template_name}]`;
          if (sm.text) previewText = sm.text.slice(0, 200);

          await supabase.from("wa_messages").insert({
            conversation_id: sm.conversation_id,
            sender: "admin",
            message_type: "template",
            text_content: previewText,
            wa_message_id: waMessageId,
            delivery_status: waMessageId ? "sent" : null,
          });
        } else {
          // Plain text message path
          const sendRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: sm.text },
            }),
          });
          sendData = await sendRes.json();

          if (sendData.error) {
            await supabase.from("wa_scheduled_messages").update({ status: "failed", error_message: sendData.error.error_data?.details || sendData.error.message }).eq("id", sm.id);
            failed++;
            continue;
          }

          const waMessageId = sendData.messages?.[0]?.id || null;
          await supabase.from("wa_messages").insert({
            conversation_id: sm.conversation_id,
            sender: "admin",
            message_type: "text",
            text_content: sm.text,
            wa_message_id: waMessageId,
            delivery_status: waMessageId ? "sent" : null,
          });
        }

        await supabase.from("wa_conversations").update({
          last_message_text: (sm.text || `[Template: ${sm.template_name}]`).slice(0, 100),
          last_message_at: new Date().toISOString(),
        }).eq("id", sm.conversation_id);

        await supabase.from("wa_scheduled_messages").update({ status: "sent", wa_message_id: sendData.messages?.[0]?.id || null }).eq("id", sm.id);
        sent++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("wa_scheduled_messages").update({ status: "failed", error_message: errMsg }).eq("id", sm.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed: dueMessages.length, sent, failed }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
