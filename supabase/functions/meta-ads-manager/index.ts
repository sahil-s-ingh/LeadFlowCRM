import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// Meta Ads Manager edge function with OAuth flow and click-to-WhatsApp ad creation

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_VERSION = "v21.0";

// SHA-256 hash for PII data before sending to Meta Custom Audiences
async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface PlatformConfig {
  meta_app_id: string;
  app_secret: string;
  is_enabled: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userId = userData.user.id;

    const { data: settings } = await adminClient
      .from("meta_ads_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Helper: fetch platform-level Meta app config
    const getPlatformConfig = async (): Promise<PlatformConfig | null> => {
      const { data } = await adminClient
        .from("platform_meta_ads_config")
        .select("meta_app_id, app_secret, is_enabled")
        .maybeSingle();
      return data as PlatformConfig | null;
    };

    // Helper: get the access token (from user's OAuth-stored settings)
    const getAccessToken = (): string | null => {
      return settings?.access_token || null;
    };

    // Helper: get the ad account ID
    const getAdAccountId = (): string | null => {
      return settings?.ad_account_id || null;
    };

    // ─── GET_OAUTH_CONFIG ─────────────────────────────────────
    // Returns the Meta App ID so the frontend can build the OAuth URL.
    // Does NOT return the app secret.
    if (action === "get_oauth_config") {
      const config = await getPlatformConfig();
      if (!config || !config.is_enabled || !config.meta_app_id) {
        return new Response(
          JSON.stringify({ error: "Meta Marketing API is not configured. Please contact your platform administrator." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          app_id: config.meta_app_id,
          is_enabled: config.is_enabled,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── EXCHANGE_CODE ─────────────────────────────────────────
    // Exchanges the Facebook OAuth code for a long-lived access token.
    // Stores the token + user info in meta_ads_settings.
    if (action === "exchange_code") {
      const config = await getPlatformConfig();
      if (!config || !config.is_enabled || !config.meta_app_id || !config.app_secret) {
        return new Response(
          JSON.stringify({ error: "Meta Marketing API is not configured. Please contact your platform administrator." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { code } = body;
      if (!code) {
        return new Response(
          JSON.stringify({ error: "OAuth code is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Step 1: Exchange code for short-lived token
      const tokenUrl = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${config.meta_app_id}&client_secret=${config.app_secret}&code=${encodeURIComponent(code)}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        return new Response(
          JSON.stringify({ error: "Failed to exchange code for access token", details: tokenData.error?.message || `HTTP ${tokenRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const shortLivedToken = tokenData.access_token;

      // Step 2: Exchange for long-lived token (60 days)
      const longLivedUrl = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.meta_app_id}&client_secret=${config.app_secret}&fb_exchange_token=${shortLivedToken}`;
      const longLivedRes = await fetch(longLivedUrl);
      const longLivedData = await longLivedRes.json();

      const accessToken = longLivedRes.ok && longLivedData.access_token
        ? longLivedData.access_token
        : shortLivedToken;

      // Step 3: Get the Facebook user's name and ID
      const meUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name&access_token=${accessToken}`;
      const meRes = await fetch(meUrl);
      const meData = await meRes.json();

      // Step 4: Fetch the user's ad accounts
      const accountsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts?fields=id,name,account_status,currency,amount_spent&limit=50&access_token=${accessToken}`;
      const accountsRes = await fetch(accountsUrl);
      const accountsData = await accountsRes.json();
      const adAccounts = accountsRes.ok ? (accountsData.data || []) : [];

      // Step 5: Store the token + user info
      const payload = {
        user_id: userId,
        access_token: accessToken,
        app_id: config.meta_app_id,
        fb_user_id: meData.id || null,
        fb_user_name: meData.name || null,
        token_expires_at: longLivedData.expires_in
          ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
          : null,
        connected_via: "oauth",
        is_connected: true,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await adminClient
        .from("meta_ads_settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await adminClient.from("meta_ads_settings").update(payload).eq("id", existing.id);
      } else {
        await adminClient.from("meta_ads_settings").insert(payload);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Facebook account connected successfully",
          user_name: meData.name || "Unknown",
          ad_accounts: adAccounts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DISCONNECT ────────────────────────────────────────────
    if (action === "disconnect") {
      await adminClient.from("meta_ads_settings")
        .update({
          access_token: null,
          ad_account_id: null,
          is_connected: false,
          fb_user_id: null,
          fb_user_name: null,
          token_expires_at: null,
          connected_via: "manual",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, message: "Facebook account disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SAVE_AD_ACCOUNT ───────────────────────────────────────
    // After OAuth, user selects which ad account to use
    if (action === "save_ad_account") {
      const { ad_account_id } = body;
      if (!ad_account_id) {
        return new Response(
          JSON.stringify({ error: "Ad account ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const cleanAccountId = String(ad_account_id).replace(/^act_/, "");

      await adminClient.from("meta_ads_settings")
        .update({
          ad_account_id: cleanAccountId,
          is_connected: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, message: "Ad account saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET_CONNECTION_STATUS ─────────────────────────────────
    if (action === "get_status") {
      return new Response(
        JSON.stringify({
          success: true,
          is_connected: settings?.is_connected || false,
          connected_via: settings?.connected_via || "manual",
          fb_user_name: settings?.fb_user_name || null,
          ad_account_id: settings?.ad_account_id || null,
          token_expires_at: settings?.token_expires_at || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── VERIFY_CONNECTION ───────────────────────────────────
    const accessToken = getAccessToken();
    const adAccountId = getAdAccountId();

    if (action === "verify_connection") {
      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({ error: "Facebook account not connected. Click 'Connect with Facebook' first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const verifyUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}?fields=name,account_status,currency,amount_spent,balance&access_token=${accessToken}`;
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

    // ─── LIST_CAMPAIGNS ──────────────────────────────────────
    if (action === "list_campaigns") {
      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected. Click 'Connect with Facebook' first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fields = "id,name,objective,status,buying_type,daily_budget,lifetime_budget,currency,start_time,stop_time,configured_status";
      const listUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/campaigns?fields=${fields}&limit=100&access_token=${accessToken}`;
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
      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected. Click 'Connect with Facebook' first." }),
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

      const createUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/campaigns?access_token=${accessToken}`;
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

      await adminClient.from("meta_ad_campaigns").insert({
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
      if (!accessToken || !adAccountId) {
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

      const updateUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${campaign_id}?access_token=${accessToken}`;
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

      await adminClient.from("meta_ad_campaigns")
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
      if (!accessToken) {
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

      const delUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${campaign_id}?access_token=${accessToken}`;
      const delRes = await fetch(delUrl, { method: "DELETE" });
      const delData = await delRes.json();

      if (!delRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to delete campaign", details: delData.error?.message || `HTTP ${delRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminClient.from("meta_ad_campaigns")
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
      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { campaign_id, date_range } = body;
      const datePreset = date_range || "last_7d";
      const level = campaign_id ? `/${campaign_id}` : "";
      const fields = "spend,impressions,clicks,reach,frequency,cpm,cpc,ctr,actions";
      const insightsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}${level}/insights?fields=${fields}&date_preset=${datePreset}&level=ad&access_token=${accessToken}`;
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
      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fields = "id,name,status,insights.spend,insights.impressions,insights.clicks,insights.actions";
      const listUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/campaigns?fields=${fields}&limit=100&access_token=${accessToken}`;
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

        await adminClient.from("meta_ad_campaigns")
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

    // ─── GET_AD_ACCOUNTS ─────────────────────────────────────
    if (action === "get_ad_accounts") {
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Facebook account not connected. Click 'Connect with Facebook' first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const accountsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts?fields=id,name,account_status,currency,amount_spent&limit=50&access_token=${accessToken}`;
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

    // ─── GET_PAGES ───────────────────────────────────────────
    // Fetch Facebook Pages the user can manage (needed for click-to-WhatsApp ads)
    if (action === "get_pages") {
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Facebook account not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const pagesUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`;
      const pagesRes = await fetch(pagesUrl);
      const pagesData = await pagesRes.json();

      if (!pagesRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch Pages", details: pagesData.error?.message || `HTTP ${pagesRes.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, pages: pagesData.data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SAVE_PAGE ───────────────────────────────────────────
    // Save the selected Facebook Page ID + WhatsApp number for C2W ads
    if (action === "save_page") {
      const { page_id, page_name, whatsapp_phone_number } = body;
      if (!page_id) {
        return new Response(
          JSON.stringify({ error: "Page ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminClient.from("meta_ads_settings")
        .update({
          page_id,
          page_name: page_name || null,
          whatsapp_phone_number: whatsapp_phone_number || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, message: "Page and WhatsApp number saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE_CLICK_TO_WHATSAPP_AD ─────────────────────────
    // Full flow: campaign → ad set → ad creative → ad
    if (action === "create_c2w_ad") {
      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const {
        campaign_name,
        objective,
        daily_budget,
        lifetime_budget,
        currency,
        start_time,
        page_id,
        whatsapp_phone_number,
        whatsapp_greeting,
        ad_name,
        headline,
        primary_text,
        description,
        image_hash,
        image_url,
        call_to_action_type,
        countries,
        age_min,
        age_max,
      } = body;

      if (!campaign_name?.trim()) {
        return new Response(JSON.stringify({ error: "Campaign name is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!page_id) {
        return new Response(JSON.stringify({ error: "Facebook Page ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const obj = objective || "OUTCOME_ENGAGEMENT";
      const accountUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}`;

      // Step 1: Create campaign
      const campaignPayload: Record<string, unknown> = {
        name: campaign_name.trim(),
        objective: obj,
        status: "PAUSED",
        special_ad_categories: "[]",
      };
      if (daily_budget) campaignPayload.daily_budget = Math.round(parseFloat(daily_budget) * 100).toString();
      if (lifetime_budget) campaignPayload.lifetime_budget = Math.round(parseFloat(lifetime_budget) * 100).toString();

      const campRes = await fetch(`${accountUrl}/campaigns?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignPayload),
      });
      const campData = await campRes.json();
      if (!campRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create campaign", details: campData.error?.message || `HTTP ${campRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const metaCampaignId = campData.id;

      // Step 2: Create ad set with destination_type=WHATSAPP
      const adsetPayload: Record<string, unknown> = {
        name: `${campaign_name.trim()} — Ad Set`,
        campaign_id: metaCampaignId,
        billing_event: "IMPRESSIONS",
        destination_type: "WHATSAPP",
        optimization_goal: obj === "OUTCOME_ENGAGEMENT" ? "CONVERSATIONS" : obj === "OUTCOME_LEADS" ? "CONVERSATIONS" : "LINK_CLICKS",
        status: "PAUSED",
        promoted_object: { page_id },
        targeting: {
          geo_locations: { countries: countries || ["US"] },
          age_min: age_min || 18,
          age_max: age_max || 65,
        },
      };
      if (daily_budget) adsetPayload.daily_budget = Math.round(parseFloat(daily_budget) * 100).toString();
      if (lifetime_budget) {
        adsetPayload.lifetime_budget = Math.round(parseFloat(lifetime_budget) * 100).toString();
        adsetPayload.end_time = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const adsetRes = await fetch(`${accountUrl}/adsets?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adsetPayload),
      });
      const adsetData = await adsetRes.json();
      if (!adsetRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create ad set", details: adsetData.error?.message || `HTTP ${adsetRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adsetId = adsetData.id;

      // Step 3: Create ad creative with WHATSAPP_MESSAGE CTA
      const linkData: Record<string, unknown> = {
        link: "https://api.whatsapp.com/send",
        call_to_action: {
          type: call_to_action_type || "WHATSAPP_MESSAGE",
          value: { app_destination: "WHATSAPP" },
        },
      };
      if (headline) linkData.name = headline;
      if (primary_text) linkData.message = primary_text;
      if (description) linkData.description = description;
      if (image_hash) linkData.image_hash = image_hash;
      if (image_url) linkData.picture = image_url;

      // Add WhatsApp greeting message if provided
      if (whatsapp_greeting) {
        linkData.page_welcome_message = {
          type: "VISUAL_EDITOR",
          version: 2,
          landing_screen_type: "welcome_message",
          media_type: "text",
          text_format: {
            customer_action_type: "autofill_message",
            message: {
              text: whatsapp_greeting,
            },
          },
        };
      }

      const creativePayload: Record<string, unknown> = {
        name: ad_name || `${campaign_name.trim()} — Creative`,
        object_story_spec: {
          page_id,
          link_data: linkData,
        },
        degrees_of_freedom_spec: {
          creative_features_spec: {
            standard_enhancements: { enroll_status: "OPT_IN" },
          },
        },
      };

      const creativeRes = await fetch(`${accountUrl}/adcreatives?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creativePayload),
      });
      const creativeData = await creativeRes.json();
      if (!creativeRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create ad creative", details: creativeData.error?.message || `HTTP ${creativeRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const creativeId = creativeData.id;

      // Step 4: Create the ad
      const adPayload = {
        name: ad_name || `${campaign_name.trim()} — Ad`,
        adset_id: adsetId,
        creative: { creative_id: creativeId },
        status: "PAUSED",
      };

      const adRes = await fetch(`${accountUrl}/ads?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adPayload),
      });
      const adData = await adRes.json();
      if (!adRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create ad", details: adData.error?.message || `HTTP ${adRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Store campaign in database
      await adminClient.from("meta_ad_campaigns").insert({
        user_id: userId,
        meta_campaign_id: metaCampaignId,
        name: campaign_name.trim(),
        objective: obj,
        status: "PAUSED",
        buying_type: "AUCTION",
        daily_budget: daily_budget ? parseFloat(daily_budget) : null,
        lifetime_budget: lifetime_budget ? parseFloat(lifetime_budget) : null,
        currency: currency || "USD",
        start_time: start_time || null,
        is_click_to_whatsapp: true,
        whatsapp_greeting: whatsapp_greeting || null,
      });

      // Log activity
      await adminClient.from("meta_ad_activity").insert({
        user_id: userId,
        action: "c2w_ad_created",
        description: `Created click-to-WhatsApp ad "${campaign_name.trim()}"`,
        metadata: { campaign_id: metaCampaignId, adset_id: adsetId, creative_id: creativeId, ad_id: adData.id },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Click-to-WhatsApp ad created (paused). Review in Facebook Ads Manager before activating.",
          campaign_id: metaCampaignId,
          adset_id: adsetId,
          creative_id: creativeId,
          ad_id: adData.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── UPLOAD_AD_IMAGE ─────────────────────────────────────
    // Upload an image to the ad account and return its hash for use in ad creatives
    if (action === "upload_ad_image") {
      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({ error: "Meta Ads not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { image_url } = body;
      if (!image_url) {
        return new Response(JSON.stringify({ error: "Image URL is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const uploadUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/adimages?access_token=${accessToken}`;
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "ad_creative_image", url: image_url }),
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to upload image", details: uploadData.error?.message || `HTTP ${uploadRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const images = uploadData.images || {};
      const firstKey = Object.keys(images)[0];
      const hash = firstKey ? images[firstKey].hash : null;

      return new Response(
        JSON.stringify({ success: true, hash }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE_CUSTOM_AUDIENCE ─────────────────────────────
    // Create a custom audience in Meta from CRM lead phone/email data
    if (action === "create_custom_audience") {
      if (!accessToken || !adAccountId) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { name, description, lead_ids } = body;
      if (!name?.trim()) {
        return new Response(JSON.stringify({ error: "Audience name is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch lead data from submissions
      let usersData: Array<Record<string, string>> = [];
      if (lead_ids && Array.isArray(lead_ids) && lead_ids.length > 0) {
        const { data: leads } = await adminClient
          .from("submissions")
          .select("full_name, email, mobile_number")
          .in("id", lead_ids);
        if (leads) {
          usersData = leads.map((l: Record<string, unknown>) => ({
            full_name: String(l.full_name || ""),
            email: String(l.email || ""),
            phone: String(l.mobile_number || ""),
          })).filter((u: Record<string, string>) => u.email || u.phone);
        }
      } else {
        // Use all leads
        const { data: leads } = await adminClient
          .from("submissions")
          .select("full_name, email, mobile_number")
          .eq("user_id", userId)
          .limit(10000);
        if (leads) {
          usersData = leads.map((l: Record<string, unknown>) => ({
            full_name: String(l.full_name || ""),
            email: String(l.email || ""),
            phone: String(l.mobile_number || ""),
          })).filter((u: Record<string, string>) => u.email || u.phone);
        }
      }

      if (usersData.length === 0) {
        return new Response(JSON.stringify({ error: "No leads with email or phone found to create audience" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create the custom audience in Meta
      const audiencePayload: Record<string, unknown> = {
        name: name.trim(),
        subtype: "CUSTOM",
        description: description || `Custom audience from CRM leads (${usersData.length} records)`,
        customer_file_source: { type: "USER_PROVIDED" },
      };

      const createAudUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/customaudiences?access_token=${accessToken}`;
      const createAudRes = await fetch(createAudUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(audiencePayload),
      });
      const createAudData = await createAudRes.json();
      if (!createAudRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create custom audience", details: createAudData.error?.message || `HTTP ${createAudRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const audienceId = createAudData.id;

      // Add users to the audience via batch
      const userPayload: Record<string, unknown> = {
        payload: {
          schema: ["EMAIL", "PHONE", "FN"],
          data: usersData.map((u: Record<string, string>) => [
            u.email ? await hashValue(u.email.toLowerCase()) : "",
            u.phone ? await hashValue(u.phone.replace(/[^0-9]/g, "")) : "",
            u.full_name ? await hashValue(u.full_name.toLowerCase()) : "",
          ]).filter((row: string[]) => row.some((v: string) => v)),
        },
      };

      const addUsersUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${audienceId}/users?access_token=${accessToken}`;
      const addUsersRes = await fetch(addUsersUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userPayload),
      });
      const addUsersData = await addUsersRes.json();
      if (!addUsersRes.ok) {
        return new Response(JSON.stringify({ error: "Audience created but failed to add users", details: addUsersData.error?.message || `HTTP ${addUsersRes.status}`, audience_id: audienceId }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Store in DB
      const { data: audRow } = await adminClient.from("meta_custom_audiences").insert({
        user_id: userId,
        name: name.trim(),
        description: description || null,
        audience_id: audienceId,
        audience_type: "CUSTOM",
        estimated_size: BigInt(usersData.length),
        status: "ACTIVE",
        last_synced_at: new Date().toISOString(),
      }).select().single();

      await adminClient.from("meta_ad_activity").insert({
        user_id: userId,
        action: "custom_audience_created",
        description: `Created custom audience "${name.trim()}" with ${usersData.length} leads`,
        metadata: { audience_id: audienceId, lead_count: usersData.length },
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Custom audience created with ${usersData.length} leads`,
        audience_id: audienceId,
        audience: audRow,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── LIST_CUSTOM_AUDIENCES ──────────────────────────────
    if (action === "list_custom_audiences") {
      if (!accessToken || !adAccountId) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const audUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/customaudiences?fields=id,name,description,approximate_count,subtype,operation_status,time_created&limit=100&access_token=${accessToken}`;
      const audRes = await fetch(audUrl);
      const audData = await audRes.json();
      if (!audRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch audiences", details: audData.error?.message || `HTTP ${audRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Sync to DB
      for (const aud of (audData.data || [])) {
        await adminClient.from("meta_custom_audiences").upsert({
          user_id: userId,
          name: aud.name,
          description: aud.description,
          audience_id: aud.id,
          audience_type: aud.subtype || "CUSTOM",
          estimated_size: BigInt(aud.approximate_count || 0),
          status: aud.operation_status || "ACTIVE",
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,audience_id" });
      }

      return new Response(JSON.stringify({ success: true, audiences: audData.data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DELETE_CUSTOM_AUDIENCE ─────────────────────────────
    if (action === "delete_custom_audience") {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { audience_id } = body;
      if (!audience_id) {
        return new Response(JSON.stringify({ error: "Audience ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const delUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${audience_id}?access_token=${accessToken}`;
      const delRes = await fetch(delUrl, { method: "DELETE" });
      const delData = await delRes.json();
      if (!delRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to delete audience", details: delData.error?.message || `HTTP ${delRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await adminClient.from("meta_custom_audiences").delete().eq("audience_id", audience_id).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true, message: "Custom audience deleted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CREATE_LOOKALIKE_AUDIENCE ──────────────────────────
    if (action === "create_lookalike_audience") {
      if (!accessToken || !adAccountId) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { name, source_audience_id, country, audience_size } = body;
      if (!name?.trim() || !source_audience_id) {
        return new Response(JSON.stringify({ error: "Name and source audience are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const lkPayload: Record<string, unknown> = {
        name: name.trim(),
        subtype: "LOOKALIKE",
        origin_audience_id: source_audience_id,
        lookalike_spec: {
          type: "lookalike",
          country: country || "US",
          ratio: audience_size ? parseFloat(audience_size) / 100 : 0.01,
        },
      };
      const lkUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/customaudiences?access_token=${accessToken}`;
      const lkRes = await fetch(lkUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lkPayload) });
      const lkData = await lkRes.json();
      if (!lkRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create lookalike audience", details: lkData.error?.message || `HTTP ${lkRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const lkId = lkData.id;
      const { data: lkRow } = await adminClient.from("meta_lookalike_audiences").insert({
        user_id: userId,
        name: name.trim(),
        source_audience_id,
        lookalike_audience_id: lkId,
        audience_size: audience_size || "1",
        country: country || "US",
        status: "ACTIVE",
      }).select().single();
      await adminClient.from("meta_ad_activity").insert({
        user_id: userId,
        action: "lookalike_created",
        description: `Created lookalike audience "${name.trim()}" from source ${source_audience_id}`,
        metadata: { lookalike_id: lkId },
      });
      return new Response(JSON.stringify({ success: true, message: "Lookalike audience created", audience_id: lkId, audience: lkRow }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CREATE_LEAD_FORM ───────────────────────────────────
    // Create a Facebook/Instagram lead form ad
    if (action === "create_lead_form") {
      if (!accessToken || !adAccountId) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { name, page_id, questions, privacy_policy_url } = body;
      if (!name?.trim() || !page_id) {
        return new Response(JSON.stringify({ error: "Form name and Page ID are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const formPayload: Record<string, unknown> = {
        name: name.trim(),
        follow_up_action_url: privacy_policy_url || "",
        questions: questions || [
          { type: "NAME", label: "Full Name" },
          { type: "EMAIL", label: "Email" },
          { type: "PHONE_NUMBER", label: "Phone Number" },
        ],
      };

      const formUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${page_id}/leadgen_forms?access_token=${accessToken}`;
      const formRes = await fetch(formUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formPayload) });
      const formData = await formRes.json();
      if (!formRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create lead form", details: formData.error?.message || `HTTP ${formRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const formId = formData.id;

      const { data: formRow } = await adminClient.from("meta_lead_forms").insert({
        user_id: userId,
        name: name.trim(),
        page_id,
        form_id: formId,
        questions: JSON.stringify(questions || []),
        privacy_policy_url: privacy_policy_url || null,
        status: "ACTIVE",
      }).select().single();

      await adminClient.from("meta_ad_activity").insert({
        user_id: userId,
        action: "lead_form_created",
        description: `Created lead form "${name.trim()}" on Page ${page_id}`,
        metadata: { form_id: formId },
      });

      return new Response(JSON.stringify({ success: true, message: "Lead form created", form_id: formId, form: formRow }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── LIST_LEAD_FORMS ────────────────────────────────────
    if (action === "list_lead_forms") {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Get pages first, then fetch forms for each
      const pagesUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name&limit=100&access_token=${accessToken}`;
      const pagesRes = await fetch(pagesUrl);
      const pagesData = await pagesRes.json();
      const pages = pagesRes.ok ? (pagesData.data || []) : [];

      const allForms: Array<Record<string, unknown>> = [];
      for (const page of pages) {
        const formsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${page.id}/leadgen_forms?fields=id,name,status,created_time,lead_count&limit=50&access_token=${accessToken}`;
        const formsRes = await fetch(formsUrl);
        const formsData = await formsRes.json();
        if (formsRes.ok && formsData.data) {
          for (const form of formsData.data) {
            allForms.push({ ...form, page_name: page.name, page_id: page.id });
          }
        }
      }

      // Sync to DB
      for (const form of allForms) {
        await adminClient.from("meta_lead_forms").upsert({
          user_id: userId,
          name: String(form.name || ""),
          page_id: String(form.page_id || ""),
          form_id: String(form.id || ""),
          status: String(form.status || "ACTIVE"),
          leads_count: Number(form.lead_count || 0),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,form_id" });
      }

      return new Response(JSON.stringify({ success: true, forms: allForms }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── GET_LEAD_FORM_LEADS ────────────────────────────────
    if (action === "get_lead_form_leads") {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { form_id } = body;
      if (!form_id) {
        return new Response(JSON.stringify({ error: "Form ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const leadsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${form_id}/leads?fields=field_data,created_time,id&limit=100&access_token=${accessToken}`;
      const leadsRes = await fetch(leadsUrl);
      const leadsData = await leadsRes.json();
      if (!leadsRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch lead form leads", details: leadsData.error?.message || `HTTP ${leadsRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const formLeads = leadsData.data || [];
      // Store leads in DB
      for (const lead of formLeads) {
        await adminClient.from("meta_lead_form_leads").upsert({
          user_id: userId,
          form_id,
          leadgen_id: lead.id,
          field_data: JSON.stringify(lead.field_data || []),
          created_at: lead.created_time || new Date().toISOString(),
        }, { onConflict: "user_id,leadgen_id" });
      }

      return new Response(JSON.stringify({ success: true, leads: formLeads }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── SYNC_LEAD_TO_CRM ───────────────────────────────────
    // Push a Meta lead form lead into the CRM submissions table
    if (action === "sync_lead_to_crm") {
      const { leadgen_id } = body;
      if (!leadgen_id) {
        return new Response(JSON.stringify({ error: "Leadgen ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: leadRow } = await adminClient.from("meta_lead_form_leads")
        .select("*").eq("leadgen_id", leadgen_id).eq("user_id", userId).maybeSingle();
      if (!leadRow) {
        return new Response(JSON.stringify({ error: "Lead not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const fieldData = leadRow.field_data as Array<Record<string, string>> || [];
      const getField = (name: string) => fieldData.find((f) => f.name?.toLowerCase() === name.toLowerCase())?.values?.[0] || "";

      const { data: existing } = await adminClient.from("submissions")
        .select("id").eq("user_id", userId).eq("email", getField("email")).maybeSingle();
      if (existing) {
        await adminClient.from("meta_lead_form_leads").update({ synced_to_crm: true }).eq("leadgen_id", leadgen_id);
        return new Response(JSON.stringify({ success: true, message: "Lead already in CRM", submission_id: existing.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: newLead } = await adminClient.from("submissions").insert({
        user_id: userId,
        full_name: getField("full_name") || getField("first_name") + " " + getField("last_name"),
        email: getField("email"),
        mobile_number: getField("phone_number") || getField("phone"),
        state: "",
        trading_product: "algo",
        lead_source: "Meta Lead Form",
        status: "new",
      }).select().single();

      await adminClient.from("meta_lead_form_leads").update({ synced_to_crm: true }).eq("leadgen_id", leadgen_id);

      return new Response(JSON.stringify({ success: true, message: "Lead synced to CRM", submission_id: newLead?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── GET_PERFORMANCE_TIME_SERIES ────────────────────────
    // Fetch daily performance breakdown for charting
    if (action === "get_performance_time_series") {
      if (!accessToken || !adAccountId) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { campaign_id, date_range } = body;
      const datePreset = date_range || "last_7d";
      const level = campaign_id ? `/${campaign_id}` : "";
      const fields = "spend,impressions,clicks,reach,ctr,cpc,cpm,actions,date_start";
      const tsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}${level}/insights?fields=${fields}&date_preset=${datePreset}&level=ad&time_increment=1&access_token=${accessToken}`;
      const tsRes = await fetch(tsUrl);
      const tsData = await tsRes.json();
      if (!tsRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch time series", details: tsData.error?.message || `HTTP ${tsRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, time_series: tsData.data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── SET_AD_SCHEDULE ────────────────────────────────────
    // Update ad set with day-parting schedule
    if (action === "set_ad_schedule") {
      if (!accessToken || !adAccountId) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { adset_id, schedule } = body;
      if (!adset_id) {
        return new Response(JSON.stringify({ error: "Ad set ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const schedulePayload: Record<string, unknown> = {
        pacing_type: "DAY_PARTING",
        adset_schedule: schedule,
      };

      const schedUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${adset_id}?access_token=${accessToken}`;
      const schedRes = await fetch(schedUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(schedulePayload) });
      const schedData = await schedRes.json();
      if (!schedRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to set ad schedule", details: schedData.error?.message || `HTTP ${schedRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await adminClient.from("meta_ad_activity").insert({
        user_id: userId,
        action: "ad_schedule_set",
        description: `Set ad schedule for ad set ${adset_id}`,
        metadata: { adset_id, schedule },
      });

      return new Response(JSON.stringify({ success: true, message: "Ad schedule updated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── LIST_ADSETS ────────────────────────────────────────
    // List ad sets for a campaign (needed for ad scheduling)
    if (action === "list_adsets") {
      if (!accessToken || !adAccountId) {
        return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { campaign_id } = body;
      let adsetsUrl: string;
      if (campaign_id) {
        adsetsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${campaign_id}/adsets?fields=id,name,status,daily_budget,lifetime_budget,pacing_type,adset_schedule&limit=100&access_token=${accessToken}`;
      } else {
        adsetsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/adsets?fields=id,name,campaign_id,status,daily_budget,lifetime_budget,pacing_type,adset_schedule&limit=100&access_token=${accessToken}`;
      }
      const adsetsRes = await fetch(adsetsUrl);
      const adsetsData = await adsetsRes.json();
      if (!adsetsRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch ad sets", details: adsetsData.error?.message || `HTTP ${adsetsRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, adsets: adsetsData.data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── GET_ATTRIBUTION ────────────────────────────────────
    // Get lead-to-ad attribution data
    if (action === "get_attribution") {
      const { data: attributions } = await adminClient
        .from("meta_ad_attribution")
        .select(`
          *,
          submission:submissions(full_name, email, mobile_number, status, purchase_value, fund_amount)
        `)
        .eq("user_id", userId)
        .order("attributed_at", { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({ success: true, attributions: attributions || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CREATE_ATTRIBUTION ─────────────────────────────────
    // Manually link a CRM lead to a Meta campaign
    if (action === "create_attribution") {
      const { submission_id, meta_campaign_id, campaign_name, attributed_revenue } = body;
      if (!submission_id || !meta_campaign_id) {
        return new Response(JSON.stringify({ error: "Submission ID and campaign ID are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: attrRow } = await adminClient.from("meta_ad_attribution").upsert({
        user_id: userId,
        submission_id,
        meta_campaign_id,
        campaign_name: campaign_name || null,
        attributed_revenue: attributed_revenue || 0,
      }, { onConflict: "submission_id" }).select().single();
      return new Response(JSON.stringify({ success: true, attribution: attrRow }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── AUTO_ATTRIBUTE_LEADS ───────────────────────────────
    // Auto-match CRM leads to Meta campaigns by meta_lead_id or lead_source
    if (action === "auto_attribute_leads") {
      const { data: leads } = await adminClient
        .from("submissions")
        .select("id, meta_lead_id, lead_source, purchase_value, fund_amount")
        .eq("user_id", userId)
        .not("meta_lead_id", "is", null)
        .limit(500);
      if (!leads || leads.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No leads with Meta lead IDs found to attribute", attributed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch campaigns for matching
      const { data: campaigns } = await adminClient
        .from("meta_ad_campaigns")
        .select("meta_campaign_id, name")
        .eq("user_id", userId);

      let attributedCount = 0;
      for (const lead of leads) {
        // Check if attribution already exists
        const { data: existing } = await adminClient.from("meta_ad_attribution")
          .select("id").eq("submission_id", lead.id).maybeSingle();
        if (existing) continue;

        const campaign = campaigns?.find((c) => c.meta_campaign_id === lead.meta_lead_id);
        await adminClient.from("meta_ad_attribution").insert({
          user_id: userId,
          submission_id: lead.id,
          meta_campaign_id: lead.meta_lead_id,
          campaign_name: campaign?.name || null,
          lead_source: lead.lead_source || "Meta Ads",
          attributed_revenue: lead.purchase_value || lead.fund_amount || 0,
        });
        attributedCount++;
      }

      // Also match by lead_source = 'Meta Ads'
      const { data: metaLeads } = await adminClient
        .from("submissions")
        .select("id, meta_lead_id, lead_source, purchase_value, fund_amount")
        .eq("user_id", userId)
        .eq("lead_source", "Meta Ads")
        .is("meta_lead_id", null)
        .limit(500);

      if (metaLeads) {
        for (const lead of metaLeads) {
          const { data: existing } = await adminClient.from("meta_ad_attribution")
            .select("id").eq("submission_id", lead.id).maybeSingle();
          if (existing) continue;
          await adminClient.from("meta_ad_attribution").insert({
            user_id: userId,
            submission_id: lead.id,
            meta_campaign_id: null,
            campaign_name: null,
            lead_source: "Meta Ads",
            attributed_revenue: lead.purchase_value || lead.fund_amount || 0,
          });
          attributedCount++;
        }
      }

      return new Response(JSON.stringify({ success: true, message: `Attributed ${attributedCount} leads to Meta campaigns`, attributed: attributedCount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
