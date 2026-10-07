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
    // multi-number: default to first (oldest) settings row
    const { data: settings } = await adminSupabase
      .from("whatsapp_settings")
      .select("phone_number_id, access_token")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.access_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const mediaId = url.searchParams.get("media_id");
    const messageId = url.searchParams.get("message_id");

    if (!mediaId) {
      return new Response(
        JSON.stringify({ error: "Missing media_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If message_id provided, verify ownership
    if (messageId) {
      const { data: msg } = await adminSupabase
        .from("wa_messages")
        .select("conversation_id")
        .eq("id", messageId)
        .maybeSingle();

      if (msg) {
        const { data: conv } = await adminSupabase
          .from("wa_conversations")
          .select("user_id")
          .eq("id", msg.conversation_id)
          .maybeSingle();

        if (!conv || conv.user_id !== userData.user.id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Step 1: Get media URL from Meta
    const mediaInfoUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
    const mediaInfoRes = await fetch(mediaInfoUrl, {
      headers: { Authorization: `Bearer ${settings.access_token}` },
    });

    const mediaInfo = await mediaInfoRes.json();
    if (!mediaInfo.url) {
      return new Response(
        JSON.stringify({ error: "Failed to get media URL from WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: Download the actual file (requires auth header)
    const fileRes = await fetch(mediaInfo.url, {
      headers: { Authorization: `Bearer ${settings.access_token}` },
    });

    if (!fileRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await fileRes.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
