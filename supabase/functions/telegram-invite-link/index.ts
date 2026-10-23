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
    const { leadId, chatId, action } = body;

    // ---- GET: list invite links for a lead ----
    if (action === "list" && leadId) {
      const { data: links, error: linksError } = await adminSupabase
        .from("telegram_invite_links")
        .select("*")
        .eq("lead_id", leadId)
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (linksError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch invite links" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ links, count: links.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- POST: generate a new one-time invite link ----
    // If chatId not provided in the request, fall back to the saved default VIP channel ID
    let resolvedChatId = chatId;
    if (!resolvedChatId) {
      const { data: tgSettings } = await adminSupabase
        .from("telegram_settings")
        .select("tg_vip_channel_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      resolvedChatId = tgSettings?.tg_vip_channel_id || null;
    }

    if (!leadId || !resolvedChatId) {
      return new Response(
        JSON.stringify({ error: "Missing channel ID. Set the VIP Telegram channel ID in Settings, or provide it manually." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve bot token: prefer telegram_bots (active bot), fall back to telegram_settings
    let botToken: string | null = null;

    const { data: activeBot } = await adminSupabase
      .from("telegram_bots")
      .select("bot_token")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (activeBot?.bot_token) {
      botToken = activeBot.bot_token;
    }

    if (!botToken) {
      const { data: settings } = await adminSupabase
        .from("telegram_settings")
        .select("bot_token")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      botToken = settings?.bot_token || null;
    }

    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "Telegram bot not configured. Go to Settings to set up your Telegram bot first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create one-time invite link via Telegram Bot API
    // member_limit = 1 makes it single-use; expire_date = 24h from now
    const expireDate = Math.floor(Date.now() / 1000) + 86400; // 24h in seconds
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    const tgApiUrl = `https://api.telegram.org/bot${botToken}/createChatInviteLink`;
    const tgResponse = await fetch(tgApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: resolvedChatId,
        member_limit: 1,
        expire_date: expireDate,
      }),
    });

    const tgData = await tgResponse.json();
    if (!tgData.ok) {
      return new Response(
        JSON.stringify({ error: `Telegram API error: ${tgData.description || "Unknown error"}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const inviteLink = tgData.result.invite_link;

    // Save the invite link record — store the raw invite link string for join matching
    const { data: record, error: insertError } = await adminSupabase
      .from("telegram_invite_links")
      .insert({
        lead_id: leadId,
        user_id: userData.user.id,
        invite_link: inviteLink,
        tg_invite_link: inviteLink,
        chat_id: String(resolvedChatId),
        expires_at: expiresAt,
        member_limit: 1,
        status: "active",
        join_status: "pending",
      })
      .select("*")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to save invite link record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get total generation count for this lead
    const { count } = await adminSupabase
      .from("telegram_invite_links")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("user_id", userData.user.id);

    return new Response(
      JSON.stringify({
        success: true,
        inviteLink,
        record,
        generationCount: count || 1,
        expiresAt,
      }),
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
