import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.15";
// multi-number support: conversations tagged with wa_settings_id

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendChatNotificationEmail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  senderName: string,
  messagePreview: string,
  platform: "Telegram" | "WhatsApp",
): Promise<void> {
  try {
    const { data: fuSettings } = await supabase
      .from("follow_up_settings")
      .select("reminder_email, enable_whatsapp_notifications")
      .eq("user_id", userId)
      .maybeSingle();

    if (!fuSettings || !fuSettings.reminder_email || !fuSettings.enable_whatsapp_notifications) return;

    const { data: smtpConfig } = await supabase
      .from("smtp_settings")
      .select("smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!smtpConfig || !smtpConfig.smtp_host || !smtpConfig.smtp_username || !smtpConfig.smtp_password) return;

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: (smtpConfig.smtp_port || 587) === 465,
      auth: { user: smtpConfig.smtp_username, pass: smtpConfig.smtp_password },
    });

    const subject = `New ${platform} message from ${senderName}`;
    const textBody = `New ${platform} Message

You received a new message on ${platform} from: ${senderName}

Message: ${messagePreview}

Log in to your CRM to reply.`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #0891B2, #06B6D4); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 1.4rem;">New ${platform} Message</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 0.9rem;">LeadCentre CRM</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p style="font-size: 1rem; color: #1f2937; margin: 0 0 16px;">You received a new message on ${platform} from:</p>
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 12px; font-size: 1.2rem; color: #111827;">${senderName}</h2>
            <div style="margin-top: 12px; padding: 12px; background: #f1f5f9; border-radius: 8px; font-size: 0.88rem; color: #475569; line-height: 1.5;">${messagePreview}</div>
          </div>
          <p style="margin-top: 24px; font-size: 0.78rem; color: #94a3b8; text-align: center;">This notification was sent from your LeadCentre CRM account.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: smtpConfig.from_name
        ? `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.smtp_username}>`
        : (smtpConfig.from_email || smtpConfig.smtp_username),
      to: fuSettings.reminder_email,
      subject,
      text: textBody,
      html: htmlBody,
    });
  } catch {
    // Email notification is best-effort; don't block the webhook
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);

    // Meta webhook verification (GET request)
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe") {
        // Look up all whatsapp_settings to find a matching verify_token
        const { data: allSettings } = await supabase
          .from("whatsapp_settings")
          .select("verify_token");

        const match = allSettings?.find((s) => s.verify_token && s.verify_token === token);
        if (match || !allSettings || allSettings.length === 0) {
          // If no settings at all, accept any token (first-time setup)
          // If settings exist, only accept matching token
          if (allSettings && allSettings.length > 0 && !match) {
            return new Response("Forbidden", { status: 403, headers: corsHeaders });
          }
          return new Response(challenge || "ok", {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/plain" },
          });
        }
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // POST: incoming WhatsApp message
    const body = await req.json();

    // Meta webhook payload structure:
    // { entry: [{ changes: [{ value: { messages: [...], contacts: [...], metadata: { phone_number_id } } }] }] }
    if (!body?.entry || !Array.isArray(body.entry)) {
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        // Forward call events to the call-signaling function
        if (change.field === "calls" || (change.value?.calls) || (change.value?.statuses && change.value?.statuses?.some((s: any) => s.type === "call"))) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/whatsapp-call-signaling`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify(body),
            });
          } catch { /* best effort forward */ }
        }

        // Also forward call permission reply messages (interactive type call_permission_reply)
        if (change.field === "messages" && change.value?.messages?.some((m: any) => m.interactive?.type === "call_permission_reply")) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/whatsapp-call-signaling`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify(body),
            });
          } catch { /* best effort forward */ }
        }

        const value = change.value;
        if (!value) continue;

        // ─── Handle delivery/read status callbacks for outbound messages ───
        // Meta sends these when messages you sent transition to sent/delivered/read.
        // We update the matching wa_messages row AND forward to the broadcast function
        // to update recipient + campaign stats.
        if (Array.isArray(value.statuses) && value.statuses.length > 0) {
          // 1. Update individual chat message rows (1:1 inbox messages)
          for (const st of value.statuses) {
            const mid = st.id;
            const stStatus = (st.status || "").toLowerCase();
            if (!mid || !stStatus) continue;
            const upd: Record<string, unknown> = { delivery_status: stStatus };
            if (stStatus === "delivered") upd.delivered_at = new Date().toISOString();
            if (stStatus === "read") { upd.delivered_at = new Date().toISOString(); upd.read_at = new Date().toISOString(); }
            if (stStatus === "failed") {
              const errs = st.errors?.[0];
              if (errs) upd.delivery_status = "failed";
            }
            if (stStatus === "typing") {
              // Update the conversation's typing indicator
              try {
                const phoneFromStatus = st.recipient_id ? `+${st.recipient_id}` : null;
                if (phoneFromStatus) {
                  await supabase.from("wa_conversations").update({ is_typing: true, typing_at: new Date().toISOString() }).eq("wa_phone_number", phoneFromStatus);
                }
              } catch { /* best effort */ }
              continue; // don't update wa_messages for typing
            }
            try {
              await supabase.from("wa_messages").update(upd).eq("wa_message_id", mid);
            } catch { /* best effort */ }
          }
          // 2. Forward to broadcast function for campaign recipient updates
          try {
            await fetch(`${supabaseUrl}/functions/v1/whatsapp-broadcast?action=update_status`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
              body: JSON.stringify({ statuses: value.statuses }),
            });
          } catch { /* best effort — don't block incoming message handling */ }
        }

        if (!value.messages || !Array.isArray(value.messages)) continue;

        const phoneNumberId = value.metadata?.phone_number_id;

        // Find settings matching this phone_number_id, or fallback to first
        let settings: any = null;
        if (phoneNumberId) {
          const { data } = await supabase
            .from("whatsapp_settings")
            .select("*")
            .eq("phone_number_id", phoneNumberId)
            .maybeSingle();
          settings = data;
        }
        if (!settings) {
          const { data: fallback } = await supabase
            .from("whatsapp_settings")
            .select("*")
            .limit(1)
            .maybeSingle();
          settings = fallback;
        }

        if (!settings) continue;

        const adminUserId = settings.user_id;
        const contacts = value.contacts || [];

        for (const msg of value.messages) {
          const waId = msg.from; // phone number without +
          const phoneFromWaId = waId ? `+${waId}` : "";
          const contactInfo = contacts.find((c: any) => c.wa_id === waId);
          const contactName = contactInfo?.profile?.name || contactInfo?.name || "";

          // Upsert conversation — tagged with wa_settings_id for multi-number support
          // Try with the new unique constraint first, fall back to insert+update for compatibility
          let conversation: any = null;
          const { data: existingConv } = await supabase
            .from("wa_conversations")
            .select("*")
            .eq("wa_settings_id", settings.id)
            .eq("wa_phone_number", phoneFromWaId)
            .maybeSingle();

          if (existingConv) {
            const { data: updated, error: updErr } = await supabase
              .from("wa_conversations")
              .update({
                wa_name: contactName,
                wa_wa_id: waId,
                last_message_text: getPreviewText(msg),
                last_message_at: new Date().toISOString(),
              })
              .eq("id", existingConv.id)
              .select()
              .single();
            conversation = updated;
          } else {
            const { data: inserted, error: insErr } = await supabase
              .from("wa_conversations")
              .insert({
                user_id: adminUserId,
                wa_settings_id: settings.id,
                wa_phone_number: phoneFromWaId,
                wa_name: contactName,
                wa_wa_id: waId,
                last_message_text: getPreviewText(msg),
                last_message_at: new Date().toISOString(),
                unread_count: 0,
              })
              .select()
              .single();
            conversation = inserted;
          }

          if (!conversation) continue;

          // Clear typing indicator and increment unread count
          await supabase
            .from("wa_conversations")
            .update({
              last_message_text: getPreviewText(msg),
              last_message_at: new Date().toISOString(),
              unread_count: conversation.unread_count + 1,
              is_typing: false,
            })
            .eq("id", conversation.id);

          // Insert the message
          const messageData: Record<string, unknown> = {
            conversation_id: conversation.id,
            sender: "client",
            message_type: getMessageType(msg),
            text_content: getTextContent(msg),
            media_id: getMediaId(msg),
            mime_type: getMimeType(msg),
            file_size: getFileSize(msg),
            file_name: getFileName(msg),
            latitude: msg.type === "location" ? msg.location?.latitude : null,
            longitude: msg.type === "location" ? msg.location?.longitude : null,
          };

          await supabase.from("wa_messages").insert(messageData);

          // Fire automation trigger for whatsapp_received
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-automations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                trigger_type: "whatsapp_received",
                lead_id: null,
                lead_data: { phone_number: phoneFromWaId, name: contactName, message: getTextContent(msg) },
                user_id: adminUserId,
              }),
            });
          } catch { /* best effort */ }

          // Send email notification to the admin
          const senderDisplayName = contactName || phoneFromWaId || "Unknown sender";
          const previewText = getPreviewText(msg);
          await sendChatNotificationEmail(supabase, adminUserId, senderDisplayName, previewText, "WhatsApp");

          // ─── Chatbot rule evaluation ───
          // After persisting the inbound message, check for a matching chatbot
          // rule owned by this admin. The first active rule (by priority) whose
          // keywords match the inbound text wins. If found, send the configured
          // reply (text / buttons / list), log the hit, and skip the default
          // welcome message below.
          let chatbotHandled = false;
          if (msg.type === "text") {
            try {
              chatbotHandled = await evaluateChatbotRules(
                supabase,
                adminUserId,
                settings,
                conversation,
                phoneFromWaId,
                getTextContent(msg) || "",
              );
            } catch { /* best effort — don't block inbound processing */ }
          }

          // Send welcome message if this is a new conversation and it's a text "hi"/"hello"
          // (skipped when a chatbot rule already replied)
          if (!chatbotHandled && settings.welcome_message && msg.type === "text") {
            const text = (msg.text?.body || "").toLowerCase().trim();
            if (["hi", "hello", "hey", "start", "menu"].includes(text)) {
              await sendWhatsAppMessage(
                settings.phone_number_id,
                settings.access_token,
                phoneFromWaId,
                settings.welcome_message,
              );
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
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

function getMessageType(msg: any): string {
  const t = msg.type;
  if (t === "text") return "text";
  if (t === "image") return "image";
  if (t === "video") return "video";
  if (t === "audio") return "audio";
  if (t === "voice") return "voice";
  if (t === "document") return "document";
  if (t === "sticker") return "sticker";
  if (t === "location") return "location";
  if (t === "contacts") return "contacts";
  return "text";
}

function getTextContent(msg: any): string | null {
  if (msg.type === "text") return msg.text?.body || null;
  if (msg.type === "image") return msg.image?.caption || null;
  if (msg.type === "video") return msg.video?.caption || null;
  if (msg.type === "document") return msg.document?.caption || null;
  return null;
}

function getPreviewText(msg: any): string {
  const text = getTextContent(msg);
  if (text) return text.slice(0, 100);
  if (msg.type === "image") return "📷 Photo";
  if (msg.type === "video") return "🎥 Video";
  if (msg.type === "audio") return "🎵 Audio";
  if (msg.type === "voice") return "🎤 Voice message";
  if (msg.type === "document") return `📎 ${msg.document?.filename || "File"}`;
  if (msg.type === "sticker") return "🏷️ Sticker";
  if (msg.type === "location") return "📍 Location";
  if (msg.type === "contacts") return "👤 Contact";
  return "Message";
}

function getMediaId(msg: any): string | null {
  const t = msg.type;
  if (["image", "video", "audio", "voice", "document", "sticker"].includes(t)) {
    return msg[t]?.id || null;
  }
  return null;
}

function getMimeType(msg: any): string | null {
  const t = msg.type;
  if (["image", "video", "audio", "voice", "document", "sticker"].includes(t)) {
    return msg[t]?.mime_type || null;
  }
  return null;
}

function getFileSize(msg: any): number | null {
  const t = msg.type;
  if (["document", "image", "video", "audio", "voice"].includes(t)) {
    return msg[t]?.size || null;
  }
  return null;
}

function getFileName(msg: any): string | null {
  if (msg.type === "document") return msg.document?.filename || null;
  return null;
}

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
) {
  const apiUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "text",
      text: { body: text },
    }),
  });
}

// ─── WhatsApp Chatbot rule evaluation ───
// Loads active rules for the admin (ordered by priority desc), checks each
// against the inbound text, and sends the first matching rule's reply.
// Returns true when a rule fired (so the caller can skip the default welcome).
async function evaluateChatbotRules(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  settings: any,
  conversation: any,
  phoneFromWaId: string,
  inboundText: string,
): Promise<boolean> {
  if (!inboundText) return false;

  const { data: rules } = await supabase
    .from("wa_chatbot_rules")
    .select("*")
    .eq("user_id", adminUserId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (!rules || rules.length === 0) return false;

  const lower = inboundText.toLowerCase().trim();
  const words = lower.split(/\s+/);

  for (const rule of rules) {
    const kws = (rule.keywords || []).map((k: string) => k.toLowerCase().trim()).filter(Boolean);
    if (kws.length === 0) continue;

    let matchedKeyword: string | null = null;
    const mode = rule.match_mode || "any";

    if (mode === "exact") {
      const hit = kws.find((k: string) => k === lower);
      if (hit) matchedKeyword = hit;
    } else if (mode === "starts_with") {
      const hit = kws.find((k: string) => lower.startsWith(k));
      if (hit) matchedKeyword = hit;
    } else {
      // "any" — whole-word match against any keyword
      const hit = kws.find((k: string) => words.includes(k));
      if (hit) matchedKeyword = hit;
    }

    if (!matchedKeyword) continue;

    // Send the reply via the appropriate Meta API payload
    const toNum = phoneFromWaId.replace(/^\+/, "");
    const apiUrl = `https://graph.facebook.com/v20.0/${settings.phone_number_id}/messages`;
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: toNum,
    };

    if (rule.reply_type === "buttons" && Array.isArray(rule.buttons) && rule.buttons.length > 0) {
      body.type = "interactive";
      body.interactive = {
        type: "button",
        body: { text: rule.reply_text || "Please choose an option:" },
        action: {
          buttons: (rule.buttons as any[]).slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id || b.title, title: b.title },
          })),
        },
      };
    } else if (rule.reply_type === "list" && Array.isArray(rule.list_options) && rule.list_options.length > 0) {
      body.type = "interactive";
      body.interactive = {
        type: "list",
        header: { type: "text", text: rule.list_title || "Options" },
        body: { text: rule.reply_text || "Please choose an option:" },
        action: {
          button: "Options",
          sections: [
            {
              title: "Choose",
              rows: (rule.list_options as any[]).slice(0, 10).map((o) => ({
                id: o.id || o.title,
                title: o.title,
                description: o.description || "",
              })),
            },
          ],
        },
      };
    } else {
      body.type = "text";
      body.text = { body: rule.reply_text || "" };
    }

    try {
      await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings.access_token}` },
        body: JSON.stringify(body),
      });
    } catch { /* best effort */ }

    // Record the outbound chatbot message in the conversation
    try {
      await supabase.from("wa_messages").insert({
        conversation_id: conversation.id,
        sender: "admin",
        message_type: rule.reply_type === "text" ? "text" : "interactive",
        text_content: rule.reply_text || "",
      });
    } catch { /* best effort */ }

    // Increment hit count
    try {
      await supabase.from("wa_chatbot_rules")
        .update({ hit_count: (rule.hit_count || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", rule.id);
    } catch { /* best effort */ }

    // Log the hit
    try {
      await supabase.from("wa_chatbot_logs").insert({
        user_id: adminUserId,
        rule_id: rule.id,
        conversation_id: conversation.id,
        trigger_message: inboundText.slice(0, 500),
        matched_keyword: matchedKeyword,
        reply_type: rule.reply_type,
      });
    } catch { /* best effort */ }

    return true;
  }

  return false;
}


