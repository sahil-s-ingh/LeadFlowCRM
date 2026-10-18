import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// multi-number support: settings resolved per-conversation via wa_settings_id
// Supports text messages, media uploads, and approved template messages

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    // NOTE: settings are now resolved per-conversation below (multi-number support)

    const contentType = req.headers.get("Content-Type") || "";

    // ---- Multipart: media upload ----
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const conversationId = formData.get("conversationId") as string;
      const caption = (formData.get("caption") as string) || "";
      const isVoice = formData.get("isVoice") === "true";
      const file = formData.get("file") as File | null;

      if (!conversationId || !file) {
        return new Response(
          JSON.stringify({ error: "Missing conversationId or file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verify conversation ownership
      const { data: conversation, error: convError } = await adminSupabase
        .from("wa_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (convError || !conversation) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Resolve WhatsApp settings from the conversation's linked number
      let settings: any = null;
      if (conversation.wa_settings_id) {
        const { data: s } = await adminSupabase
          .from("whatsapp_settings")
          .select("*")
          .eq("id", conversation.wa_settings_id)
          .maybeSingle();
        settings = s;
      }
      if (!settings) {
        const { data: s } = await adminSupabase
          .from("whatsapp_settings")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        settings = s;
      }
      if (!settings || !settings.phone_number_id || !settings.access_token) {
        return new Response(
          JSON.stringify({ error: "WhatsApp is not configured. Go to Settings to set it up." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const to = conversation.wa_phone_number.replace(/^\+/, "");
      const phoneNumberId = settings.phone_number_id;
      const accessToken = settings.access_token;
      const mimeType = file.type || "";
      const fileSize = file.size;

      // Step 1: Upload media to WhatsApp
      const uploadForm = new FormData();
      uploadForm.append("messaging_product", "whatsapp");
      uploadForm.append("type", mimeType || "application/octet-stream");
      uploadForm.append("file", file, file.name || "upload");

      const uploadRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: uploadForm,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.id) {
        return new Response(
          JSON.stringify({
            error: `WhatsApp media upload failed: ${uploadData.error?.message || "Unknown"}`,
            errorStep: "meta_media_upload",
            metaErrorRaw: uploadData.error || uploadData,
            debug: { mimeType, fileName: file.name, fileSize, phoneNumberId },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const mediaId = uploadData.id;

      // Step 2: Send media message
      let messageType = "document";
      let typeKey = "document";
      let payload: Record<string, unknown> = { id: mediaId };
      if (caption) payload.caption = caption;

      if (isVoice || mimeType.startsWith("audio/")) {
        messageType = mimeType.includes("ogg") ? "voice" : "audio";
        typeKey = mimeType.includes("ogg") ? "voice" : "audio";
        payload = { id: mediaId };
      } else if (mimeType.startsWith("image/")) {
        messageType = "image";
        typeKey = "image";
        payload = { id: mediaId, caption: caption || undefined };
      } else if (mimeType.startsWith("video/")) {
        messageType = "video";
        typeKey = "video";
        payload = { id: mediaId, caption: caption || undefined };
      } else {
        payload = { id: mediaId, caption: caption || undefined, filename: file.name || undefined };
      }

      const sendBody: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to,
        type: typeKey,
        [typeKey]: payload,
      };

      const sendRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(sendBody),
      });

      const sendData = await sendRes.json();
      if (sendData.error) {
        const errMsg = sendData.error.error_data?.details || sendData.error.message || "Unknown";
        const errCode = sendData.error.code;
        const friendlyMsg = errCode === 131037
          ? "Your WhatsApp Business number's display name has not been approved by Meta yet. Until approval is granted, you cannot send outgoing messages. Please visit Meta Business Manager to submit or check the status of your display name approval."
          : `WhatsApp API error: ${errMsg}`;
        return new Response(
          JSON.stringify({
            error: friendlyMsg,
            errorStep: "meta_send_media",
            metaErrorRaw: sendData.error,
            metaCode: errCode,
            debug: { typeKey, mimeType, to, sendBody },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Save message in database
      const { data: message, error: msgError } = await adminSupabase
        .from("wa_messages")
        .insert({
          conversation_id: conversationId,
          sender: "admin",
          message_type: messageType,
          text_content: caption || null,
          media_id: mediaId,
          mime_type: mimeType,
          file_size: fileSize,
          file_name: file.name,
        })
        .select()
        .single();

      if (msgError) {
        return new Response(
          JSON.stringify({
            error: `Failed to save message: ${msgError.message || "Unknown DB error"}`,
            errorStep: "db_insert_media",
            dbError: {
              message: msgError.message,
              details: msgError.details,
              hint: msgError.hint,
              code: msgError.code,
            },
            debug: { conversationId, messageType, mimeType, mediaId },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      await adminSupabase
        .from("wa_conversations")
        .update({ last_message_text: preview, last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      return new Response(
        JSON.stringify({ success: true, message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- JSON: text or template message ----
    const body = await req.json();
    const { conversationId, text, templateName, templateLanguage, templateComponents } = body;

    if (!conversationId || (!text && !templateName)) {
      return new Response(
        JSON.stringify({ error: "Missing conversationId or text/template" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify conversation ownership
    const { data: conversation, error: convError } = await adminSupabase
      .from("wa_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve WhatsApp settings from the conversation's linked number
    let settings: any = null;
    if (conversation.wa_settings_id) {
      const { data: s } = await adminSupabase
        .from("whatsapp_settings")
        .select("*")
        .eq("id", conversation.wa_settings_id)
        .maybeSingle();
      settings = s;
    }
    if (!settings) {
      const { data: s } = await adminSupabase
        .from("whatsapp_settings")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      settings = s;
    }
    if (!settings || !settings.phone_number_id || !settings.access_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp is not configured. Go to Settings to set it up." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const to = conversation.wa_phone_number.replace(/^\+/, "");

    // ---- Template message path ----
    if (templateName) {
      // Verify the template is approved in the local cache
      const { data: tpl } = await adminSupabase
        .from("wa_message_templates")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("name", templateName)
        .eq("status", "APPROVED")
        .maybeSingle();

      if (!tpl) {
        return new Response(
          JSON.stringify({
            error: "Template not found or not approved. Only approved templates can be sent.",
            errorStep: "template_lookup",
            debug: { templateName, userId: userData.user.id },
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Transform definition components into send-API format
      const rawComponents = templateComponents || tpl.components || [];
      const sendComponents = Array.isArray(rawComponents)
        ? rawComponents
            .map((c: Record<string, unknown>) => {
              const typeStr = typeof c.type === "string" ? (c.type as string).toLowerCase() : "";
              const params = c.parameters as Array<{ type: string; text: string }> | undefined;
              if (params && Array.isArray(params)) {
                return { type: typeStr, parameters: params };
              }
              return null;
            })
            .filter((c: Record<string, unknown> | null) => c !== null)
        : [];

      const templatePayload: Record<string, unknown> = {
        name: templateName,
        language: { code: templateLanguage || tpl.language || "en_US" },
      };
      if (sendComponents.length > 0) {
        templatePayload.components = sendComponents;
      }

      const tplSendBody: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: templatePayload,
      };

      const tplResponse = await fetch(`https://graph.facebook.com/v20.0/${settings.phone_number_id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`,
        },
        body: JSON.stringify(tplSendBody),
      });

      const tplData = await tplResponse.json();
      if (tplData.error) {
        const errMsg = tplData.error.error_data?.details || tplData.error.message || "Unknown";
        const errCode = tplData.error.code;
        const errType = tplData.error.type || "";
        const isAuthError =
          errCode === 190 ||
          errCode === 200 ||
          errCode === 401 ||
          /authentic|access token|oauth|invalid credential|session|permission/i.test(errMsg + " " + errType);
        const friendlyMsg = isAuthError
          ? `Your WhatsApp Business access token is invalid or expired (Meta error: ${errMsg}). Please go to WhatsApp Settings and reconnect your number — re-enter your Phone Number ID and a valid access token from Meta Business Manager.`
          : `WhatsApp API error: ${errMsg}`;
        return new Response(
          JSON.stringify({
            error: friendlyMsg,
            errorType: isAuthError ? "auth" : "api",
            errorStep: "meta_send_template",
            metaError: errMsg,
            metaCode: errCode,
            metaErrorRaw: tplData.error,
            debug: { templateName, templateLanguage: templateLanguage || tpl.language, to, sendBody: tplSendBody },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Build a preview text from the template body component
      let previewText = `[Template: ${templateName}]`;
      const bodyComp = (tpl.components || []).find((c: Record<string, unknown>) => c.type === "BODY");
      if (bodyComp?.text) {
        let bodyText = bodyComp.text as string;
        // Substitute variables for preview
        const params = sendComponents.find((c: Record<string, unknown>) => c.type === "body")?.parameters as Array<{ text: string }> | undefined;
        if (params) {
          params.forEach((p, i) => {
            bodyText = bodyText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), p.text);
          });
        }
        previewText = bodyText.slice(0, 100);
      }

      const tplWaMessageId = tplData.messages?.[0]?.id || null;
      const { data: tplMessage, error: tplMsgError } = await adminSupabase
        .from("wa_messages")
        .insert({
          conversation_id: conversationId,
          sender: "admin",
          message_type: "template",
          text_content: previewText,
          wa_message_id: tplWaMessageId,
          delivery_status: tplWaMessageId ? 'sent' : null,
        })
        .select()
        .single();

      if (tplMsgError) {
        return new Response(
          JSON.stringify({
            error: `Failed to save message: ${tplMsgError.message || "Unknown DB error"}`,
            errorStep: "db_insert_template",
            dbError: {
              message: tplMsgError.message,
              details: tplMsgError.details,
              hint: tplMsgError.hint,
              code: tplMsgError.code,
            },
            debug: { conversationId, messageType: "template", waMessageId: tplWaMessageId },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase
        .from("wa_conversations")
        .update({ last_message_text: previewText, last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      return new Response(
        JSON.stringify({ success: true, message: tplMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Regular text message path ----
    const apiUrl = `https://graph.facebook.com/v20.0/${settings.phone_number_id}/messages`;
    const waResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });

    const waData = await waResponse.json();
    if (waData.error) {
      const errMsg = waData.error.error_data?.details || waData.error.message || "Unknown";
      const errCode = waData.error.code;
      const errType = waData.error.type || "";
      const isAuthError =
        errCode === 190 ||
        errCode === 200 ||
        errCode === 401 ||
        /authentic|access token|oauth|invalid credential|session|permission/i.test(errMsg + " " + errType);
      const friendlyMsg = isAuthError
        ? `Your WhatsApp Business access token is invalid or expired (Meta error: ${errMsg}). Please go to WhatsApp Settings and reconnect your number — re-enter your Phone Number ID and a valid access token from Meta Business Manager.`
        : errCode === 131037
          ? "Your WhatsApp Business number's display name has not been approved by Meta yet. Until approval is granted, you cannot send outgoing messages. Please visit Meta Business Manager to submit or check the status of your display name approval."
          : `WhatsApp API error: ${errMsg}`;
      return new Response(
        JSON.stringify({
          error: friendlyMsg,
          errorType: isAuthError ? "auth" : "api",
          errorStep: "meta_send_text",
          metaError: errMsg,
          metaCode: errCode,
          metaErrorRaw: waData.error,
          debug: { to, text: (text || "").slice(0, 200) },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Save message in database
    const waMessageId = waData.messages?.[0]?.id || null;
    const { data: message, error: msgError } = await adminSupabase
      .from("wa_messages")
      .insert({
        conversation_id: conversationId,
        sender: "admin",
        message_type: "text",
        text_content: text,
        wa_message_id: waMessageId,
        delivery_status: waMessageId ? 'sent' : null,
      })
      .select()
      .single();

    if (msgError) {
      return new Response(
        JSON.stringify({
          error: `Failed to save message: ${msgError.message || "Unknown DB error"}`,
          errorStep: "db_insert_text",
          dbError: {
            message: msgError.message,
            details: msgError.details,
            hint: msgError.hint,
            code: msgError.code,
          },
          debug: { conversationId, messageType: "text", waMessageId },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await adminSupabase
      .from("wa_conversations")
      .update({ last_message_text: text.slice(0, 100), last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ success: true, message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, errorStep: "unexpected_exception", debug: { stack: err instanceof Error ? err.stack : undefined } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
