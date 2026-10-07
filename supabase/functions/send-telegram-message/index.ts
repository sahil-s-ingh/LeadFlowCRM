import { createClient } from "npm:@supabase/supabase-js@2.45.4";

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

    const { data: settings, error: settingsError } = await adminSupabase
      .from("telegram_settings")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (settingsError || !settings || !settings.bot_token) {
      return new Response(
        JSON.stringify({ error: "Telegram bot not configured. Go to Settings to set it up." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentType = req.headers.get("Content-Type") || "";

    // ---- Multipart: media upload (photo/video/audio/document) ----
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
        .from("chat_conversations")
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

      const botToken = settings.bot_token;
      const chatId = conversation.telegram_chat_id;
      const mimeType = file.type || "";
      const fileSize = file.size;

      let messageType: string = "document";
      let tgApiMethod = "sendDocument";
      let fileField = "document";

      if (isVoice) {
        // Telegram sendVoice requires OGG/Opus. Browser recordings are often webm,
        // so use sendAudio for non-ogg files (still delivered as playable audio).
        if (mimeType.includes("ogg") || (file.name && file.name.endsWith(".ogg"))) {
          messageType = "voice";
          tgApiMethod = "sendVoice";
          fileField = "voice";
        } else {
          messageType = "audio";
          tgApiMethod = "sendAudio";
          fileField = "audio";
        }
      } else if (mimeType.startsWith("image/")) {
        messageType = "photo";
        tgApiMethod = "sendPhoto";
        fileField = "photo";
      } else if (mimeType.startsWith("video/")) {
        messageType = "video";
        tgApiMethod = "sendVideo";
        fileField = "video";
      } else if (mimeType.startsWith("audio/")) {
        messageType = "audio";
        tgApiMethod = "sendAudio";
        fileField = "audio";
      }

      // Build multipart form for Telegram API
      const tgForm = new FormData();
      tgForm.append(fileField, file, file.name || `upload.${mimeType.split("/")[1] || "bin"}`);
      tgForm.append("chat_id", String(chatId));
      if (caption) tgForm.append("caption", caption);

      const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/${tgApiMethod}`, {
        method: "POST",
        body: tgForm,
      });

      const tgData = await tgResponse.json();
      if (!tgData.ok) {
        return new Response(
          JSON.stringify({ error: `Telegram API error: ${tgData.description || "Unknown"}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Extract file metadata from Telegram response
      const result = tgData.result;
      let fileId: string | null = null;
      let fileUniqueId: string | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let duration: number | null = null;

      if (result.photo) {
        const largest = result.photo[result.photo.length - 1];
        fileId = largest.file_id;
        fileUniqueId = largest.file_unique_id;
        width = largest.width;
        height = largest.height;
      } else if (result.video) {
        fileId = result.video.file_id;
        fileUniqueId = result.video.file_unique_id;
        width = result.video.width;
        height = result.video.height;
        duration = result.video.duration;
      } else if (result.voice) {
        fileId = result.voice.file_id;
        fileUniqueId = result.voice.file_unique_id;
        duration = result.voice.duration;
      } else if (result.audio) {
        fileId = result.audio.file_id;
        fileUniqueId = result.audio.file_unique_id;
        duration = result.audio.duration;
      } else if (result.document) {
        fileId = result.document.file_id;
        fileUniqueId = result.document.file_unique_id;
      }

      // Save message in database
      const { data: message, error: msgError } = await adminSupabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          sender: "admin",
          message_type: messageType,
          text_content: caption || null,
          file_id: fileId,
          file_unique_id: fileUniqueId,
          mime_type: mimeType,
          file_size: fileSize,
          file_name: file.name,
          media_width: width,
          media_height: height,
          media_duration: duration,
        })
        .select()
        .single();

      if (msgError) {
        return new Response(
          JSON.stringify({ error: "Failed to save message" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const preview = caption
        ? caption.slice(0, 100)
        : `[${messageType}]`;
      await adminSupabase
        .from("chat_conversations")
        .update({
          last_message_text: preview,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      return new Response(
        JSON.stringify({ success: true, message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- JSON: text message ----
    const { conversationId, text } = await req.json();

    if (!conversationId || !text) {
      return new Response(
        JSON.stringify({ error: "Missing conversationId or text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the conversation belongs to this admin
    const { data: conversation, error: convError } = await adminSupabase
      .from("chat_conversations")
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

    // Send message to Telegram
    const apiUrl = `https://api.telegram.org/bot${settings.bot_token}/sendMessage`;
    const tgResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: conversation.telegram_chat_id,
        text,
      }),
    });

    const tgData = await tgResponse.json();
    if (!tgData.ok) {
      return new Response(
        JSON.stringify({ error: `Telegram API error: ${tgData.description || "Unknown"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Save message in database
    const { data: message, error: msgError } = await adminSupabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender: "admin",
        message_type: "text",
        text_content: text,
      })
      .select()
      .single();

    if (msgError) {
      return new Response(
        JSON.stringify({ error: "Failed to save message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update conversation preview
    await adminSupabase
      .from("chat_conversations")
      .update({
        last_message_text: text.slice(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ success: true, message }),
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
