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
    const body = await req.json();
    const { action, conversationId, text, igUserId, pageId, pageAccessToken, connectedUsername, welcomeMessage } = body;

    // ─── Save settings action ─────────────────────────────────
    if (action === "save_settings") {
      if (!igUserId || !pageId || !pageAccessToken) {
        return new Response(
          JSON.stringify({ error: "Instagram User ID, Page ID, and Page Access Token are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: existing } = await adminSupabase
        .from("instagram_settings")
        .select("id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      let result;
      if (existing) {
        result = await adminSupabase
          .from("instagram_settings")
          .update({
            ig_user_id: igUserId,
            page_id: pageId,
            page_access_token: pageAccessToken,
            connected_username: connectedUsername || null,
            welcome_message: welcomeMessage || undefined,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();
      } else {
        result = await adminSupabase
          .from("instagram_settings")
          .insert({
            user_id: userData.user.id,
            ig_user_id: igUserId,
            page_id: pageId,
            page_access_token: pageAccessToken,
            connected_username: connectedUsername || null,
            welcome_message: welcomeMessage || undefined,
          })
          .select()
          .single();
      }

      if (result.error) {
        return new Response(
          JSON.stringify({ error: result.error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, settings: result.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Get settings action ──────────────────────────────────
    if (action === "get_settings") {
      const { data, error } = await adminSupabase
        .from("instagram_settings")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Don't expose the full access token to the client
      const safe = data ? {
        ...data,
        page_access_token: data.page_access_token ? "***configured***" : null,
      } : null;

      return new Response(
        JSON.stringify({ settings: safe }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Disconnect action ────────────────────────────────────
    if (action === "disconnect") {
      await adminSupabase
        .from("instagram_settings")
        .delete()
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Send message action ──────────────────────────────────
    if (action === "send_message") {
      if (!conversationId || !text) {
        return new Response(
          JSON.stringify({ error: "conversationId and text are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: conversation, error: convErr } = await adminSupabase
        .from("ig_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (convErr || !conversation) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: settings } = await adminSupabase
        .from("instagram_settings")
        .select("*")
        .eq("id", conversation.ig_settings_id)
        .maybeSingle();

      if (!settings || !settings.page_access_token) {
        return new Response(
          JSON.stringify({ error: "Instagram is not configured. Go to Settings to set it up." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const recipientId = conversation.ig_sender_id;
      const apiUrl = `https://graph.facebook.com/v21.0/${settings.ig_user_id}/messages`;

      const sendRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.page_access_token}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
          messaging_type: "RESPONSE",
        }),
      });

      const sendData = await sendRes.json();
      if (sendData.error) {
        const errMsg = sendData.error.error_data?.details || sendData.error.message || "Unknown error";
        return new Response(
          JSON.stringify({ error: `Instagram API error: ${errMsg}`, metaErrorRaw: sendData.error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const igMessageId = sendData.message_id;
      const { data: message } = await adminSupabase
        .from("ig_messages")
        .insert({
          conversation_id: conversationId,
          user_id: userData.user.id,
          sender: "admin",
          message_type: "text",
          text_content: text,
          ig_message_id: igMessageId || null,
          delivery_status: "sent",
        })
        .select()
        .single();

      await adminSupabase
        .from("ig_conversations")
        .update({
          last_message_text: text,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      return new Response(
        JSON.stringify({ success: true, message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
