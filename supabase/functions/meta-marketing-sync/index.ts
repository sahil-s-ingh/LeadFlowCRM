import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MarketingSettings {
  app_id: string | null;
  app_secret: string | null;
  access_token: string;
  ad_account_id: string;
  is_enabled: boolean;
  target_cpl: number | null;
  target_roas: number | null;
}

interface CampaignInsight {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  cpm: number;
  cpc: number;
  date_start: string;
  date_stop: string;
}

interface CampaignMeta {
  campaign_id: string;
  daily_budget: number;
  lifetime_budget: number;
  buying_strategy: string;
  objective: string;
  status: string;
}

function computeHealthScore(opts: {
  cpl: number | null;
  roas: number | null;
  leadQuality: number;
  conversionRate: number;
  targetCpl: number | null;
  targetRoas: number | null;
}): number {
  let score = 0;
  let components = 0;

  if (opts.targetCpl && opts.cpl != null && opts.cpl > 0) {
    const cplRatio = opts.targetCpl / opts.cpl;
    const cplScore = Math.min(40, Math.max(0, cplRatio * 40));
    score += cplScore;
    components++;
  } else if (opts.cpl != null && opts.cpl > 0) {
    score += 20;
    components++;
  }

  if (opts.targetRoas && opts.roas != null) {
    const roasRatio = opts.roas / opts.targetRoas;
    const roasScore = Math.min(30, Math.max(0, roasRatio * 30));
    score += roasScore;
    components++;
  } else if (opts.roas != null) {
    score += 15;
    components++;
  }

  const qualityScore = Math.min(20, opts.leadQuality * 0.2);
  score += qualityScore;
  components++;

  const convScore = Math.min(10, opts.conversionRate * 2);
  score += convScore;
  components++;

  return components > 0 ? Math.round(Math.min(100, score)) : 0;
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

    const { data: settings, error: settingsError } = await adminSupabase
      .from("meta_marketing_settings")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "No credentials saved yet. Open the Campaign Optimizer → Settings tab, enter your Access Token and Ad Account ID, and click Save Settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mk = settings as MarketingSettings;
    if (!mk.access_token || !mk.ad_account_id) {
      return new Response(
        JSON.stringify({ error: "Access Token and Ad Account ID are required. Fill them in the Campaign Optimizer → Settings tab and click Save Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!mk.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, message: "Meta Marketing API is disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const dateRange = body.date_range || "last_7d";
    const accountId = mk.ad_account_id.replace(/^act_/, "");

    // Fetch insights at ad level with more fields
    const insightFields = [
      "campaign_id",
      "campaign_name",
      "adset_id",
      "adset_name",
      "ad_id",
      "ad_name",
      "spend",
      "impressions",
      "clicks",
      "reach",
      "frequency",
      "cpm",
      "cpc",
      "date_start",
      "date_stop",
    ].join(",");

    const insightsUrl = `https://graph.facebook.com/v20.0/act_${accountId}/insights?fields=${insightFields}&level=ad&date_preset=${dateRange}&access_token=${mk.access_token}`;

    const insightsRes = await fetch(insightsUrl);
    const insightsData = await insightsRes.json();

    if (!insightsRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch insights from Meta",
          details: insightsData.error?.message || `HTTP ${insightsRes.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const insights: CampaignInsight[] = (insightsData.data || []).map((d: Record<string, unknown>) => ({
      campaign_id: d.campaign_id as string,
      campaign_name: d.campaign_name as string,
      adset_id: (d.adset_id as string) || "",
      adset_name: (d.adset_name as string) || "",
      ad_id: (d.ad_id as string) || "",
      ad_name: (d.ad_name as string) || "",
      spend: parseFloat(d.spend as string) || 0,
      impressions: parseInt(d.impressions as string, 10) || 0,
      clicks: parseInt(d.clicks as string, 10) || 0,
      reach: parseInt(d.reach as string) || 0,
      frequency: parseFloat(d.frequency as string) || 0,
      cpm: parseFloat(d.cpm as string) || 0,
      cpc: parseFloat(d.cpc as string) || 0,
      date_start: d.date_start as string,
      date_stop: d.date_stop as string,
    }));

    // Fetch campaign-level metadata (budget, objective, status)
    const campaignIds = [...new Set(insights.map((i) => i.campaign_id))];
    const campaignMetaMap = new Map<string, CampaignMeta>();

    await Promise.all(campaignIds.map(async (cid) => {
      try {
        const campUrl = `https://graph.facebook.com/v20.0/${cid}?fields=daily_budget,lifetime_budget,buying_strategy,objective,status&access_token=${mk.access_token}`;
        const campRes = await fetch(campUrl);
        if (campRes.ok) {
          const campData = await campRes.json();
          campaignMetaMap.set(cid, {
            campaign_id: cid,
            daily_budget: parseFloat(campData.daily_budget || "0") / 100,
            lifetime_budget: parseFloat(campData.lifetime_budget || "0") / 100,
            buying_strategy: campData.buying_strategy || "",
            objective: campData.objective || "",
            status: campData.status || "",
          });
        }
      } catch {
        // skip individual campaign errors
      }
    }));

    // Fetch CRM leads
    const { data: crmLeads } = await adminSupabase
      .from("submissions")
      .select("id, status, fund_amount, purchase_value, created_at, meta_lead_id")
      .is("deleted_at", null)
      .limit(10000);

    const leadRows = (crmLeads || []) as Array<{
      id: string;
      status: string;
      fund_amount: number | null;
      purchase_value: number | null;
      created_at: string;
      meta_lead_id: string | null;
    }>;

    const { data: appearanceData } = await adminSupabase
      .from("appearance_settings")
      .select("setup_cost")
      .maybeSingle();

    const setupCost = appearanceData?.setup_cost ?? 0;

    const { data: convLog } = await adminSupabase
      .from("meta_conversion_log")
      .select("lead_id, event_name, success")
      .eq("success", true);

    const trackedLeadIds = new Set((convLog || []).map((l: { lead_id: string }) => l.lead_id));

    const totalLeads = leadRows.length;
    const convertedLeads = leadRows.filter((l) => l.status === "converted");
    const totalConversions = convertedLeads.length;
    const totalRevenue = convertedLeads.reduce((sum, l) => {
      const val = l.purchase_value ?? l.fund_amount ?? 0;
      return sum + (parseFloat(String(val)) || 0) + setupCost;
    }, 0);

    const totalSpend = insights.reduce((sum, i) => sum + i.spend, 0);

    const today = new Date().toISOString().slice(0, 10);
    const snapshotsToInsert: Array<Record<string, unknown>> = [];

    // Build per-campaign aggregated data for health scoring
    const campaignAggMap = new Map<string, { spend: number; leads: number; conversions: number; revenue: number; impressions: number; clicks: number }>();

    for (const insight of insights) {
      const spendPct = totalSpend > 0 ? insight.spend / totalSpend : 0;
      const estimatedLeads = Math.round(totalLeads * spendPct);
      const estimatedConversions = Math.round(totalConversions * spendPct);
      const estimatedRevenue = totalRevenue * spendPct;

      const cpl = estimatedLeads > 0 ? insight.spend / estimatedLeads : null;
      const ctr = insight.impressions > 0 ? (insight.clicks / insight.impressions) * 100 : 0;
      const roas = insight.spend > 0 ? estimatedRevenue / insight.spend : 0;
      const leadQualityScore = estimatedLeads > 0
        ? Math.min(100, (estimatedConversions / estimatedLeads) * 100)
        : 0;
      const costPerConversion = estimatedConversions > 0 ? insight.spend / estimatedConversions : null;
      const profitLoss = estimatedRevenue - insight.spend;
      const leadToConvRate = estimatedLeads > 0 ? (estimatedConversions / estimatedLeads) * 100 : 0;
      const costPerClick = insight.clicks > 0 ? insight.spend / insight.clicks : null;

      // Aggregate per campaign for health score
      const agg = campaignAggMap.get(insight.campaign_id) || { spend: 0, leads: 0, conversions: 0, revenue: 0, impressions: 0, clicks: 0 };
      agg.spend += insight.spend;
      agg.leads += estimatedLeads;
      agg.conversions += estimatedConversions;
      agg.revenue += estimatedRevenue;
      agg.impressions += insight.impressions;
      agg.clicks += insight.clicks;
      campaignAggMap.set(insight.campaign_id, agg);

      const meta = campaignMetaMap.get(insight.campaign_id);

      snapshotsToInsert.push({
        user_id: userData.user.id,
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        adset_id: insight.adset_id,
        adset_name: insight.adset_name,
        ad_id: insight.ad_id,
        ad_name: insight.ad_name,
        snapshot_date: today,
        spend: insight.spend,
        impressions: insight.impressions,
        clicks: insight.clicks,
        reach: insight.reach,
        leads: estimatedLeads,
        conversions: estimatedConversions,
        revenue: estimatedRevenue,
        cpl,
        ctr,
        roas,
        lead_quality_score: leadQualityScore,
        cost_per_conversion: costPerConversion,
        profit_loss: profitLoss,
        lead_to_conversion_rate: leadToConvRate,
        frequency: insight.frequency,
        cpm: insight.cpm,
        cost_per_click: costPerClick,
        daily_budget: meta?.daily_budget ?? null,
        lifetime_budget: meta?.lifetime_budget ?? null,
        buying_strategy: meta?.buying_strategy ?? null,
        objective: meta?.objective ?? null,
        campaign_status: meta?.status ?? null,
      });
    }

    // Compute health scores per campaign and update snapshots
    const campaignHealthScores = new Map<string, number>();
    for (const [cid, agg] of campaignAggMap) {
      const campCpl = agg.leads > 0 ? agg.spend / agg.leads : null;
      const campRoas = agg.spend > 0 ? agg.revenue / agg.spend : 0;
      const campQuality = agg.leads > 0 ? Math.min(100, (agg.conversions / agg.leads) * 100) : 0;
      const campConvRate = agg.leads > 0 ? (agg.conversions / agg.leads) * 100 : 0;

      const health = computeHealthScore({
        cpl: campCpl,
        roas: campRoas,
        leadQuality: campQuality,
        conversionRate: campConvRate,
        targetCpl: mk.target_cpl,
        targetRoas: mk.target_roas,
      });
      campaignHealthScores.set(cid, health);
    }

    // Apply health scores to snapshots
    for (const snap of snapshotsToInsert) {
      snap.health_score = campaignHealthScores.get(snap.campaign_id as string) ?? 0;
    }

    // Insert trend data for today
    const trendCpl = totalLeads > 0 ? totalSpend / totalLeads : null;
    const trendRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const trendCtr = insights.reduce((s, i) => s + i.impressions, 0) > 0
      ? (insights.reduce((s, i) => s + i.clicks, 0) / insights.reduce((s, i) => s + i.impressions, 0)) * 100
      : 0;
    const avgHealth = campaignHealthScores.size > 0
      ? Array.from(campaignHealthScores.values()).reduce((s, v) => s + v, 0) / campaignHealthScores.size
      : 0;

    // Generate alerts based on performance
    const alertsToInsert: Array<Record<string, unknown>> = [];
    for (const [cid, agg] of campaignAggMap) {
      const campCpl = agg.leads > 0 ? agg.spend / agg.leads : null;
      const campRoas = agg.spend > 0 ? agg.revenue / agg.spend : 0;
      const campName = insights.find((i) => i.campaign_id === cid)?.campaign_name || "Unknown";
      const health = campaignHealthScores.get(cid) ?? 0;

      if (mk.target_cpl && campCpl && campCpl > mk.target_cpl) {
        alertsToInsert.push({
          user_id: userData.user.id,
          campaign_id: cid,
          campaign_name: campName,
          alert_type: "high_cpl",
          severity: campCpl > (mk.target_cpl * 2) ? "critical" : "warning",
          message: `CPL is ${campCpl.toFixed(2)} (target: ${mk.target_cpl.toFixed(2)})`,
          metric_value: campCpl,
          threshold_value: mk.target_cpl,
        });
      }

      if (mk.target_roas && campRoas < mk.target_roas && agg.spend > 0) {
        alertsToInsert.push({
          user_id: userData.user.id,
          campaign_id: cid,
          campaign_name: campName,
          alert_type: "low_roas",
          severity: campRoas < mk.target_roas * 0.5 ? "critical" : "warning",
          message: `ROAS is ${campRoas.toFixed(2)}x (target: ${mk.target_roas.toFixed(2)}x)`,
          metric_value: campRoas,
          threshold_value: mk.target_roas,
        });
      }

      if (agg.leads > 5 && agg.conversions === 0) {
        alertsToInsert.push({
          user_id: userData.user.id,
          campaign_id: cid,
          campaign_name: campName,
          alert_type: "no_conversions",
          severity: "warning",
          message: `${agg.leads} leads but 0 conversions`,
          metric_value: agg.conversions,
          threshold_value: 1,
        });
      }

      if (health < 25) {
        alertsToInsert.push({
          user_id: userData.user.id,
          campaign_id: cid,
          campaign_name: campName,
          alert_type: "low_quality",
          severity: "critical",
          message: `Health score is ${health}/100 — consider pausing or reducing budget`,
          metric_value: health,
          threshold_value: 50,
        });
      }
    }

    // Delete old snapshots and alerts for today, then insert fresh
    if (snapshotsToInsert.length > 0) {
      await adminSupabase
        .from("campaign_snapshots")
        .delete()
        .eq("user_id", userData.user.id)
        .eq("snapshot_date", today);

      await adminSupabase
        .from("campaign_snapshots")
        .insert(snapshotsToInsert);
    }

    // Insert trend
    await adminSupabase
      .from("campaign_trends")
      .upsert({
        user_id: userData.user.id,
        period_date: today,
        period_type: "daily",
        total_spend: totalSpend,
        total_leads: totalLeads,
        total_conversions: totalConversions,
        total_revenue: totalRevenue,
        avg_cpl: trendCpl,
        avg_roas: trendRoas,
        avg_ctr: trendCtr,
        avg_health_score: Math.round(avgHealth),
        total_impressions: insights.reduce((s, i) => s + i.impressions, 0),
        total_clicks: insights.reduce((s, i) => s + i.clicks, 0),
      }, { onConflict: "user_id,period_date,period_type" });

    // Insert alerts (deduplicate: don't re-insert same alert_type for same campaign today)
    if (alertsToInsert.length > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: existingAlerts } = await adminSupabase
        .from("campaign_alerts")
        .select("campaign_id, alert_type")
        .eq("user_id", userData.user.id)
        .gte("created_at", todayStart.toISOString());

      const existingKeys = new Set(
        (existingAlerts || []).map((a: { campaign_id: string; alert_type: string }) => `${a.campaign_id}:${a.alert_type}`)
      );

      const newAlerts = alertsToInsert.filter((a) => {
        const key = `${a.campaign_id}:${a.alert_type}`;
        return !existingKeys.has(key);
      });

      if (newAlerts.length > 0) {
        await adminSupabase.from("campaign_alerts").insert(newAlerts);
      }
    }

    // Update last_synced_at
    await adminSupabase
      .from("meta_marketing_settings")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", userData.user.id);

    return new Response(
      JSON.stringify({
        success: true,
        synced: snapshotsToInsert.length,
        total_spend: totalSpend,
        total_leads: totalLeads,
        total_conversions: totalConversions,
        total_revenue: totalRevenue,
        alerts_generated: alertsToInsert.length,
        avg_health_score: Math.round(avgHealth),
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
