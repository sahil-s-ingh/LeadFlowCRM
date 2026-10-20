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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);

  // GET = webhook verification (Meta subscribes with hub.verify_token)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      const { data: allSettings } = await supabase
        .from("instagram_settings")
        .select("page_id, page_access_token");

      // Accept if no settings yet (first-time setup) or any settings row exists
      if (!allSettings || allSettings.length === 0) {
        return new Response(challenge || "ok", {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      // With existing settings we accept the verify token challenge
      return new Response(challenge || "ok", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // POST = incoming Instagram message
  try {
    const body = await req.json();
    if (!body?.entry || !Array.isArray(body.entry)) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        // Instagram messaging webhooks use field "messages"
        if (change.field !== "messages") continue;
        const value = change.value;
        if (!value) continue;

        // The Instagram account that received the message
        const recipientIgId = value.metadata?.ig_user_id || entry.id;

        // Find matching settings
        let settings: any = null;
        if (recipientIgId) {
          const { data } = await supabase
            .from("instagram_settings")
            .select("*")
            .eq("ig_user_id", recipientIgId)
            .maybeSingle();
          settings = data;
        }
        if (!settings) {
          const { data: fallback } = await supabase
            .from("instagram_settings")
            .select("*")
            .limit(1)
            .maybeSingle();
          settings = fallback;
        }
        if (!settings) continue;

        // ─── Handle message status updates (sent/delivered/read) ───
        if (Array.isArray(value.statuses) && value.statuses.length > 0) {
          for (const st of value.statuses) {
            const mid = st.id;
            const stStatus = (st.status || "").toLowerCase();
            if (!mid || !stStatus) continue;
            try {
              await supabase
                .from("ig_messages")
                .update({ delivery_status: stStatus })
                .eq("ig_message_id", mid);
            } catch { /* best effort */ }
          }
          continue;
        }

        // ─── Handle incoming messages ───
        if (!value.messages || !Array.isArray(value.messages)) continue;

        for (const msg of value.messages) {
          const igMessageId = msg.id;
          if (!igMessageId) continue;

          // Dedup: skip if we already stored this message
          const { data: existing } = await supabase
            .from("ig_messages")
            .select("id")
            .eq("ig_message_id", igMessageId)
            .maybeSingle();
          if (existing) continue;

          const senderId = msg.from?.id || msg.sender?.id;
          const senderUsername = msg.from?.username || msg.sender?.username;
          const senderName = msg.from?.name || msg.sender?.name || senderUsername;

          if (!senderId) continue;

          // Find or create conversation
          let { data: conversation } = await supabase
            .from("ig_conversations")
            .select("*")
            .eq("ig_settings_id", settings.id)
            .eq("ig_sender_id", senderId)
            .maybeSingle();

          if (!conversation) {
            const { data: newConv, error: convErr } = await supabase
              .from("ig_conversations")
              .insert({
                user_id: settings.user_id,
                ig_settings_id: settings.id,
                ig_sender_id: senderId,
                sender_username: senderUsername,
                sender_name: senderName,
                unread_count: 1,
              })
              .select()
              .single();
            if (convErr || !newConv) continue;
            conversation = newConv;
          } else {
            await supabase
              .from("ig_conversations")
              .update({
                unread_count: (conversation.unread_count || 0) + 1,
                sender_username: senderUsername || conversation.sender_username,
                sender_name: senderName || conversation.sender_name,
              })
              .eq("id", conversation.id);
          }

          // Extract message content
          let textContent: string | null = null;
          let mediaUrl: string | null = null;
          let messageType = "text";

          if (msg.message) {
            if (msg.message.text) {
              textContent = msg.message.text;
              messageType = "text";
            } else if (msg.message.attachments) {
              const att = msg.message.attachments[0];
              if (att) {
                messageType = att.type || "image";
                mediaUrl = att.payload?.url || null;
                textContent = att.title || null;
              }
            } else if (msg.message.image) {
              messageType = "image";
              mediaUrl = msg.message.image.url || null;
            } else if (msg.message.video) {
              messageType = "video";
              mediaUrl = msg.message.video.url || null;
            } else if (msg.message.audio) {
              messageType = "audio";
              mediaUrl = msg.message.audio.url || null;
            }
          }

          // Insert the message
          await supabase.from("ig_messages").insert({
            conversation_id: conversation.id,
            user_id: settings.user_id,
            sender: "client",
            message_type: messageType,
            text_content: textContent,
            media_url: mediaUrl,
            ig_message_id: igMessageId,
          });

          // Update conversation preview
          await supabase
            .from("ig_conversations")
            .update({
              last_message_text: textContent || `[${messageType}]`,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversation.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
