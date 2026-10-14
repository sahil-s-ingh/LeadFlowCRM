import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_VERSION = "v21.0";

interface AdsSettings {
  app_id: string | null;
  app_secret: string | null;
  access_token: string | null;
  ad_account_id: string | null;
  is_connected: boolean;
}

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
    const userId = userData.user.id;

    const { data: settings } = await adminSupabase
      .from("meta_ads_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const adsSettings = settings as AdsSettings | null;
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ─── SAVE_SETTINGS ───────────────────────────────────────
    if (action === "save_settings") {
      const payload = {
        user_id: userId,
        app_id: body.app_id?.trim() || null,
        app_secret: body.app_secret?.trim() || null,
        access_token: body.access_token?.trim() || null,
        ad_account_id: body.ad_account_id?.trim()?.replace(/^act_/, "") || null,
        is_connected: !!(body.access_token?.trim() && body.ad_account_id?.trim()),
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await adminSupabase
        .from("meta_ads_settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const result = existing
        ? await adminSupabase.from("meta_ads_settings").update(payload).eq("id", existing.id)
        : await adminSupabase.from("meta_ads_settings").insert(payload);

      if (result.error) {
        return new Response(
          JSON.stringify({ error: result.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Settings saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── VERIFY_CONNECTION ───────────────────────────────────
    if (action === "verify_connection") {
      if (!adsSettings?.access_token || !adsSettings?.ad_account_id) {
        return new Response(
          JSON.stringify({ error: "Access token and Ad Account ID are required. Save your settings first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const verifyUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adsSettings.ad_account_id}?fields=name,account_status,currency,amount_spent,balance&access_token=${adsSettings.access_token}`;
      const verifyRes = await fetch(verifyUrl);
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        return new Response(
          JSON.stringify({ error: "Connection failed", details: verifyData.error?.message || `HTTP ${verifyRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, account: verifyData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── LIST_CAMPAIGNS (from Meta API) ──────────────────────
    if (action === "list_campaigns") {
      if (!adsSettings?.access_token || !adsSettings?.ad_account_id) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected. Save your API credentials first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fields = "id,name,objective,status,buying_type,daily_budget,lifetime_budget,currency,start_time,stop_time,configured_status";
      const listUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adsSettings.ad_account_id}/campaigns?fields=${fields}&limit=100&access_token=${adsSettings.access_token}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();

      if (!listRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch campaigns", details: listData.error?.message || `HTTP ${listRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, campaigns: listData.data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE_CAMPAIGN ─────────────────────────────────────
    if (action === "create_campaign") {
      if (!adsSettings?.access_token || !adsSettings?.ad_account_id) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected. Save your API credentials first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { name, objective, buying_type, daily_budget, lifetime_budget, currency, start_time, stop_time } = body;

      if (!name?.trim()) {
        return new Response(
          JSON.stringify({ error: "Campaign name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const campaignPayload: Record<string, unknown> = {
        name: name.trim(),
        objective: objective || "LINK_CLICKS",
        buying_type: buying_type || "AUCTION",
        status: "PAUSED",
      };

      if (daily_budget) campaignPayload.daily_budget = Math.round(parseFloat(daily_budget) * 100).toString();
      if (lifetime_budget) campaignPayload.lifetime_budget = Math.round(parseFloat(lifetime_budget) * 100).toString();
      if (start_time) campaignPayload.start_time = start_time;
      if (stop_time) campaignPayload.stop_time = stop_time;

      const createUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adsSettings.ad_account_id}/campaigns?access_token=${adsSettings.access_token}`;
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignPayload),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to create campaign", details: createData.error?.message || `HTTP ${createRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const metaCampaignId = createData.id;

      await adminSupabase.from("meta_ad_campaigns").insert({
        user_id: userId,
        meta_campaign_id: metaCampaignId,
        name: name.trim(),
        objective: objective || "LINK_CLICKS",
        status: "PAUSED",
        buying_type: buying_type || "AUCTION",
        daily_budget: daily_budget ? parseFloat(daily_budget) : null,
        lifetime_budget: lifetime_budget ? parseFloat(lifetime_budget) : null,
        currency: currency || "USD",
        start_time: start_time || null,
        stop_time: stop_time || null,
      });

      return new Response(
        JSON.stringify({ success: true, campaign_id: metaCampaignId, message: "Campaign created (paused)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── UPDATE_CAMPAIGN_STATUS ──────────────────────────────
    if (action === "update_campaign_status") {
      if (!adsSettings?.access_token || !adsSettings?.ad_account_id) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { campaign_id, status } = body;
      if (!campaign_id || !status) {
        return new Response(
          JSON.stringify({ error: "Campaign ID and status are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const updateUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${campaign_id}?access_token=${adsSettings.access_token}`;
      const updateRes = await fetch(updateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const updateData = await updateRes.json();

      if (!updateRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to update campaign", details: updateData.error?.message || `HTTP ${updateRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase.from("meta_ad_campaigns")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("meta_campaign_id", campaign_id)
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, message: `Campaign ${status === "ACTIVE" ? "activated" : "paused"}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DELETE_CAMPAIGN ─────────────────────────────────────
    if (action === "delete_campaign") {
      if (!adsSettings?.access_token) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { campaign_id } = body;
      if (!campaign_id) {
        return new Response(
          JSON.stringify({ error: "Campaign ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const delUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${campaign_id}?access_token=${adsSettings.access_token}`;
      const delRes = await fetch(delUrl, { method: "DELETE" });
      const delData = await delRes.json();

      if (!delRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to delete campaign", details: delData.error?.message || `HTTP ${delRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase.from("meta_ad_campaigns")
        .delete()
        .eq("meta_campaign_id", campaign_id)
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, message: "Campaign deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET_INSIGHTS ────────────────────────────────────────
    if (action === "get_insights") {
      if (!adsSettings?.access_token || !adsSettings?.ad_account_id) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { campaign_id, date_range } = body;
      const datePreset = date_range || "last_7d";
      const level = campaign_id ? `/${campaign_id}` : "";
      const fields = "spend,impressions,clicks,reach,frequency,cpm,cpc,ctr,actions";
      const insightsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adsSettings.ad_account_id}${level}/insights?fields=${fields}&date_preset=${datePreset}&level=ad&access_token=${adsSettings.access_token}`;
      const insightsRes = await fetch(insightsUrl);
      const insightsData = await insightsRes.json();

      if (!insightsRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch insights", details: insightsData.error?.message || `HTTP ${insightsRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, insights: insightsData.data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SYNC_CAMPAIGN_STATS ─────────────────────────────────
    if (action === "sync_campaign_stats") {
      if (!adsSettings?.access_token || !adsSettings?.ad_account_id) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fields = "id,name,status,insights.spend,insights.impressions,insights.clicks,insights.actions";
      const listUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adsSettings.ad_account_id}/campaigns?fields=${fields}&limit=100&access_token=${adsSettings.access_token}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();

      if (!listRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to sync stats", details: listData.error?.message || `HTTP ${listRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const campaigns = listData.data || [];
      let leadCount = 0;

      for (const camp of campaigns) {
        const spend = parseFloat(camp.insights?.data?.[0]?.spend || "0");
        const impressions = parseInt(camp.insights?.data?.[0]?.impressions || "0", 10);
        const clicks = parseInt(camp.insights?.data?.[0]?.clicks || "0", 10);
        const actions = camp.insights?.data?.[0]?.actions || [];
        const leadAction = actions.find((a: Record<string, string>) => a.action_type === "lead_generation" || a.action_type === "offsite_conversion.fb_pixel_lead");
        const leads = leadAction ? parseInt(leadAction.value, 10) : 0;
        leadCount += leads;

        const cpl = leads > 0 ? spend / leads : null;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;

        await adminSupabase.from("meta_ad_campaigns")
          .update({
            status: camp.status || "UNKNOWN",
            spend,
            impressions,
            clicks,
            leads,
            cpl,
            ctr,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("meta_campaign_id", camp.id)
          .eq("user_id", userId);
      }

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${campaigns.length} campaigns`, total_leads: leadCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET_AD_ACCOUNT_INFO ─────────────────────────────────
    if (action === "get_ad_accounts") {
      if (!adsSettings?.access_token) {
        return new Response(
          JSON.stringify({ error: "Access token is required. Save your settings first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const accountsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts?fields=id,name,account_status,currency,amount_spent&limit=50&access_token=${adsSettings.access_token}`;
      const accountsRes = await fetch(accountsUrl);
      const accountsData = await accountsRes.json();

      if (!accountsRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch ad accounts", details: accountsData.error?.message || `HTTP ${accountsRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, accounts: accountsData.data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
