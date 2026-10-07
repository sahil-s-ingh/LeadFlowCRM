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

    const { data: settings } = await adminSupabase
      .from("telegram_settings")
      .select("bot_token")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!settings || !settings.bot_token) {
      return new Response(
        JSON.stringify({ error: "Telegram bot not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const fileId = url.searchParams.get("file_id");
    const messageId = url.searchParams.get("message_id");

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "Missing file_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If message_id is provided, verify ownership of the conversation
    if (messageId) {
      const { data: msg } = await adminSupabase
        .from("chat_messages")
        .select("conversation_id")
        .eq("id", messageId)
        .maybeSingle();

      if (msg) {
        const { data: conv } = await adminSupabase
          .from("chat_conversations")
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

    // Get file info from Telegram
    const fileInfoUrl = `https://api.telegram.org/bot${settings.bot_token}/getFile?file_id=${encodeURIComponent(fileId)}`;
    const fileInfoResponse = await fetch(fileInfoUrl);
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      return new Response(
        JSON.stringify({ error: `Telegram API error: ${fileInfo.description || "Unknown"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const filePath = fileInfo.result.file_path;
    const fileDownloadUrl = `https://api.telegram.org/file/bot${settings.bot_token}/${filePath}`;

    // Fetch the actual file
    const fileResponse = await fetch(fileDownloadUrl);
    if (!fileResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await fileResponse.arrayBuffer();

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
