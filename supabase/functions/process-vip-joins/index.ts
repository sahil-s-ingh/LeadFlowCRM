import { createClient } from "npm:@supabase/supabase-js@2.45.4";

/*
 * VIP Join Tracker — polls active Telegram invite links and checks if they've
 * been consumed (member_limit=1 means once someone joins, the link is "used").
 * Also marks expired links. This is the fallback for when the real-time
 * chat_member webhook update is missed.
 */

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Mark expired links (pending links past their expiry date)
    const nowIso = new Date().toISOString();
    await supabase
      .from("telegram_invite_links")
      .update({ join_status: "expired" })
      .eq("join_status", "pending")
      .lt("expires_at", nowIso);

    // 2. Poll pending (non-expired) links via Telegram API
    const { data: pendingLinks } = await supabase
      .from("telegram_invite_links")
      .select("id, lead_id, user_id, chat_id, tg_invite_link, invite_link")
      .eq("join_status", "pending")
      .gt("expires_at", nowIso)
      .limit(50);

    if (!pendingLinks || pendingLinks.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, checked: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Group by user_id to resolve bot tokens efficiently
    const userIds = [...new Set(pendingLinks.map((l) => l.user_id))];
    const botTokenMap = new Map<string, string>();

    for (const userId of userIds) {
      const { data: activeBot } = await supabase
        .from("telegram_bots")
        .select("bot_token")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (activeBot?.bot_token) {
        botTokenMap.set(userId, activeBot.bot_token);
        continue;
      }

      const { data: settings } = await supabase
        .from("telegram_settings")
        .select("bot_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (settings?.bot_token) {
        botTokenMap.set(userId, settings.bot_token);
      }
    }

    let checked = 0;
    let joined = 0;

    for (const link of pendingLinks) {
      checked++;
      const botToken = botTokenMap.get(link.user_id);
      if (!botToken) continue;

      try {
        // Use getChatMember to check if anyone is in the chat for this link's chat_id
        // Since member_limit=1 links are single-use, we check if the link is still
        // revocable/active via getChatInviteLink
        const linkToCheck = link.tg_invite_link || link.invite_link;
        const apiUrl = `https://api.telegram.org/bot${botToken}/getChatInviteLink`;

        const tgRes = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_link: linkToCheck }),
        });

        const tgData = await tgRes.json();

        if (tgData.ok && tgData.result) {
          const linkInfo = tgData.result;
          // If member_limit is set and the link was consumed (member_count >= member_limit),
          // or the link is revoked/used
          if (linkInfo.is_revoked || (linkInfo.member_limit && linkInfo.member_limit > 0)) {
            // Check if the link has been used — Telegram doesn't directly expose "used count"
            // but a revoked single-use link means someone joined
            if (linkInfo.is_revoked) {
              await supabase
                .from("telegram_invite_links")
                .update({
                  join_status: "joined",
                  joined_at: new Date().toISOString(),
                })
                .eq("id", link.id);

              await supabase.from("lead_activities").insert({
                user_id: link.user_id,
                lead_id: link.lead_id,
                activity_type: "telegram_vip_joined",
                description: "Lead joined the Telegram VIP channel (detected via poll)",
                metadata: { detection_method: "poll", chat_id: link.chat_id },
              });

              joined++;
            }
          }
        }
      } catch {
        // Best-effort per link
      }
    }

    return new Response(
      JSON.stringify({ ok: true, checked, joined }),
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
