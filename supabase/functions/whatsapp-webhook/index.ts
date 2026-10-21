import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.15";
// multi-number support: conversations tagged with wa_settings_id
// opt-out keyword detection: STOP, UNSUBSCRIBE, etc. → wa_opt_outs table
// group webhook handling: lifecycle, settings, participants, status, inbound group messages
// flow webhook handling: nfm/nfm_reply messages from Flow submissions

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
              if (errs) {
                upd.delivery_status = "failed";
                upd.error_message = errs.error_data?.details || errs.message || `Delivery failed (code: ${errs.code || "unknown"})`;
              }
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

        // ─── Handle payment status callbacks ──────────────────────────
        // Meta sends these when a customer pays (or the payment fails) for an
        // order_details message we sent. The payload arrives under value.payments.
        if (Array.isArray(value.payments) && value.payments.length > 0) {
          for (const pay of value.payments) {
            const refId = pay.reference_id;
            const payStatus = (pay.status || "").toLowerCase();
            if (!refId || !payStatus) continue;

            const orderUpd: Record<string, unknown> = {
              status: payStatus === "captured" ? "captured" : payStatus === "failed" ? "failed" : payStatus,
              updated_at: new Date().toISOString(),
            };
            if (payStatus === "captured") {
              orderUpd.paid_at = new Date().toISOString();
              if (pay.transaction?.id) orderUpd.gateway_transaction_id = pay.transaction.id;
            }

            try {
              await supabase.from("wa_payment_orders").update(orderUpd).eq("reference_id", refId);
            } catch { /* best effort */ }

            // Send a payment confirmation message to the customer
            if (payStatus === "captured" && settings?.phone_number_id && settings?.access_token) {
              const custPhone = pay.from ? `+${pay.from}` : "";
              if (custPhone) {
                try {
                  await sendWhatsAppMessage(
                    settings.phone_number_id,
                    settings.access_token,
                    custPhone,
                    "Payment received. Thank you!",
                  );
                } catch { /* best effort */ }
              }
            }
          }
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

        // ─── Handle group lifecycle / settings / participants webhooks ───
        // These come as change.field === "group_lifecycle_update" etc.
        if (change.field === "group_lifecycle_update" || change.field === "group_settings_update" ||
            change.field === "group_participants_update" || change.field === "group_status_update") {
          try {
            const gv = value;
            const groupId = gv.group_id || gv.id;
            if (groupId) {
              const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
              if (gv.invite_link) upd.invite_link = gv.invite_link;
              if (gv.subject) upd.subject = gv.subject;
              if (gv.description !== undefined) upd.description = gv.description;
              if (gv.total_participant_count !== undefined) upd.participant_count = gv.total_participant_count;
              if (change.field === "group_status_update") {
                if (gv.suspended === "true" || gv.suspended === true) upd.status = "suspended";
                else upd.status = "active";
              }
              await supabase.from("wa_groups").update(upd).eq("wa_group_id", groupId);
            }
          } catch { /* best effort */ }
          continue;
        }

        // ─── Handle inbound group messages ──────────────────────────
        // Group messages have msg.context.group_id or the conversation is a group
        for (const msg of value.messages || []) {
          const groupId = msg.context?.group_id || msg.group_id;
          if (!groupId) continue;

          const { data: localGroup } = await supabase
            .from("wa_groups")
            .select("id, user_id")
            .eq("wa_group_id", groupId)
            .maybeSingle();

          if (!localGroup) continue;

          const senderWaId = msg.from || "";
          const contactInfo = (value.contacts || []).find((c: any) => c.wa_id === senderWaId);
          const senderName = contactInfo?.profile?.name || contactInfo?.name || senderWaId;

          await supabase.from("wa_group_messages").insert({
            group_id: localGroup.id,
            user_id: localGroup.user_id,
            sender: "client",
            sender_wa_id: senderWaId || null,
            sender_name: senderName || null,
            message_type: getMessageType(msg),
            text_content: getTextContent(msg),
            media_id: getMediaId(msg),
            mime_type: getMimeType(msg),
            file_name: getFileName(msg),
            wa_message_id: msg.id || null,
          });
        }

        // ─── Handle WhatsApp Flow submissions (nfm) ───────────────
        // When a user completes a Flow, Meta sends a message with type "nfm"
        // containing the submitted data in nfm.response_json
        for (const msg of value.messages || []) {
          if (msg.type !== "nfm" && msg.type !== "nfm_reply") continue;

          const senderWaId = msg.from || "";
          const phoneFromWaIdNfm = senderWaId ? `+${senderWaId}` : "";
          let submittedData: Record<string, unknown> = {};
          let flowToken: string | null = null;

          try {
            const rawResponse = msg.nfm?.response_json || msg.nfm_reply?.response_json;
            if (typeof rawResponse === "string") {
              const parsed = JSON.parse(rawResponse);
              submittedData = parsed.data || parsed;
              flowToken = parsed.flow_token || null;
            } else if (rawResponse) {
              submittedData = rawResponse.data || rawResponse;
              flowToken = rawResponse.flow_token || null;
            }
          } catch { /* best effort parse */ }

          // Try to find a local flow matching this flow_token or by settings
          let localFlowId: string | null = null;
          const { data: flowRow } = await supabase
            .from("wa_flows")
            .select("id")
            .eq("wa_settings_id", settings.id)
            .limit(1)
            .maybeSingle();
          if (flowRow) localFlowId = flowRow.id;

          // Insert the submission
          if (localFlowId) {
            await supabase.from("wa_flow_submissions").insert({
              flow_id: localFlowId,
              user_id: settings.user_id,
              wa_phone_number: phoneFromWaIdNfm || null,
              wa_wa_id: senderWaId || null,
              submitted_data: submittedData,
              raw_payload: { msg, flow_token: flowToken },
              wa_message_id: msg.id || null,
            });
          }
        }

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

          // ─── Opt-out keyword detection ───────────────────────────────
          // If the incoming message text matches an opt-out keyword, flag the
          // sender as opted-out so they are excluded from future broadcasts.
          if (msg.type === "text") {
            const inboundText = (msg.text?.body || "").toLowerCase().trim();
            const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "opt out", "optout", "cancel", "quit", "end", "stop all", "remove"];
            const matchedKeyword = OPT_OUT_KEYWORDS.find((kw) => inboundText === kw || inboundText.startsWith(kw + " ") || inboundText === kw.replace(" ", ""));
            if (matchedKeyword) {
              try {
                const normalizedPhone = waId || "";
                if (normalizedPhone) {
                  // Try to find a matching lead
                  const { data: lead } = await supabase
                    .from("submissions")
                    .select("id")
                    .eq("mobile_number", `+${normalizedPhone}`)
                    .maybeSingle();
                  // Upsert opt-out record: if one exists, update status to opted_out; else insert
                  const { data: existing } = await supabase
                    .from("wa_opt_outs")
                    .select("id, status")
                    .eq("user_id", adminUserId)
                    .eq("phone_number", normalizedPhone)
                    .maybeSingle();
                  if (existing) {
                    await supabase
                      .from("wa_opt_outs")
                      .update({ status: "opted_out", reason: matchedKeyword, opted_out_at: new Date().toISOString(), opted_in_at: null, lead_id: lead?.id || existing.lead_id, updated_at: new Date().toISOString() })
                      .eq("id", existing.id);
                  } else {
                    await supabase
                      .from("wa_opt_outs")
                      .insert({ user_id: adminUserId, phone_number: normalizedPhone, lead_id: lead?.id || null, reason: matchedKeyword, status: "opted_out", opted_out_at: new Date().toISOString() });
                  }
                  // Send confirmation
                  await sendWhatsAppMessage(settings.phone_number_id, settings.access_token, phoneFromWaId, "You've been unsubscribed from our broadcasts. You will no longer receive broadcast messages. Reply START to re-subscribe.");
                }
              } catch { /* best effort */ }
            } else {
              const RESUB_KEYWORDS = ["start", "subscribe", "opt in", "optin"];
              const matchedResub = RESUB_KEYWORDS.find((kw) => inboundText === kw);
              if (matchedResub) {
                try {
                  const normalizedPhone = waId || "";
                  if (normalizedPhone) {
                    await supabase
                      .from("wa_opt_outs")
                      .update({ status: "subscribed", opted_in_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                      .eq("user_id", adminUserId)
                      .eq("phone_number", normalizedPhone)
                      .eq("status", "opted_out");
                    await sendWhatsAppMessage(settings.phone_number_id, settings.access_token, phoneFromWaId, "You've been re-subscribed to our broadcasts. Welcome back!");
                  }
                } catch { /* best effort */ }
              }
            }
          }

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

          // ─── AI Auto-Reply ──────────────────────────────────────
          if (msg.type === "text" && msg.text?.body) {
            try {
              const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
                body: JSON.stringify({ user_id: adminUserId, platform: "whatsapp", conversation_id: conversation.id, incoming_text: msg.text.body }),
              });
              if (aiRes.ok) {
                const aiData = await aiRes.json();
                if (aiData.reply && !aiData.skipped) {
                  await sendWhatsAppMessage(settings.phone_number_id, settings.access_token, phoneFromWaId, aiData.reply);
                  await supabase.from("wa_messages").insert({ conversation_id: conversation.id, sender: "agent", message_type: "text", text_content: aiData.reply });
                } else if (aiData.fallback) {
                  await sendWhatsAppMessage(settings.phone_number_id, settings.access_token, phoneFromWaId, aiData.fallback);
                  await supabase.from("wa_messages").insert({ conversation_id: conversation.id, sender: "agent", message_type: "text", text_content: aiData.fallback });
                }
              }
            } catch { /* AI reply is best-effort */ }
          }

          // Send welcome message if this is a new conversation and it's a text "hi"/"hello"
          if (settings.welcome_message && msg.type === "text") {
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



