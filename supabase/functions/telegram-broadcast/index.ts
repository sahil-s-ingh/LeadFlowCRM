import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_DELAY_MS = 500;

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
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    // ─── LIST: fetch campaigns ──────────────────────────────────────────
    if (action === "list" && req.method === "GET") {
      const { data, error } = await adminSupabase
        .from("tg_broadcast_campaigns")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ campaigns: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET: fetch single campaign with recipients ─────────────────────
    if (action === "get" && req.method === "GET") {
      const campaignId = url.searchParams.get("campaign_id");
      if (!campaignId) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("tg_broadcast_campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: recipients } = await adminSupabase
        .from("tg_broadcast_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      return new Response(
        JSON.stringify({ campaign, recipients: recipients || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── COUNT: get recipient count (optionally filtered by bot) ─────────
    if (action === "count" && req.method === "GET") {
      const botId = url.searchParams.get("bot_id");
      let query = adminSupabase
        .from("chat_conversations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userData.user.id);

      if (botId) {
        query = query.eq("bot_id", botId);
      }

      const { count, error: countError } = await query;

      if (countError) {
        return new Response(
          JSON.stringify({ error: countError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ count: count || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE: create campaign with recipients ─────────────────────────
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const { message_text, bot_id } = body;

      if (!message_text || !message_text.trim()) {
        return new Response(
          JSON.stringify({ error: "message_text is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Fetch conversations, optionally filtered by bot
      let convQuery = adminSupabase
        .from("chat_conversations")
        .select("id, telegram_chat_id, telegram_username, telegram_first_name, bot_id")
        .eq("user_id", userData.user.id);

      if (bot_id) {
        convQuery = convQuery.eq("bot_id", bot_id);
      }

      const { data: conversations, error: convError } = await convQuery;

      if (convError) {
        return new Response(
          JSON.stringify({ error: convError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!conversations || conversations.length === 0) {
        return new Response(
          JSON.stringify({ error: "No Telegram conversations found for this bot. You need at least one person who has messaged the bot." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Determine which bot_id to attach to the campaign
      let campaignBotId: string | null = bot_id || conversations[0]?.bot_id || null;

      // If still no bot_id, try to get the user's first bot
      if (!campaignBotId) {
        const { data: firstBot } = await adminSupabase
          .from("telegram_bots")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        campaignBotId = firstBot?.id || null;
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("tg_broadcast_campaigns")
        .insert({
          user_id: userData.user.id,
          bot_id: campaignBotId,
          message_text: message_text.trim(),
          status: "draft",
          total_recipients: conversations.length,
        })
        .select()
        .single();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: campError?.message || "Failed to create campaign" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const recipientRows = conversations.map((c: { id: string; telegram_chat_id: number; telegram_username: string | null; telegram_first_name: string | null }) => ({
        campaign_id: campaign.id,
        user_id: userData.user.id,
        conversation_id: c.id,
        telegram_chat_id: c.telegram_chat_id,
        telegram_username: c.telegram_username,
        telegram_first_name: c.telegram_first_name,
        status: "pending",
      }));

      const { error: recipError } = await adminSupabase
        .from("tg_broadcast_recipients")
        .insert(recipientRows);

      if (recipError) {
        return new Response(
          JSON.stringify({ error: recipError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, campaign_id: campaign.id, recipient_count: conversations.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SEND: start sending a campaign ─────────────────────────────────
    if (action === "send" && req.method === "POST") {
      const body = await req.json();
      const { campaign_id } = body;

      if (!campaign_id) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("tg_broadcast_campaigns")
        .select("*")
        .eq("id", campaign_id)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Resolve bot token: prefer campaign's bot_id, fall back to telegram_settings
      let botToken: string | null = null;

      if (campaign.bot_id) {
        const { data: bot } = await adminSupabase
          .from("telegram_bots")
          .select("bot_token")
          .eq("id", campaign.bot_id)
          .maybeSingle();
        botToken = bot?.bot_token || null;
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
          JSON.stringify({ error: "Telegram bot is not configured. Go to Settings to set it up." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: pendingRecipients } = await adminSupabase
        .from("tg_broadcast_recipients")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (!pendingRecipients || pendingRecipients.length === 0) {
        return new Response(
          JSON.stringify({ error: "No pending recipients to send to" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase
        .from("tg_broadcast_campaigns")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);

      const messageText = campaign.message_text;

      let sentCount = campaign.sent_count || 0;
      let failedCount = campaign.failed_count || 0;

      for (const recipient of pendingRecipients) {
        try {
          const tgResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: recipient.telegram_chat_id,
                text: messageText,
              }),
            },
          );

          const tgData = await tgResponse.json();

          if (!tgData.ok) {
            const errMsg = tgData.description || "Unknown Telegram API error";
            await adminSupabase
              .from("tg_broadcast_recipients")
              .update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() })
              .eq("id", recipient.id);
            failedCount++;
          } else {
            await adminSupabase
              .from("tg_broadcast_recipients")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", recipient.id);
            sentCount++;
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          await adminSupabase
            .from("tg_broadcast_recipients")
            .update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() })
            .eq("id", recipient.id);
          failedCount++;
        }

        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }

      const finalStatus = failedCount === pendingRecipients.length ? "failed" : "completed";
      await adminSupabase
        .from("tg_broadcast_campaigns")
        .update({
          status: finalStatus,
          sent_count: sentCount,
          failed_count: failedCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({
          success: true,
          sent: sentCount - (campaign.sent_count || 0),
          failed: failedCount - (campaign.failed_count || 0),
          status: finalStatus,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DELETE: delete a campaign ───────────────────────────────────────
    if (action === "delete" && req.method === "DELETE") {
      const body = await req.json();
      const { campaign_id } = body;

      if (!campaign_id) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error } = await adminSupabase
        .from("tg_broadcast_campaigns")
        .delete()
        .eq("id", campaign_id)
        .eq("user_id", userData.user.id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
